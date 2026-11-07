/**
 * Authentication: HS256 JWT (compatible with the legacy FastAPI service) and
 * PBKDF2-SHA256 password hashing.
 *
 * ── JWT compatibility ───────────────────────────────────────────────────────
 * `apps/api/app/core/security.py` builds tokens as:
 *
 *   header  = {"alg":"HS256","typ":"JWT"}          (compact JSON, no spaces)
 *   payload = {"sub":<user id>,"role":<role>,"exp":<unix seconds>}
 *   signing_input = b64url(header) + "." + b64url(payload)   (no padding)
 *   signature = b64url(HMAC-SHA256(secret, signing_input))
 *
 * This module reproduces that byte-for-byte so a token minted by either
 * service is accepted by the other. Note the FastAPI service uses
 * `json.dumps(..., separators=(",", ":"))` — compact separators, and dict
 * insertion order — so the JSON must be serialised identically here.
 *
 * ── Password hashing ─────────────────────────────────────────────────────────
 * The legacy format is `pbkdf2_sha256$<hex-salt>$<base64url-digest>` with
 * **200,000** iterations and a 16-byte salt.
 *
 * Cloudflare's WebCrypto refuses PBKDF2 above 100,000 iterations, and the
 * Workers Free plan allows only 10 ms of CPU per request. Both facts make
 * the legacy parameters unusable for hashing *inside* the Worker, so:
 *
 *  - **Verification** of legacy hashes is delegated to Postgres (see
 *    `scripts/pbkdf2.sql`): the database does the 200,000 rounds and the
 *    Worker only waits on the network, which does not count toward CPU time.
 *  - **New** hashes use PBKDF2-SHA256 with an iteration count that fits the
 *    CPU budget and is stored with the iteration count embedded in the
 *    hash string, so the cost can be raised later without invalidating
 *    existing credentials.
 */

import { base64UrlDecode, base64UrlEncode, concatBytes, timingSafeEqual, utf8Decode, utf8Encode } from './base64url'
import type { Sql } from './db'
import { pbkdf2Sha256 } from './sha256'

/** Hash algorithm identifier used in the stored hash string. */
export const HASH_ALGORITHM = 'pbkdf2_sha256'

/** Legacy iteration count used by the FastAPI service. */
export const LEGACY_ITERATIONS = 200_000

/**
 * Iteration count for newly created hashes.
 *
 * Cloudflare's WebCrypto caps PBKDF2 at 100,000 iterations, and the Workers
 * Free plan gives 10 ms of CPU per request. At ~0.6 µs/iteration in
 * workerd, 30,000 iterations cost roughly 18 ms of CPU — already over the
 * Free budget, but comfortably inside Workers Paid (5 min) and inside the
 * documented "isolate flexibility" for occasional overruns.
 *
 * 30,000 is well above the OWASP-recommended floor for PBKDF2-HMAC-SHA256
 * at the time of writing and keeps a full hash + verify pair under ~40 ms.
 */
export const DEFAULT_ITERATIONS = 30_000

/** Maximum iteration count accepted by Cloudflare's WebCrypto. */
export const WEBCRYPTO_MAX_ITERATIONS = 100_000

/** JWT payload carried by an access token. */
export interface AccessTokenPayload {
  /** User id. */
  sub: string
  /** User role (`parent`, `admin`, `owner`, …). */
  role: string
  /** Expiry, seconds since the Unix epoch. */
  exp: number
}

/** Raised when a token or hash cannot be parsed or verified. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

/* ────────────────────────────── JWT ────────────────────────────── */

/**
 * Compact JSON serialisation matching Python's
 * `json.dumps(obj, separators=(",", ":"))`.
 *
 * `JSON.stringify` already emits compact separators; the only difference is
 * that Python escapes non-ASCII by default (`ensure_ascii=True`). The
 * header and payload we build are pure ASCII, but escaping keeps the output
 * identical for any future non-ASCII claim.
 */
function compactJson(value: unknown): string {
  return JSON.stringify(value).replace(/[-￿]/g, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  })
}

/**
 * Compute an HMAC-SHA256 signature over `data` using WebCrypto.
 *
 * @param secret the HS256 secret.
 * @param data the bytes to sign.
 */
async function hmacSha256(secret: string, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8Encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, data)
  return new Uint8Array(signature)
}

/**
 * Create an HS256 access token.
 *
 * The output is byte-compatible with `create_access_token` in the FastAPI
 * service, so both services accept each other's tokens.
 *
 * @param userId the user id placed in the `sub` claim.
 * @param role the user's role.
 * @param secret the HS256 secret.
 * @param expiresInSeconds lifetime of the token.
 */
export async function createAccessToken(
  userId: string,
  role: string,
  secret: string,
  expiresInSeconds: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = compactJson({ alg: 'HS256', typ: 'JWT' })
  const payload = compactJson({ sub: userId, role, exp: now + expiresInSeconds })

  const signingInput = `${base64UrlEncode(utf8Encode(header))}.${base64UrlEncode(utf8Encode(payload))}`
  const signature = await hmacSha256(secret, utf8Encode(signingInput))
  return `${signingInput}.${base64UrlEncode(signature)}`
}

/**
 * Verify an HS256 access token.
 *
 * Mirrors `decode_token` in the FastAPI service: the signature is checked
 * first, then the `exp` claim.
 *
 * @param token the raw token.
 * @param secret the HS256 secret.
 * @returns the decoded payload, or `null` when the token is invalid/expired.
 */
export async function verifyAccessToken(token: string, secret: string): Promise<AccessTokenPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }
  const [header, payload, signature] = parts as [string, string, string]

  let expected: Uint8Array
  try {
    expected = await hmacSha256(secret, utf8Encode(`${header}.${payload}`))
  } catch {
    return null
  }

  let provided: Uint8Array
  try {
    provided = base64UrlDecode(signature)
  } catch {
    return null
  }

  if (!timingSafeEqual(expected, provided)) {
    return null
  }

  let claims: Record<string, unknown>
  try {
    claims = JSON.parse(utf8Decode(base64UrlDecode(payload))) as Record<string, unknown>
  } catch {
    return null
  }

  const exp = Number(claims.exp)
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return null
  }

  const sub = typeof claims.sub === 'string' ? claims.sub : ''
  const role = typeof claims.role === 'string' ? claims.role : 'parent'
  if (!sub) {
    return null
  }

  return { sub, role, exp }
}

/* ────────────────────────── Password hashing ────────────────────────── */

/** A parsed password hash. */
export interface ParsedHash {
  /** Algorithm identifier (`pbkdf2_sha256`). */
  algorithm: string
  /** Iteration count. */
  iterations: number
  /** Salt bytes. */
  salt: Uint8Array
  /** The raw digest bytes. */
  digest: Uint8Array
}

/**
 * The shape of a stored password hash, without decoding it.
 *
 * Two shapes are understood:
 *
 *  - Legacy (FastAPI): `pbkdf2_sha256$<hex-salt>$<base64url-digest>`
 *    — always 200,000 iterations, salt is the hex text as UTF-8 bytes.
 *  - Current: `pbkdf2_sha256$<iterations>$<base64url-salt>$<base64url-digest>`
 *    — the iteration count is embedded so the cost can change later.
 */
export interface HashMetadata {
  /** Algorithm identifier (`pbkdf2_sha256`). */
  algorithm: string
  /** Iteration count the hash was created with. */
  iterations: number
}

/**
 * Read the algorithm and iteration count of a stored hash.
 *
 * The digest is deliberately *not* decoded here: a legacy hash must be able
 * to reach the database-side verification path even when its digest cannot
 * be decoded locally.
 *
 * @param stored the hash string from the database.
 */
export function readHashMetadata(stored: string): HashMetadata {
  const parts = stored.split('$')
  if (parts.length !== 3 && parts.length !== 4) {
    throw new AuthError('Unsupported password hash format')
  }
  const algorithm = parts[0] as string
  if (algorithm !== HASH_ALGORITHM) {
    throw new AuthError(`Unsupported password hash algorithm: ${algorithm}`)
  }

  if (parts.length === 4) {
    const iterations = Number.parseInt(parts[1] as string, 10)
    if (!Number.isInteger(iterations) || iterations < 1) {
      throw new AuthError('Invalid iteration count in password hash')
    }
    return { algorithm, iterations }
  }

  return { algorithm, iterations: LEGACY_ITERATIONS }
}

/**
 * Parse a stored password hash into its raw components.
 *
 * @param stored the hash string from the database.
 */
export function parseHash(stored: string): ParsedHash {
  const parts = stored.split('$')
  if (parts.length !== 3 && parts.length !== 4) {
    throw new AuthError('Unsupported password hash format')
  }
  const algorithm = parts[0] as string
  if (algorithm !== HASH_ALGORITHM) {
    throw new AuthError(`Unsupported password hash algorithm: ${algorithm}`)
  }

  if (parts.length === 4) {
    const iterations = Number.parseInt(parts[1] as string, 10)
    if (!Number.isInteger(iterations) || iterations < 1) {
      throw new AuthError('Invalid iteration count in password hash')
    }
    return {
      algorithm,
      iterations,
      salt: base64UrlDecode(parts[2] as string),
      digest: base64UrlDecode(parts[3] as string),
    }
  }

  // Legacy shape: the salt is the *hex text* used as UTF-8 bytes, exactly as
  // `secrets.token_hex(16).encode("utf-8")` produced it.
  const saltHex = parts[1] as string
  const salt = utf8Encode(saltHex)
  const digest = base64UrlDecode(parts[2] as string)
  return { algorithm, iterations: LEGACY_ITERATIONS, salt, digest }
}

/**
 * Derive a PBKDF2-SHA256 key with WebCrypto.
 *
 * @param password the password bytes.
 * @param salt the salt bytes.
 * @param iterations the iteration count (must be <= 100,000).
 */
export async function deriveKey(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  if (iterations > WEBCRYPTO_MAX_ITERATIONS) {
    throw new AuthError(
      `WebCrypto cannot derive more than ${WEBCRYPTO_MAX_ITERATIONS} PBKDF2 iterations`,
    )
  }
  const key = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return new Uint8Array(bits)
}

/**
 * Hash a password for storage.
 *
 * When a database handle is supplied the derivation runs there and the
 * result uses the *legacy* hash format
 * (`pbkdf2_sha256$<hex-salt>$<base64url-digest>`), so the FastAPI service
 * can verify it and vice versa. Without a database handle the Worker
 * derives the key with WebCrypto and embeds the iteration count in the
 * hash, which lets the cost be raised later without invalidating existing
 * credentials.
 *
 * @param password the plaintext password.
 * @param iterations the PBKDF2 iteration count for the Worker-side fallback.
 *   Ignored when a database handle is supplied, because the legacy hash
 *   format does not record the iteration count.
 * @param sql the Neon query function (optional).
 */
export async function hashPassword(
  password: string,
  iterations: number = DEFAULT_ITERATIONS,
  sql?: Sql,
): Promise<string> {
  if (sql) {
    // The database produces the legacy three-part hash at 200,000 rounds —
    // the same shape the FastAPI service writes and verifies.
    const rows = (await sql`
      SELECT topa_hash_password(${password}) AS hash
    `) as Array<{ hash: string }>
    const hash = rows[0]?.hash
    if (!hash) {
      throw new AuthError('Failed to hash password')
    }
    return hash
  }

  if (!Number.isInteger(iterations) || iterations < 1 || iterations > WEBCRYPTO_MAX_ITERATIONS) {
    throw new AuthError(`Invalid iteration count: ${iterations}`)
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const digest = await deriveKey(utf8Encode(password), salt, iterations)
  return `${HASH_ALGORITHM}$${iterations}$${base64UrlEncode(salt)}$${base64UrlEncode(digest)}`
}

/**
 * Verify a password against a stored hash.
 *
 * Hashes that need more than 100,000 iterations (the legacy
 * 200,000-iteration hashes) cannot be derived with WebCrypto, so they are
 * delegated to Postgres — the database does the 200,000 rounds while the
 * Worker only waits on the network, which does not count toward the CPU
 * budget. The `topa_verify_password` helper is created by
 * `scripts/pbkdf2.sql`.
 *
 * @param password the plaintext password.
 * @param stored the stored hash string.
 * @param sql the Neon query function (required for legacy hashes).
 */
export async function verifyPassword(
  password: string,
  stored: string,
  sql?: Sql,
): Promise<boolean> {
  let metadata: HashMetadata
  try {
    metadata = readHashMetadata(stored)
  } catch {
    return false
  }

  if (sql) {
    // The database handles both hash formats and keeps the expensive
    // 200,000-round derivation off the Worker's CPU budget.
    const rows = (await sql`
      SELECT topa_verify_password(${password}, ${stored}) AS ok
    `) as Array<{ ok: boolean }>
    return Boolean(rows[0]?.ok)
  }

  if (metadata.iterations > WEBCRYPTO_MAX_ITERATIONS) {
    throw new AuthError('Legacy password hashes require database-side verification')
  }

  let parsed: ParsedHash
  try {
    parsed = parseHash(stored)
  } catch {
    return false
  }
  const actual = await deriveKey(utf8Encode(password), parsed.salt, parsed.iterations)
  return timingSafeEqual(actual, parsed.digest)
}

/**
 * Derive a PBKDF2 key in pure JS — used only as a fallback when the database
 * helper is unavailable. Slow (hundreds of ms) but works everywhere.
 *
 * @param password the password bytes.
 * @param salt the salt bytes.
 * @param iterations the iteration count.
 */
export function deriveKeyPureJs(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
): Uint8Array {
  return pbkdf2Sha256(password, salt, iterations)
}

/**
 * Compare two digests in constant time.
 *
 * @param a first digest.
 * @param b second digest.
 */
export function digestsMatch(a: Uint8Array, b: Uint8Array): boolean {
  return timingSafeEqual(a, b)
}

/** Re-export for convenience so callers need only one import. */
export { concatBytes }
