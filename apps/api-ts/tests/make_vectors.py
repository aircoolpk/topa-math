"""Generate PBKDF2-HMAC-SHA256 reference vectors using Python's hashlib.

These are the exact algorithm/format the legacy FastAPI service uses
(`app/core/security.py`), so the TS implementation must reproduce them
bit-for-bit for existing users to be able to sign in.
"""
import base64
import hashlib
import json


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


vectors = []
cases = [
    ("password", "salt1234", 200_000, 32),
    ("correct horse battery staple", "0123456789abcdef", 200_000, 32),
    ("pässwörd-ünïcode-🔐", "sodiumchloride!!", 200_000, 32),
    ("", "", 200_000, 32),
    ("short", "s", 1, 32),
    ("short", "s", 2, 32),
    ("short", "s", 4096, 32),
    ("short", "s", 100_000, 32),
    ("short", "s", 100_000, 64),
    ("a" * 200, "b" * 64, 1000, 32),
]

for password, salt, iterations, dk_len in cases:
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations, dk_len)
    vectors.append(
        {
            "password": password,
            "salt": salt,
            "iterations": iterations,
            "dkLen": dk_len,
            "expected_b64url": b64url(derived),
        }
    )

print(json.dumps(vectors, ensure_ascii=False))
