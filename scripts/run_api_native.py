"""
Run the FastAPI service on the host, without Docker Desktop.

The service talks to Neon (DATABASE_URL in .env.native). Cloudflare Tunnel
runs next to it and forwards api.topamath.com to 127.0.0.1:8001.

Usage:
    python scripts/run_api_native.py            # run in the foreground
    python scripts/run_api_native.py --check    # load the env and exit
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_DIR = ROOT / "apps" / "api"
ENV_FILE = ROOT / ".env.native"


def load_env(path: Path) -> int:
    if not path.exists():
        print(f"missing {path}", file=sys.stderr)
        return 1
    count = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ[key.strip()] = value.strip().strip('"').strip("'")
        count += 1
    return count


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="load the env, print the config and exit")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    loaded = load_env(ENV_FILE)
    database = os.environ.get("DATABASE_URL", "")
    # Never print the credentials: show only the host part of the URL.
    database_host = database.split("@", 1)[-1] if "@" in database else "(unset)"
    print(f"loaded {loaded} variables from {ENV_FILE.name}")
    print(f"  ENVIRONMENT={os.environ.get('ENVIRONMENT')}")
    print(f"  DATABASE_URL host -> {database_host}")
    print(f"  BACKEND_BASE_URL={os.environ.get('BACKEND_BASE_URL')}")

    if args.check:
        return 0

    os.chdir(API_DIR)
    sys.path.insert(0, str(API_DIR))

    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
        access_log=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
