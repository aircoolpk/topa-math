from __future__ import annotations

import argparse
import json

from app.services.content_status import seed_initial_content_status


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed initial admin approval status for lesson/test content.")
    parser.add_argument("--dry-run", action="store_true", help="Print planned changes without saving status files.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing status metadata.")
    args = parser.parse_args()

    report = seed_initial_content_status(dry_run=args.dry_run, force=args.force)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
