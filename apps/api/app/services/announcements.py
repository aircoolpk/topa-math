"""Announcement storage for the public homepage news card.

Announcements live in Postgres instead of ``app/content/site/homepage.json``
because that JSON file is baked into the Docker image (``COPY app ./app``):
an admin edit made to it is silently lost on the next image rebuild.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Any, Iterator

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import SiteAnnouncement

logger = logging.getLogger(__name__)

# How many announcements the public homepage card shows.
PUBLIC_ANNOUNCEMENT_LIMIT = 20

MAX_TITLE_LENGTH = 255
MAX_BODY_LENGTH = 20_000
MAX_LINK_LENGTH = 500


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _isoformat(value: datetime | None) -> str | None:
    """Serialize a datetime as ISO-8601, assuming UTC for naive values."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat()


def _is_missing_table_error(exc: Exception) -> bool:
    message = str(getattr(exc, "orig", exc)).lower()
    return "no such table" in message or "does not exist" in message or "undefined table" in message


@contextmanager
def require_announcements_storage() -> Iterator[None]:
    """Translate a missing-table error into a clear 503 instead of a 500."""
    try:
        yield
    except SQLAlchemyError as exc:
        if _is_missing_table_error(exc):
            logger.warning("site_announcements storage is not ready: %s", exc)
            raise HTTPException(
                status_code=503,
                detail="Announcements storage is not ready. Apply the latest database migration.",
            ) from exc
        raise


def public_announcement_payload(row: SiteAnnouncement) -> dict[str, Any]:
    """Payload shape used by the public endpoints (no admin-only fields)."""
    return {
        "id": row.id,
        "title": row.title,
        "body": row.body or "",
        "link_url": row.link_url,
        "published_at": _isoformat(row.published_at),
    }


def admin_announcement_payload(row: SiteAnnouncement) -> dict[str, Any]:
    """Full payload shape used by the admin endpoints."""
    return {
        "id": row.id,
        "title": row.title,
        "body": row.body or "",
        "link_url": row.link_url,
        "published": bool(row.published),
        "sort_order": int(row.sort_order or 0),
        "published_at": _isoformat(row.published_at),
        "created_at": _isoformat(row.created_at),
        "updated_at": _isoformat(row.updated_at),
    }


def _validate_title(value: Any) -> str:
    if not isinstance(value, str):
        raise HTTPException(status_code=422, detail="title must be a string")
    title = value.strip()
    if not title:
        raise HTTPException(status_code=422, detail="title is required")
    if len(title) > MAX_TITLE_LENGTH:
        raise HTTPException(status_code=422, detail=f"title must be at most {MAX_TITLE_LENGTH} characters")
    return title


def _validate_body(value: Any) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise HTTPException(status_code=422, detail="body must be a string")
    body = value.strip()
    if len(body) > MAX_BODY_LENGTH:
        raise HTTPException(status_code=422, detail=f"body must be at most {MAX_BODY_LENGTH} characters")
    return body


def validate_link_url(value: Any) -> str | None:
    """Allow absolute http(s) URLs and site-relative paths only."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise HTTPException(status_code=422, detail="link_url must be a string")
    link = value.strip()
    if not link:
        return None
    if len(link) > MAX_LINK_LENGTH:
        raise HTTPException(status_code=422, detail=f"link_url must be at most {MAX_LINK_LENGTH} characters")
    lowered = link.lower()
    if lowered.startswith(("http://", "https://")):
        return link
    if link.startswith("/") and not link.startswith("//"):
        return link
    raise HTTPException(status_code=422, detail="link_url must be an http(s) URL or a site-relative path")


def _validate_sort_order(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, bool) or not isinstance(value, int):
        raise HTTPException(status_code=422, detail="sort_order must be an integer")
    if value < -10_000 or value > 10_000:
        raise HTTPException(status_code=422, detail="sort_order must be between -10000 and 10000")
    return value


def _validate_published(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if not isinstance(value, bool):
        raise HTTPException(status_code=422, detail="published must be a boolean")
    return value


def _ordered_statement():
    """sort_order ASC, then published_at DESC, then created_at DESC.

    ``nullslast()`` keeps the ordering identical on SQLite (tests) and
    PostgreSQL (production), which disagree on where NULLs land by default.
    The trailing ``id`` tiebreaker only orders rows that are otherwise
    identical, so the card never reshuffles between requests.
    """
    return (
        select(SiteAnnouncement)
        .order_by(
            SiteAnnouncement.sort_order.asc(),
            SiteAnnouncement.published_at.desc().nullslast(),
            SiteAnnouncement.created_at.desc(),
            SiteAnnouncement.id.asc(),
        )
    )


def list_published_announcements(db: Session, *, limit: int = PUBLIC_ANNOUNCEMENT_LIMIT) -> list[SiteAnnouncement]:
    statement = _ordered_statement().where(SiteAnnouncement.published.is_(True)).limit(limit)
    return list(db.scalars(statement).all())


def list_all_announcements(db: Session) -> list[SiteAnnouncement]:
    return list(db.scalars(_ordered_statement()).all())


def get_announcement(db: Session, announcement_id: str) -> SiteAnnouncement:
    row = db.get(SiteAnnouncement, announcement_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return row


def public_announcement_items(db: Session, *, limit: int = PUBLIC_ANNOUNCEMENT_LIMIT) -> list[dict[str, Any]]:
    """Published announcement items, safe to render on the public homepage."""
    try:
        rows = list_published_announcements(db, limit=limit)
    except SQLAlchemyError as exc:
        if not _is_missing_table_error(exc):
            raise
        # The table is created by the Alembic migration; degrade gracefully so a
        # missing migration cannot take the whole homepage down.
        logger.warning("site_announcements storage is not ready: %s", exc)
        return []
    return [public_announcement_payload(row) for row in rows]


def create_announcement(db: Session, data: dict[str, Any]) -> SiteAnnouncement:
    title = _validate_title(data.get("title"))
    body = _validate_body(data.get("body"))
    link_url = validate_link_url(data.get("link_url"))
    published = _validate_published(data.get("published"), default=False)
    sort_order = _validate_sort_order(data.get("sort_order"))

    row = SiteAnnouncement(
        title=title,
        body=body,
        link_url=link_url,
        published=published,
        sort_order=sort_order,
        published_at=_utcnow() if published else None,
    )
    db.add(row)
    db.flush()
    db.refresh(row)
    db.commit()
    db.refresh(row)
    return row


def update_announcement(db: Session, announcement_id: str, data: dict[str, Any]) -> SiteAnnouncement:
    row = get_announcement(db, announcement_id)
    if "title" in data:
        row.title = _validate_title(data["title"])
    if "body" in data:
        row.body = _validate_body(data["body"])
    if "link_url" in data:
        row.link_url = validate_link_url(data["link_url"])
    if "sort_order" in data:
        row.sort_order = _validate_sort_order(data["sort_order"])
    if "published" in data:
        published = _validate_published(data["published"], default=bool(row.published))
        row.published = published
        if published and row.published_at is None:
            row.published_at = _utcnow()
    db.flush()
    db.refresh(row)
    db.commit()
    db.refresh(row)
    return row


def delete_announcement(db: Session, announcement_id: str) -> None:
    row = get_announcement(db, announcement_id)
    db.delete(row)
    db.commit()
