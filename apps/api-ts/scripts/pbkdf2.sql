-- Password helpers for the Topa Math API.
--
-- WHY THIS EXISTS
-- ---------------
-- The legacy FastAPI service hashes passwords with PBKDF2-HMAC-SHA256 at
-- 200,000 iterations (apps/api/app/core/security.py). Cloudflare's WebCrypto
-- refuses PBKDF2 above 100,000 iterations, and the Workers Free plan allows
-- only 10 ms of CPU per request — a 200,000-round derivation takes ~700 ms of
-- pure-JS CPU, which would exceed the budget by ~70x.
--
-- The database is not bound by the Worker's CPU budget (only the network
-- round trip is charged to the request), so the legacy verification runs
-- here. New hashes are created inside the Worker with WebCrypto and use a
-- lower iteration count that fits the budget.
--
-- `topa_verify_password` compares inside the database so the plaintext
-- password is only compared against the stored digest server-side.
--
-- Requires the pgcrypto extension:
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- PBKDF2-HMAC-SHA256, 32-byte output.
--
-- The accumulator is kept as four 64-bit words so each XOR is a single
-- machine-word operation rather than a byte-at-a-time PL/pgSQL loop; that
-- keeps a 200,000-round derivation at roughly 0.8 s instead of ~11 s.
--
-- The salt is passed as the *hex text* of the salt exactly as the FastAPI
-- service stored it: `secrets.token_hex(16)` produced a 32-character hex
-- string and the service hashed the UTF-8 bytes of that string (not the
-- decoded bytes).

-- Drop any previous revision of these helpers *before* recreating them.
--
-- `CREATE OR REPLACE` refuses to rename an existing function's input
-- parameters ("cannot change name of input parameter"), so a helper left over
-- from an older revision of this file aborted the whole install. Because the
-- install runs as one multi-statement query, that single failure rolled back
-- every statement — leaving the database with a mix of old and new helpers,
-- which only surfaced later as a 500 from /auth/register.
--
-- Dropping by name (not by signature) also clears any overloads an older
-- revision may have left behind.
DO $$
DECLARE
  helper record;
BEGIN
  FOR helper IN
    SELECT oid::regprocedure AS signature
    FROM pg_proc
    WHERE proname LIKE 'topa\_%'
  LOOP
    EXECUTE 'DROP FUNCTION ' || helper.signature || ' CASCADE';
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION topa_pbkdf2_sha256(p_password text, p_salt_hex text, p_iterations int)
RETURNS bytea
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  u bytea;
  t0 bigint;
  t1 bigint;
  t2 bigint;
  t3 bigint;
  w bigint;
  i int;
  k bytea;
BEGIN
  k := convert_to(p_password, 'UTF8');
  u := hmac(convert_to(p_salt_hex, 'UTF8') || int4send(1), k, 'sha256');
  t0 := ('x' || encode(substring(u from 1  for 8), 'hex'))::bit(64)::int8;
  t1 := ('x' || encode(substring(u from 9  for 8), 'hex'))::bit(64)::int8;
  t2 := ('x' || encode(substring(u from 17 for 8), 'hex'))::bit(64)::int8;
  t3 := ('x' || encode(substring(u from 25 for 8), 'hex'))::bit(64)::int8;

  FOR i IN 2..p_iterations LOOP
    u := hmac(u, k, 'sha256');
    w := ('x' || encode(substring(u from 1  for 8), 'hex'))::bit(64)::int8; t0 := t0 # w;
    w := ('x' || encode(substring(u from 9  for 8), 'hex'))::bit(64)::int8; t1 := t1 # w;
    w := ('x' || encode(substring(u from 17 for 8), 'hex'))::bit(64)::int8; t2 := t2 # w;
    w := ('x' || encode(substring(u from 25 for 8), 'hex'))::bit(64)::int8; t3 := t3 # w;
  END LOOP;

  RETURN int8send(t0) || int8send(t1) || int8send(t2) || int8send(t3);
END;
$$;

COMMENT ON FUNCTION topa_pbkdf2_sha256(text, text, int) IS
  'PBKDF2-HMAC-SHA256 (32-byte output); salt is the hex *text* used as UTF-8 bytes.';

-- Decode an unpadded or padded base64url string to raw bytes.
--
-- Postgres' `decode(..., 'base64')` expects the standard alphabet and correct
-- padding, so the URL-safe alphabet is translated and the padding restored.
CREATE OR REPLACE FUNCTION topa_b64url_decode(p_value text)
RETURNS bytea
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT decode(
    rpad(
      translate(rtrim(p_value, '='), '-_', '+/'),
      ((length(rtrim(p_value, '=')) + 3) / 4) * 4,
      '='
    ),
    'base64'
  );
$$;

COMMENT ON FUNCTION topa_b64url_decode(text) IS
  'Decode a base64url string (padded or not) to raw bytes.';

-- Verify a password against a stored hash.
--
-- Understands both hash shapes:
--   pbkdf2_sha256$<hex-salt>$<base64url-digest>            (legacy, 200,000 rounds)
--   pbkdf2_sha256$<iterations>$<base64url-salt>$<base64url-digest>  (current)
--
-- Returns false (rather than raising) for malformed hashes so a corrupt row
-- cannot turn into a 500 on the login endpoint.
CREATE OR REPLACE FUNCTION topa_verify_password(p_password text, p_hash text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  parts text[];
  algorithm text;
  iterations int;
  salt_hex text;
  expected bytea;
  derived bytea;
BEGIN
  parts := string_to_array(p_hash, '$');
  algorithm := parts[1];

  IF algorithm <> 'pbkdf2_sha256' THEN
    RETURN false;
  END IF;

  IF array_length(parts, 1) = 4 THEN
    iterations := parts[2]::int;
    IF iterations < 1 OR iterations > 1000000 THEN
      RETURN false;
    END IF;
    -- base64url salt and digest (padded or not), decoded to raw bytes.
    RETURN topa_pbkdf2_sha256_bytes(
      p_password,
      topa_b64url_decode(parts[3]),
      iterations
    ) = topa_b64url_decode(parts[4]);
  END IF;

  IF array_length(parts, 1) = 3 THEN
    -- Legacy: the salt is the hex text used as UTF-8 bytes, 200,000 rounds.
    salt_hex := parts[2];
    derived := topa_pbkdf2_sha256(p_password, salt_hex, 200000);
    expected := topa_b64url_decode(parts[3]);
    RETURN derived = expected;
  END IF;

  RETURN false;
EXCEPTION
  -- A corrupt row (bad base64, non-numeric iteration count, …) must not turn
  -- the login endpoint into a 500; treat it as a failed verification.
  WHEN others THEN
    RETURN false;
END;
$$;

-- Hash a password for storage, in the legacy hash format.
--
-- The output is byte-compatible with `hash_password` in the FastAPI service
-- (`pbkdf2_sha256$<hex-salt>$<base64url-digest>`), so a user registered
-- through the TypeScript API can sign in through the legacy service and
-- vice versa.
--
-- The salt is 16 random bytes rendered as hex text, and — exactly like the
-- Python code — the *text* of that hex string is what feeds PBKDF2, not the
-- decoded bytes.
CREATE OR REPLACE FUNCTION topa_hash_password(p_password text)
RETURNS text
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  salt_hex text;
  digest bytea;
BEGIN
  -- The three-part hash format does not record the iteration count, so the
  -- count is fixed at 200,000 — exactly what the FastAPI service uses. Any
  -- other value would produce a hash that `topa_verify_password` (and the
  -- FastAPI service) cannot verify.
  salt_hex := encode(gen_random_bytes(16), 'hex');
  digest := topa_pbkdf2_sha256(p_password, salt_hex, 200000);

  -- Python's `base64.urlsafe_b64encode` keeps the `=` padding.
  RETURN 'pbkdf2_sha256$' || salt_hex || '$' || translate(encode(digest, 'base64'), '+/', '-_');
END;
$$;

COMMENT ON FUNCTION topa_hash_password(text) IS
  'Hash a password for storage in the legacy FastAPI hash format (200,000 rounds).';

COMMENT ON FUNCTION topa_verify_password(text, text) IS
  'Verify a password against a stored PBKDF2-SHA256 hash (legacy or current format).';

-- PBKDF2-HMAC-SHA256 with a raw bytea salt (used by the current hash format).
CREATE OR REPLACE FUNCTION topa_pbkdf2_sha256_bytes(p_password text, p_salt bytea, p_iterations int)
RETURNS bytea
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  u bytea;
  t0 bigint;
  t1 bigint;
  t2 bigint;
  t3 bigint;
  w bigint;
  i int;
  k bytea;
BEGIN
  k := convert_to(p_password, 'UTF8');
  u := hmac(p_salt || int4send(1), k, 'sha256');
  t0 := ('x' || encode(substring(u from 1  for 8), 'hex'))::bit(64)::int8;
  t1 := ('x' || encode(substring(u from 9  for 8), 'hex'))::bit(64)::int8;
  t2 := ('x' || encode(substring(u from 17 for 8), 'hex'))::bit(64)::int8;
  t3 := ('x' || encode(substring(u from 25 for 8), 'hex'))::bit(64)::int8;

  FOR i IN 2..p_iterations LOOP
    u := hmac(u, k, 'sha256');
    w := ('x' || encode(substring(u from 1  for 8), 'hex'))::bit(64)::int8; t0 := t0 # w;
    w := ('x' || encode(substring(u from 9  for 8), 'hex'))::bit(64)::int8; t1 := t1 # w;
    w := ('x' || encode(substring(u from 17 for 8), 'hex'))::bit(64)::int8; t2 := t2 # w;
    w := ('x' || encode(substring(u from 25 for 8), 'hex'))::bit(64)::int8; t3 := t3 # w;
  END LOOP;

  RETURN int8send(t0) || int8send(t1) || int8send(t2) || int8send(t3);
END;
$$;

COMMENT ON FUNCTION topa_pbkdf2_sha256_bytes(text, bytea, int) IS
  'PBKDF2-HMAC-SHA256 (32-byte output) with a raw bytea salt.';
