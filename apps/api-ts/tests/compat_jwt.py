"""Verify the TypeScript JWT implementation is byte-compatible with FastAPI.

`apps/api/app/core/security.py` builds tokens like this:

    header  = {"alg":"HS256","typ":"JWT"}
    payload = {"sub": user_id, "role": role, "exp": expires}
    signing_input = b64url(header) + "." + b64url(payload)
    signature = b64url(HMAC-SHA256(secret, signing_input))

This script mints a token with that exact code and compares it against the
token produced by the TypeScript implementation.
"""
import base64
import hashlib
import hmac
import json
import subprocess
import sys
from pathlib import Path

API_TS = Path(r"C:\web-app\4-craft.com\apps\api-ts")
SCRATCH = Path(r"C:\Users\airco\AppData\Local\hermes\profiles\rain\cache\scratch")

SECRET = "test-secret-value-for-compat-check"
USER_ID = "635247b2-ecc4-4703-86ae-b8da258f86fc"
ROLE = "parent"
EXPIRES = 1_800_000_000


def b64encode(payload: bytes) -> str:
    """Copy of `_b64encode` in app/core/security.py."""
    return base64.urlsafe_b64encode(payload).rstrip(b"=").decode("ascii")


def create_access_token(user_id: str, role: str, expires: int) -> str:
    """Copy of `create_access_token` in app/core/security.py."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": user_id, "role": role, "exp": expires}
    signing_input = ".".join(
        [
            b64encode(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")),
        ]
    )
    signature = hmac.new(SECRET.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    return f"{signing_input}.{b64encode(signature)}"


def bundle(entry, out_name: str) -> str:
    """Bundle a TS entry point with esbuild so Node can resolve the imports."""
    out = SCRATCH / out_name
    result = subprocess.run(
        [
            str(API_TS / "node_modules" / ".bin" / "esbuild.cmd"),
            str(entry),
            "--bundle",
            "--format=esm",
            "--platform=neutral",
            "--target=es2022",
            f"--outfile={out}",
        ],
        capture_output=True,
        text=True,
        cwd=API_TS,
    )
    if result.returncode != 0:
        print(result.stdout, result.stderr)
        raise SystemExit("esbuild failed")
    return str(out)


def node(script_path: str, *args: str) -> str:
    result = subprocess.run(
        ["node", script_path, *args],
        capture_output=True,
        text=True,
        cwd=API_TS,
    )
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        raise SystemExit("node failed")
    return result.stdout.strip()


python_token = create_access_token(USER_ID, ROLE, EXPIRES)
print("python token :", python_token)

harness = bundle(API_TS / "scripts" / "jwt.harness.ts", "jwt-harness.mjs")
node_token = node(harness, SECRET, USER_ID, ROLE, str(EXPIRES))
print("node token   :", node_token)

failures = 0
if python_token != node_token:
    print("\nFAIL: tokens differ")
    for i, (a, b) in enumerate(zip(python_token.split("."), node_token.split("."))):
        if a != b:
            print(f"  segment {i}:")
            print(f"    python: {a}")
            print(f"    node  : {b}")
    failures += 1
else:
    print("\nPASS: tokens are byte-identical")

# Cross-verification harness: verify an arbitrary token from the CLI.
verify_entry = SCRATCH / "jwt-verify.ts"
verify_entry.write_text(
    "import { verifyAccessToken } from '"
    + str(API_TS / "src" / "lib" / "auth.ts").replace("\\", "/")
    + "'\n"
    "const token = process.argv[2] as string\n"
    "const secret = process.argv[3] as string\n"
    "console.log(JSON.stringify(await verifyAccessToken(token, secret)))\n",
    encoding="utf-8",
)
verify_bundle = bundle(verify_entry, "jwt-verify.mjs")

decoded = node(verify_bundle, python_token, SECRET)
print("TS verified python token ->", decoded)
if f'"sub":"{USER_ID}"' not in decoded or f'"role":"{ROLE}"' not in decoded:
    print("FAIL: python token was not accepted by the TS verifier")
    failures += 1
else:
    print("PASS: python token accepted by the TS verifier")

# A tampered token must be rejected.
tampered = python_token[:-4] + ("aaaa" if not python_token.endswith("aaaa") else "bbbb")
decoded = node(verify_bundle, tampered, SECRET)
if decoded != "null":
    print(f"FAIL: tampered token was accepted ({decoded})")
    failures += 1
else:
    print("PASS: tampered token rejected")

# A token signed with a different secret must be rejected.
decoded = node(verify_bundle, python_token, "a-different-secret")
if decoded != "null":
    print(f"FAIL: token with wrong secret was accepted ({decoded})")
    failures += 1
else:
    print("PASS: token signed with a different secret rejected")

print("\nALL CHECKS PASS" if failures == 0 else f"\n{failures} FAILURES")
sys.exit(1 if failures else 0)
