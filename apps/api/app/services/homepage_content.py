from __future__ import annotations

import json
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException

CONTENT_DIR = Path(__file__).resolve().parents[1] / "content" / "site"
HOMEPAGE_PATH = CONTENT_DIR / "homepage.json"
BACKUP_DIR = CONTENT_DIR / "_backups"

REQUIRED_TOP_LEVEL_KEYS = {
    "hero",
    "features",
    "ranking",
    "reviews",
    "mascots",
    "curriculum",
    "parent_trust",
    "cta_banner",
    "footer",
}


def _timestamp() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def _ensure_dirs() -> None:
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def _validate_image_ref(value: Any, field: str) -> None:
    if value in (None, ""):
        return
    if not isinstance(value, str):
        raise HTTPException(status_code=422, detail=f"{field} must be a string image URL/path")
    stripped = value.strip()
    if ".." in stripped or "\\" in stripped:
        raise HTTPException(status_code=422, detail=f"{field} contains an unsafe image path")
    if not (
        stripped.startswith("/")
        or stripped.startswith("http://")
        or stripped.startswith("https://")
        or stripped.startswith("data:image/")
    ):
        raise HTTPException(status_code=422, detail=f"{field} must be a public path, URL, or image data URL")


def validate_homepage_config(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Homepage config must be a JSON object")
    missing = sorted(REQUIRED_TOP_LEVEL_KEYS - set(payload.keys()))
    if missing:
        raise HTTPException(status_code=422, detail={"message": "Missing homepage sections", "missing": missing})
    hero = payload.get("hero") or {}
    if not isinstance(hero, dict) or not hero.get("headline") or not hero.get("subheadline"):
        raise HTTPException(status_code=422, detail="Hero headline and subheadline are required")
    _validate_image_ref(hero.get("mascot_group_image"), "hero.mascot_group_image")
    for section_name in ("features", "reviews", "mascots", "curriculum", "parent_trust"):
        section = payload.get(section_name) or {}
        if not isinstance(section, dict) or not isinstance(section.get("cards"), list):
            raise HTTPException(status_code=422, detail=f"{section_name}.cards must be an array")
        if section_name in {"reviews", "mascots"}:
            for index, card in enumerate(section.get("cards") or []):
                if isinstance(card, dict):
                    _validate_image_ref(card.get("image"), f"{section_name}.cards[{index}].image")
    ranking = payload.get("ranking") or {}
    if not isinstance(ranking, dict) or not isinstance(ranking.get("rows"), list):
        raise HTTPException(status_code=422, detail="ranking.rows must be an array")
    for index, row in enumerate(ranking.get("rows") or []):
        if isinstance(row, dict):
            _validate_image_ref(row.get("image"), f"ranking.rows[{index}].image")
    cta = payload.get("cta_banner") or {}
    if isinstance(cta, dict):
        _validate_image_ref(cta.get("mascot_image"), "cta_banner.mascot_image")
    return payload


def load_homepage_config() -> dict[str, Any]:
    _ensure_dirs()
    if not HOMEPAGE_PATH.exists():
        raise HTTPException(status_code=500, detail="Homepage config file is missing")
    try:
        payload = json.loads(HOMEPAGE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Homepage config is invalid JSON: {exc}") from exc
    return validate_homepage_config(payload)


def public_homepage_config() -> dict[str, Any]:
    payload = load_homepage_config()
    public_payload = dict(payload)
    public_payload["published_at"] = datetime.now(UTC).isoformat()
    return public_payload


def backup_homepage_config() -> dict[str, str]:
    _ensure_dirs()
    if not HOMEPAGE_PATH.exists():
        raise HTTPException(status_code=404, detail="Homepage config file is missing")
    backup_path = BACKUP_DIR / f"homepage.{_timestamp()}.json"
    shutil.copy2(HOMEPAGE_PATH, backup_path)
    return {"backup_path": str(backup_path)}


def save_homepage_config(payload: dict[str, Any], *, create_backup: bool = True) -> dict[str, Any]:
    _ensure_dirs()
    validated = validate_homepage_config(payload)
    backup = backup_homepage_config() if create_backup and HOMEPAGE_PATH.exists() else None
    HOMEPAGE_PATH.write_text(
        json.dumps(validated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return {"saved": True, "backup": backup, "config": validated}


def list_homepage_backups() -> list[dict[str, Any]]:
    _ensure_dirs()
    backups = []
    for path in sorted(BACKUP_DIR.glob("homepage.*.json"), reverse=True):
        backups.append({"name": path.name, "path": str(path), "created_at": datetime.fromtimestamp(path.stat().st_mtime, UTC).isoformat()})
    return backups


def restore_homepage_backup(name: str) -> dict[str, Any]:
    _ensure_dirs()
    if "/" in name or "\\" in name or not name.startswith("homepage.") or not name.endswith(".json"):
        raise HTTPException(status_code=400, detail="Invalid backup name")
    source = BACKUP_DIR / name
    if not source.exists() or source.parent != BACKUP_DIR:
        raise HTTPException(status_code=404, detail="Backup not found")
    payload = json.loads(source.read_text(encoding="utf-8"))
    validate_homepage_config(payload)
    backup_homepage_config()
    shutil.copy2(source, HOMEPAGE_PATH)
    return {"restored": True, "config": payload}
