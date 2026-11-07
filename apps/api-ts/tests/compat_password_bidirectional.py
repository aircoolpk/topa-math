"""
Cross-check the password hashing between the FastAPI service and the
Postgres helper used by the TypeScript Worker.

Two directions are checked:

  1. A hash created by the FastAPI service (`hash_password`) verifies with
     `topa_verify_password` — the path used when an existing user signs in
     through the new Worker.
  2. A hash created by `topa_hash_password` (what the Worker writes on
     sign-up) verifies with the FastAPI service's `verify_password` — so a
     user registered through the Worker can sign in through the old API
     during the cut-over.

Run against the test database:
    python tests/compat_password_bidirectional.py
"""
import os
import subprocess
import sys

CONTAINER = "4craft-postgres"
DB = os.environ.get("TOPA_TEST_DB", "topa_test")

sys.path.insert(0, r"C:\web-app\4-craft.com\apps\api")
from app.core.security import hash_password, verify_password  # noqa: E402


def psql(sql: str) -> str:
    result = subprocess.run(
        ["docker", "exec", CONTAINER, "psql", "-U", "postgres", "-d", DB, "-t", "-A", "-c", sql],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


PASSWORD = "shared-password-for-compat"
failures = 0

# ── Direction 1: FastAPI hash → Postgres verify ──────────────────────────────
python_hash = hash_password(PASSWORD)
print("python hash        :", python_hash[:32] + "...")
print("  format matches   :", python_hash.startswith("pbkdf2_sha256$"))
assert python_hash.count("$") == 2, "expected the legacy three-part format"

ok = psql(
    "SELECT topa_verify_password("
    f"'{PASSWORD}', '{python_hash}'"
    ");"
)
print("  postgres verify  :", ok, "(expected t)")
if ok != "t":
    failures += 1

bad = psql(
    "SELECT topa_verify_password("
    f"'wrong-password', '{python_hash}'"
    ");"
)
print("  postgres wrong   :", bad, "(expected f)")
if bad != "f":
    failures += 1

# ── Direction 2: Postgres hash → FastAPI verify ─────────────────────────────
sql_hash = psql("SELECT topa_hash_password('" + PASSWORD + "');")
print("\npostgres hash      :", sql_hash[:32] + "...")
print("  format matches   :", sql_hash.startswith("pbkdf2_sha256$"))
if sql_hash.count("$") != 2:
    print("  ERROR: expected the legacy three-part format")
    failures += 1

# The FastAPI verifier must accept the Worker's hash.
if verify_password(PASSWORD, sql_hash):
    print("  fastapi verify   : True (expected True)")
else:
    print("  fastapi verify   : False (expected True)")
    failures += 1

if verify_password("wrong-password", sql_hash):
    print("  fastapi wrong    : True (expected False)")
    failures += 1
else:
    print("  fastapi wrong    : False (expected False)")

# ── Malformed input must not raise ───────────────────────────────────────────
for broken in ("", "not-a-hash", "pbkdf2_sha256$onlytwo", "pbkdf2_sha256$$", "pbkdf2_sha256$zz$zz"):
    result = psql(
        "SELECT topa_verify_password("
        f"'{PASSWORD}', '{broken}'"
        ");"
    )
    if result != "f":
        print(f"  malformed {broken!r:36} -> {result} (expected f)")
        failures += 1
print("\nmalformed hashes all rejected without raising")

print("\nALL CHECKS PASS" if failures == 0 else f"\n{failures} CHECK(S) FAILED")
sys.exit(1 if failures else 0)
