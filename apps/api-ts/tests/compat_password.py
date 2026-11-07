"""End-to-end compatibility check for the password hash format.

Creates a hash with the *exact* legacy FastAPI algorithm
(`app/core/security.py`), stores it, and asks Postgres to verify it.
This proves a user created by the legacy service can log in through the
TypeScript API.
"""
import base64
import hashlib
import secrets
import subprocess
import sys

PASSWORD = "correct horse battery staple 🔐"


def hash_password(password: str) -> str:
    """Byte-for-byte copy of `hash_password` in app/core/security.py."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000)
    return f"pbkdf2_sha256${salt}${base64.urlsafe_b64encode(digest).decode('ascii')}"


def psql(sql: str) -> str:
    result = subprocess.run(
        [
            "docker", "exec", "4craft-postgres", "psql",
            "-U", "postgres", "-d", "adaptive_learning",
            "-t", "-A", "-c", sql,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


stored = hash_password(PASSWORD)
print("stored hash:", stored[:48] + "...")
print("salt        :", stored.split("$")[1])
print("digest len  :", len(stored.split("$")[2]))

# Escape the single quotes for the SQL literal.
escaped = stored.replace("'", "''")
escaped_pw = PASSWORD.replace("'", "''")

ok = psql(f"SELECT topa_verify_password('{escaped_pw}', '{escaped}')")
bad = psql(f"SELECT topa_verify_password('wrong-password', '{escaped}')")

print()
print("verify(correct password) ->", ok, "(expected t)")
print("verify(wrong password)   ->", bad, "(expected f)")

failures = 0
if ok != "t":
    print("FAIL: legacy hash did not verify")
    failures += 1
if bad != "f":
    print("FAIL: wrong password verified")
    failures += 1

# Also confirm the new-format hash (with embedded iteration count) verifies.
new_salt = secrets.token_bytes(16)
new_digest = hashlib.pbkdf2_hmac("sha256", PASSWORD.encode("utf-8"), new_salt, 30_000)
new_hash = "pbkdf2_sha256$30000${}${}".format(
    base64.urlsafe_b64encode(new_salt).decode("ascii").rstrip("="),
    base64.urlsafe_b64encode(new_digest).decode("ascii").rstrip("="),
)
new_ok = psql(f"SELECT topa_verify_password('{escaped_pw}', '{new_hash}')")
new_bad = psql(f"SELECT topa_verify_password('wrong-password', '{new_hash}')")
print("\nnew-format verify(correct) ->", new_ok, "(expected t)")
print("new-format verify(wrong)   ->", new_bad, "(expected f)")
if new_ok != "t" or new_bad != "f":
    print("FAIL: new-format hash verification")
    failures += 1

# A corrupt row must return false rather than raising.
corrupt = psql("SELECT topa_verify_password('x', 'pbkdf2_sha256$30000$not-base64$x')")
print("corrupt hash               ->", corrupt, "(expected f)")
if corrupt != "f":
    print("FAIL: corrupt hash did not return false")
    failures += 1

print("\nALL CHECKS PASS" if failures == 0 else f"\n{failures} FAILURES")
sys.exit(1 if failures else 0)
