from __future__ import annotations

import argparse
import json
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.services.lesson_content import CONTENT_ROOT


def _read_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def _base_id(path: Path) -> str:
    payload = _read_json(path)
    lesson_id = str(
        payload.get("lesson_id")
        or payload.get("id")
        or payload.get("topic_code")
        or path.stem
    ).strip()
    stem = lesson_id or path.stem
    if stem.lower().endswith("_ep"):
        return stem
    parts = stem.rsplit("_", 1)
    if len(parts) == 2 and parts[1].isdigit() and len(parts[1]) == 3:
        return parts[0]
    return stem


def _flat_files(root: Path) -> list[Path]:
    return sorted(path for path in root.glob("*.json") if path.is_file())


def _backup_path(path: Path, backup_root: Path) -> Path:
    return backup_root / path.relative_to(CONTENT_ROOT)


def migrate(*, dry_run: bool) -> dict[str, Any]:
    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    backup_root = CONTENT_ROOT / "_content_backups" / f"{timestamp}_lesson_folder_migration"
    moved: list[dict[str, str]] = []
    skipped: list[dict[str, str]] = []
    conflicts: list[dict[str, str]] = []

    for grade in range(1, 7):
        for kind in ("lessons", "quizzes"):
            root = CONTENT_ROOT / f"grade_{grade}" / kind
            if not root.exists():
                skipped.append({"path": str(root), "reason": "missing_root"})
                continue
            for path in _flat_files(root):
                folder = root / _base_id(path)
                target = folder / path.name
                if target.exists():
                    conflicts.append({"source": str(path), "target": str(target), "reason": "target_exists"})
                    continue
                backup = _backup_path(path, backup_root)
                action = {"source": str(path), "target": str(target), "backup": str(backup)}
                moved.append(action)
                if dry_run:
                    continue
                folder.mkdir(parents=True, exist_ok=True)
                backup.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, backup)
                shutil.move(str(path), str(target))

    return {
        "dry_run": dry_run,
        "backup_root": str(backup_root),
        "moved_count": len(moved) if not dry_run else 0,
        "planned_move_count": len(moved),
        "skipped_count": len(skipped),
        "conflict_count": len(conflicts),
        "moved": moved,
        "skipped": skipped,
        "conflicts": conflicts,
        "rollback": f"Copy files from {backup_root} back to {CONTENT_ROOT} if a non-dry run must be reverted.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Move flat TOPA Math content into lesson-specific folders.")
    parser.add_argument("--dry-run", action="store_true", help="Report planned moves without changing files.")
    args = parser.parse_args()
    print(json.dumps(migrate(dry_run=args.dry_run), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
