"""Admin audit logging service.

Provides structured logging of all admin actions for accountability
and security auditing.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import AdminAuditLog, User


def _json_safe(value: Any) -> dict[str, Any] | None:
    """Convert a value to a JSON-safe dict, converting datetimes to ISO strings."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return {"_type": "datetime", "value": value.isoformat()}
    if isinstance(value, dict):
        return {key: _json_safe(nested) for key, nested in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    return value


def log_admin_action(
    db: Session,
    action: str,
    target_id: str,
    *,
    old_value: dict[str, Any] | None = None,
    new_value: dict[str, Any] | None = None,
    admin: User | None = None,
    note: str | None = None,
) -> AdminAuditLog:
    """Log an admin action to the audit trail.

    Args:
        db: Database session
        action: Short action name (e.g. "approve_lesson", "edit_question", "change_role")
        target_id: Identifier of the target (lesson_id, question_id, user_id, etc.)
        old_value: State before the change (will be JSON serialized)
        new_value: State after the change (will be JSON serialized)
        admin: The admin user performing the action
        note: Optional human-readable note

    Returns:
        The created AdminAuditLog row
    """
    entry = AdminAuditLog(
        action=action,
        target_user_id=target_id,
        old_value=_json_safe(old_value),
        new_value=_json_safe(new_value),
        changed_by_admin_id=admin.id if admin else None,
        note=note,
    )
    db.add(entry)
    return entry


def log_content_approval(
    db: Session,
    admin: User,
    content_type: str,  # "lesson" or "question"
    content_id: str,
    status: str,
    note: str | None = None,
) -> AdminAuditLog:
    """Log a content approval or rejection action."""
    action = f"approve__{content_type}" if status == "approved" else f"reject__{content_type}"
    return log_admin_action(
        db,
        action=action,
        target_id=content_id,
        old_value={"status": status},
        new_value={"status": status},
        admin=admin,
        note=note,
    )


def log_content_edit(
    db: Session,
    admin: User,
    content_type: str,
    content_id: str,
    old_payload: dict[str, Any],
    new_payload: dict[str, Any],
    note: str | None = None,
) -> AdminAuditLog:
    """Log a content edit action with before/after snapshots."""
    return log_admin_action(
        db,
        action=f"edit__{content_type}",
        target_id=content_id,
        old_value=old_payload,
        new_value=new_payload,
        admin=admin,
        note=note,
    )