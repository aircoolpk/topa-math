from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models import AIGenerationJob, AdminAuditLog, ChildProfile, CoinLedger, Lesson, LessonActivity, Question, Skill, Subject, TestResult, TestSession, User
from app.routers.deps import require_admin
from app.services.referrals import admin_referral_rows, award_paid_referral_if_needed
from app.services.content_quality import content_quality_report
from app.services.lesson_content import (
    CONTENT_ROOT,
    find_lesson_file,
    list_canonical_lessons,
    list_canonical_tests,
    list_lessons as list_content_lessons,
    list_questions as list_content_questions,
    normalize_lesson_visual_blocks,
    qa_summary as content_qa_summary,
    save_lesson,
    validate_all_questions,
    validate_lesson_content,
    validate_question_payload,
    update_question_payload,
)
from app.routers.billing import PLAN_CATALOG
from app.services.homepage_content import (
    backup_homepage_config,
    list_homepage_backups,
    load_homepage_config,
    restore_homepage_backup,
    save_homepage_config,
    validate_homepage_config,
)

router = APIRouter(prefix="/admin", tags=["admin"])


ACTIVE_SUBSCRIPTION_STATUSES = {"active", "trialing", "paid"}
PAID_MEMBERSHIP_STATUSES = {"paid", "plus"}
MANUAL_ACTIVE_STATUSES = {"active", "trial", "trialing", "manual_grant"}
PLAN_TYPES = {"free", "thp", "ep", "family", "reviewer"}
PROGRAM_TYPES = {"FREE", "THP", "EP", "BOTH"}
ADMIN_SUBSCRIPTION_STATUSES = {"free", "active", "trial", "manual_grant", "expired", "canceled"}
ADMIN_ROLES = {"user", "reviewer", "admin"}
ADMIN_ROLE_ALIASES = {"parent": "user", "owner": "admin", "editor": "reviewer", "viewer": "reviewer"}
ADMIN_PLANS = {"free", "reviewer", "founder", "plus", "pro"}


class AdminUserPatch(BaseModel):
    role: str | None = None
    membership_status: str | None = None
    plan_code: str | None = None
    active_price_code: str | None = None
    subscription_status: str | None = None
    current_period_end: datetime | None = None
    cancel_at_period_end: bool | None = None


class AdminSubscriptionPatch(BaseModel):
    membership_status: str | None = None
    plan_code: str | None = None
    active_price_code: str | None = None
    subscription_status: str | None = None
    current_period_end: datetime | None = None
    cancel_at_period_end: bool | None = None
    canceled_at: datetime | None = None


class AdminLessonPatch(BaseModel):
    status: str | None = None
    title: str | None = None
    content: dict[str, Any] | None = None


class AdminRolePatch(BaseModel):
    role: str
    admin_note: str | None = None


class AdminPlanPatch(BaseModel):
    plan: str | None = None
    plan_expires_at: datetime | None = None
    reason: str | None = None
    note: str | None = None
    plan_type: str | None = None
    program_type: str | None = None
    subscription_status: str | None = None
    access_ends_at: datetime | None = None
    admin_note: str | None = None
    manual_grant_reason: str | None = None


class AdminActivePatch(BaseModel):
    is_active: bool
    admin_note: str | None = None


class AdminExtendIn(BaseModel):
    days: int = 30
    admin_note: str | None = None


class AdminActionNoteIn(BaseModel):
    admin_note: str | None = None


class HomepagePatch(BaseModel):
    config: dict[str, Any]


class HomepageRestoreIn(BaseModel):
    backup_name: str


def _plan_amount_monthly_thb(active_price_code: str | None) -> float:
    plan = PLAN_CATALOG.get(str(active_price_code or ""))
    if not plan:
        return 0.0
    return float(plan.amount_thb / 12 if plan.billing_interval == "year" else plan.amount_thb)


def _plan_display_name(active_price_code: str | None, plan_code: str | None = None) -> str:
    plan = PLAN_CATALOG.get(str(active_price_code or ""))
    if plan:
        return plan.display_name
    return str(plan_code or "free")


def _plan_type(child: ChildProfile | None) -> str:
    if not child:
        return "free"
    raw = (child.plan_type or child.plan_code or "free").lower()
    aliases = {
        "th_plus": "thp",
        "ep_plus": "ep",
        "plus_monthly": "thp",
        "free": "free",
    }
    return aliases.get(raw, raw if raw in PLAN_TYPES else "free")


def _program_type(child: ChildProfile | None) -> str:
    if not child:
        return "FREE"
    raw = (child.billing_program_type or child.program_type or "FREE").upper()
    if raw in {"TH", "THAI"}:
        return "THP"
    if raw in {"EP", "THP", "BOTH", "FREE"}:
        return raw
    return "FREE" if _plan_type(child) == "free" else "THP"


def _admin_role(role: str | None) -> str:
    raw = str(role or "user").lower()
    return ADMIN_ROLE_ALIASES.get(raw, raw)


def _storage_role(role: str) -> str:
    normalized = _admin_role(role)
    if normalized not in ADMIN_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    return "parent" if normalized == "user" else normalized


def _normalize_plan(plan: str | None) -> str:
    raw = str(plan or "free").lower()
    aliases = {"thp": "plus", "ep": "plus", "family": "plus", "manual_grant": "reviewer"}
    return aliases.get(raw, raw)


def _effective_user_plan(user: User) -> str:
    plan = _normalize_plan(getattr(user, "plan", None))
    expires_at = getattr(user, "plan_expires_at", None)
    if expires_at:
        end = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=UTC)
        if end < datetime.now(UTC):
            return "free"
    return plan if plan in ADMIN_PLANS else "free"


def _safe_user_profile(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "user_id": user.id,
        "email": user.email,
        "role": _admin_role(user.role),
        "storage_role": user.role,
        "plan": _effective_user_plan(user),
        "plan_expires_at": user.plan_expires_at,
        "is_active": user.is_active is not False,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
        "children_count": len(list(user.children or [])),
    }


def _child_payload(child: ChildProfile, user: User | None = None) -> dict[str, Any]:
    return {
        "id": child.id,
        "child_id": child.id,
        "parent_user_id": child.parent_user_id,
        "parent_email": user.email if user else None,
        "nickname": child.nickname,
        "name": " ".join(part for part in [child.first_name, child.last_name] if part) or child.nickname,
        "grade": child.grade_level,
        "grade_level": child.grade_level,
        "xp": child.total_xp,
        "level": child.current_level,
        "rank": child.current_rank_title,
        "created_at": child.created_at,
    }


def _session_payload(session: TestSession, child: ChildProfile | None = None, user: User | None = None, result: TestResult | None = None) -> dict[str, Any]:
    metadata = session.metadata_json or {}
    grade = metadata.get("grade_level") or (child.grade_level if child else None)
    score = None
    if result:
        score = {
            "total_questions": result.total_questions,
            "correct_count": result.correct_count,
            "accuracy": float(result.accuracy or 0),
        }
    return {
        "id": session.id,
        "session_id": session.id,
        "user": {"id": user.id, "email": user.email} if user else None,
        "child": {"id": child.id, "nickname": child.nickname} if child else None,
        "lesson_id": session.lesson_id or session.quiz_id,
        "grade": grade,
        "score": score,
        "status": session.status,
        "started_at": session.started_at,
        "finished_at": session.completed_at,
    }


def _legacy_plan_code(plan_type: str, program_type: str) -> str:
    if plan_type == "free" or program_type == "FREE":
        return "free"
    if plan_type == "family" or program_type in {"EP", "BOTH"}:
        return "ep_plus"
    return "th_plus"


def _membership_for_status(status: str) -> str:
    if status in {"active", "trial", "manual_grant"}:
        return "plus"
    return "free"


def _json_safe(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_safe(nested) for key, nested in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    return value


def _child_snapshot(child: ChildProfile | None, user: User | None = None) -> dict[str, Any]:
    return _json_safe(
        {
            "user_id": user.id if user else (child.parent_user_id if child else None),
            "role": user.role if user else None,
            "plan_type": _plan_type(child),
            "program_type": _program_type(child),
            "plan_code": child.plan_code if child else "free",
            "membership_status": child.membership_status if child else "free",
            "subscription_status": child.subscription_status if child else "none",
            "current_period_end": child.current_period_end if child else None,
            "access_ends_at": child.access_ends_at if child else None,
            "admin_note": child.admin_note if child else None,
            "manual_grant_reason": child.manual_grant_reason if child else None,
        }
    )


def _audit(
    db: Session,
    *,
    action: str,
    target_user_id: str | None,
    old_value: dict[str, Any],
    new_value: dict[str, Any],
    admin: User | None,
    note: str | None = None,
) -> None:
    db.add(
        AdminAuditLog(
            action=action,
            target_user_id=target_user_id,
            old_value=_json_safe(old_value),
            new_value=_json_safe(new_value),
            changed_by_admin_id=admin.id if admin else None,
            note=note,
        )
    )


def _primary_child(user: User) -> ChildProfile | None:
    children = list(user.children or [])
    return children[0] if children else None


def _has_active_stripe_subscription(child: ChildProfile) -> bool:
    return bool(
        child.stripe_subscription_id
        and child.active_price_code
        and (child.subscription_status or "").lower() in {"active", "trialing", "paid"}
        and (child.price_type or "").lower() != "manual"
    )


def _remaining_time(access_ends_at: datetime | None) -> str:
    if not access_ends_at:
        return "no expiry"
    now = datetime.now(UTC)
    end = access_ends_at if access_ends_at.tzinfo else access_ends_at.replace(tzinfo=UTC)
    delta = end - now
    if delta.total_seconds() <= 0:
        return "expired"
    days = delta.days
    if days >= 1:
        return f"{days} days left"
    hours = max(1, int(delta.total_seconds() // 3600))
    return f"{hours} hours left"


def expire_overdue_manual_grants(db: Session, admin: User | None = None) -> int:
    now = datetime.now(UTC)
    expired = 0
    candidates = db.scalars(
        select(ChildProfile).where(
            ChildProfile.access_ends_at.is_not(None),
            ChildProfile.subscription_status.in_(MANUAL_ACTIVE_STATUSES),
        )
    ).all()
    for child in candidates:
        access_ends_at = child.access_ends_at
        if not access_ends_at:
            continue
        end = access_ends_at if access_ends_at.tzinfo else access_ends_at.replace(tzinfo=UTC)
        if end >= now or _has_active_stripe_subscription(child):
            continue
        user = db.get(User, child.parent_user_id)
        old = _child_snapshot(child, user)
        child.plan_type = "free"
        child.plan_code = "free"
        child.program_type = "FREE"
        child.billing_program_type = "FREE"
        child.membership_status = "free"
        child.subscription_status = "expired"
        child.active_price_code = None
        child.price_type = None
        child.cancel_at_period_end = False
        child.admin_note = "Auto expired temporary access"
        _audit(
            db,
            action="auto_expire_subscription",
            target_user_id=child.parent_user_id,
            old_value=old,
            new_value=_child_snapshot(child, user),
            admin=admin,
            note="access_ends_at is in the past and no active Stripe subscription exists",
        )
        expired += 1
    if expired:
        db.flush()
    return expired


def _children(db: Session) -> list[ChildProfile]:
    return list(db.scalars(select(ChildProfile)).all())


@router.get("/homepage")
def admin_homepage(_admin: User = Depends(require_admin)):
    return {"config": load_homepage_config(), "backups": list_homepage_backups()}


@router.patch("/homepage")
def admin_patch_homepage(payload: HomepagePatch, _admin: User = Depends(require_admin)):
    return save_homepage_config(payload.config, create_backup=True)


@router.post("/homepage/validate")
def admin_validate_homepage(payload: HomepagePatch, _admin: User = Depends(require_admin)):
    validate_homepage_config(payload.config)
    return {"valid": True}


@router.post("/homepage/backup")
def admin_backup_homepage(_admin: User = Depends(require_admin)):
    return backup_homepage_config()


@router.post("/homepage/restore")
def admin_restore_homepage(payload: HomepageRestoreIn, _admin: User = Depends(require_admin)):
    return restore_homepage_backup(payload.backup_name)


def _active_paid_children(db: Session) -> list[ChildProfile]:
    return [
        child
        for child in _children(db)
        if (child.membership_status or "").lower() in PAID_MEMBERSHIP_STATUSES
        and (child.subscription_status or "").lower() in ACTIVE_SUBSCRIPTION_STATUSES
    ]


def _revenue_summary(db: Session) -> dict[str, Any]:
    active = _active_paid_children(db)
    mrr = sum(_plan_amount_monthly_thb(child.active_price_code) for child in active)
    revenue_by_plan: dict[str, float] = {}
    paid_users_by_plan: dict[str, int] = {}
    for child in active:
        plan_code = child.active_price_code or child.plan_code or "unknown"
        monthly = _plan_amount_monthly_thb(child.active_price_code)
        revenue_by_plan[plan_code] = revenue_by_plan.get(plan_code, 0.0) + monthly
        paid_users_by_plan[plan_code] = paid_users_by_plan.get(plan_code, 0) + 1
    total_users = int(db.scalar(select(func.count()).select_from(User)) or 0)
    paid_users = len(active)
    return {
        "revenue_today": 0,
        "revenue_this_month": round(mrr, 2),
        "monthly_revenue": round(mrr, 2),
        "total_revenue": round(mrr, 2),
        "mrr": round(mrr, 2),
        "arpu": round(mrr / paid_users, 2) if paid_users else 0,
        "revenue_by_plan": revenue_by_plan,
        "paid_users_by_plan": paid_users_by_plan,
        "conversion_rate": round((paid_users / total_users) * 100, 2) if total_users else 0,
        "is_mock": False,
        "note": "Revenue is estimated from active subscription plan amounts until invoice/payment records are added.",
    }


def _child_subscription_payload(child: ChildProfile, user: User | None = None) -> dict[str, Any]:
    return {
        "subscription_id": child.id,
        "user_id": child.parent_user_id,
        "email": user.email if user else None,
        "stripe_customer_id": child.stripe_customer_id,
        "stripe_subscription_id": child.stripe_subscription_id,
        "membership_status": child.membership_status or "free",
        "subscription_status": child.subscription_status or "none",
        "plan_type": _plan_type(child),
        "plan_code": child.plan_code or "free",
        "active_price_code": child.active_price_code,
        "plan_name": _plan_display_name(child.active_price_code, child.plan_code),
        "program_type": _program_type(child),
        "current_period_end": child.current_period_end,
        "access_ends_at": child.access_ends_at,
        "remaining_time": _remaining_time(child.access_ends_at),
        "admin_note": child.admin_note,
        "manual_grant_reason": child.manual_grant_reason,
        "cancel_at_period_end": child.cancel_at_period_end or False,
        "paid_at": child.paid_at,
        "canceled_at": child.canceled_at,
        "monthly_amount_thb": _plan_amount_monthly_thb(child.active_price_code),
        "created_at": child.created_at,
    }


def _lesson_validation_map() -> dict[str, dict[str, Any]]:
    report = content_quality_report()
    return {str(item.get("lesson_id")): item for item in report["lessons"]}


def _quiz_count_for_lesson(db: Session, lesson: Lesson, skill: Skill | None) -> int:
    content = lesson.content or {}
    quiz_id = content.get("quiz_id") or content.get("lesson_id") or content.get("content_id") or lesson.id
    skill_code = content.get("skill_code") or (skill.code if skill else None)
    return int(
        db.scalar(
            select(func.count())
            .select_from(Question)
            .where(
                or_(
                    Question.metadata_json["quiz_id"].as_string() == str(quiz_id),
                    Question.metadata_json["skill_code"].as_string() == str(skill_code),
                )
            )
        )
        or 0
    )


def _lesson_payload(db: Session, lesson: Lesson, skill: Skill | None, subject: Subject | None, quality: dict[str, Any] | None = None) -> dict[str, Any]:
    content = lesson.content or {}
    issues = quality.get("issues", []) if quality else content.get("quality_issues", [])
    checks = [
        bool(content.get("title_th") or lesson.title),
        bool(content.get("objective_th") or content.get("objective_en")),
        bool(content.get("explanation_steps") or content.get("explanation_en")),
        bool(content.get("worked_examples")),
        bool(content.get("common_mistakes")),
        bool(content.get("visual_blocks") or content.get("lesson_variants")),
        _quiz_count_for_lesson(db, lesson, skill) >= 10,
        not issues,
    ]
    completeness_score = round(sum(1 for check in checks if check) / len(checks) * 100)
    public_id = str(content.get("lesson_id") or content.get("content_id") or lesson.id)
    return {
        "lesson_id": public_id,
        "db_lesson_id": lesson.id,
        "title": lesson.title,
        "title_th": content.get("title_th") or lesson.title,
        "grade": int(content.get("grade_level") or (skill.grade_level if skill else 0) or 0),
        "subject": subject.code if subject else "math",
        "topic": content.get("topic_code") or content.get("skill_code") or (skill.code if skill else None),
        "program_type": content.get("program_type") or "THP",
        "published_status": lesson.status,
        "status": lesson.status,
        "completeness_score": completeness_score,
        "quiz_questions_count": _quiz_count_for_lesson(db, lesson, skill),
        "validation_errors": issues,
        "updated_at": lesson.updated_at,
        "is_mock": False,
    }


def _question_bank_has_test(lesson_id: str, grade_level: int) -> bool:
    bank_path = CONTENT_ROOT / "question_banks" / f"grade_{grade_level}" / f"{lesson_id}.jsonl"
    quiz_path = CONTENT_ROOT / f"grade_{grade_level}" / "quizzes" / f"{lesson_id}.json"
    try:
        if bank_path.exists() and bank_path.stat().st_size > 0:
            return True
        if quiz_path.exists() and quiz_path.stat().st_size > 0:
            return True
    except OSError:
        return False
    return False


def _lesson_status_items() -> list[dict[str, Any]]:
    from app.scripts.audit_content_integrity import validate_lesson as validate_lesson_file

    items = []
    for lesson in list_content_lessons():
        lesson_id = str(lesson.get("lesson_id") or "")
        grade = int(lesson.get("grade_level") or 0)
        found_th = find_lesson_file(lesson_id, "TH")
        found_ep = find_lesson_file(lesson_id, "EP")
        payload = found_th[1] if found_th else (found_ep[1] if found_ep else {})
        source_path = found_th[0] if found_th else (found_ep[0] if found_ep else None)
        completeness = validate_lesson_file(source_path) if source_path else {"complete": False, "issues": ["missing_lesson_file"]}
        visual_blocks = payload.get("visual_blocks") if isinstance(payload, dict) else None
        variants = payload.get("story_variants") if isinstance(payload.get("story_variants"), list) else []
        approved_variants = [
            variant for variant in variants
            if isinstance(variant, dict) and str(variant.get("status") or "approved").lower() == "approved"
        ]
        has_visual = bool(visual_blocks or variants or payload.get("model_diagram") or payload.get("think_story"))
        has_test = _question_bank_has_test(lesson_id, grade)
        validation_status = str(lesson.get("validation_status") or "unknown")
        enabled = validation_status != "invalid" and bool(lesson.get("has_th")) and bool(lesson_id) and bool(completeness.get("complete")) and has_test
        items.append(
            {
                "lesson_id": lesson_id,
                "grade_level": grade,
                "title_th": lesson.get("title_th") or lesson_id,
                "title_ep": lesson.get("title_en") or None,
                "program": "EP" if str(lesson.get("program_type") or "").upper() == "EP" else "TH",
                "has_th": bool(lesson.get("has_th")),
                "has_ep": bool(lesson.get("has_ep")),
                "has_test": has_test,
                "variant_count": len(variants),
                "approved_variant_count": len(approved_variants),
                "missing_ep": not bool(lesson.get("has_ep")),
                "missing_test": not has_test,
                "visual_status": "ok" if has_visual else "missing",
                "completeness_status": "complete" if completeness.get("complete") else "blocking_issues",
                "blocking_issues": completeness.get("issues") or [],
                "test_pairing_status": "paired" if has_test else "missing_test",
                "beta_visible": enabled,
                "enabled": enabled,
                "validation_status": validation_status,
                "issue_count": int(lesson.get("issue_count") or 0),
            }
        )
    return items


@router.get("/generated-content")
def generated_content(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    return db.scalars(select(AIGenerationJob)).all()


@router.get("/content-quality")
def content_quality(_admin=Depends(require_admin)):
    return content_quality_report()


@router.get("/content/lessons")
def content_lessons(
    grade_level: int | None = Query(default=None),
    program_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    _admin: User = Depends(require_admin),
):
    return {"items": list_content_lessons(grade_level=grade_level, program_type=program_type, search=search)}


@router.get("/content/lessons/{lesson_id}")
def content_lesson_detail(
    lesson_id: str,
    program_type: str | None = Query(default=None),
    _admin: User = Depends(require_admin),
):
    found = find_lesson_file(lesson_id, program_type)
    if not found:
        raise HTTPException(status_code=404, detail="Lesson not found")
    path, payload, ep_fallback = found
    response = dict(payload)
    response["visual_blocks"] = normalize_lesson_visual_blocks(payload.get("visual_blocks"))
    response["source_path"] = str(path)
    if ep_fallback:
        response["ep_fallback"] = True
    return response


@router.put("/content/lessons/{lesson_id}")
def update_content_lesson(
    lesson_id: str,
    payload: dict[str, Any] = Body(...),
    program_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Lesson payload must be an object")
    # Security: validate lesson_id for path traversal
    import re
    if not re.match(r"^[a-zA-Z0-9_\-]+$", lesson_id):
        raise HTTPException(status_code=400, detail="Invalid lesson_id format")
    # Backup before overwrite
    from app.services.content_status import backup_lesson
    backup_path = backup_lesson(lesson_id, edited_by=_admin.email, note="admin_edit")
    # Load old payload for audit
    old_payload = None
    found = find_lesson_file(lesson_id, program_type)
    if found:
        old_payload = dict(found[1])
    validation = validate_lesson_content(payload)
    if not validation["valid"]:
        raise HTTPException(status_code=422, detail=validation)
    path, file_backup = save_lesson(lesson_id, program_type, payload)
    # Audit log the edit
    from app.services.admin_audit import log_content_edit
    log_content_edit(db, _admin, "lesson", lesson_id, old_payload or {}, payload, note="admin_edit")
    return {
        "lesson_id": lesson_id,
        "saved": True,
        "path": str(path),
        "backup_path": str(backup_path) if backup_path else str(file_backup) if file_backup else None,
        "validation": validation,
    }


@router.post("/content/lessons/{lesson_id}/validate")
def validate_content_lesson(
    lesson_id: str,
    program_type: str | None = Query(default=None),
    _admin: User = Depends(require_admin),
):
    found = find_lesson_file(lesson_id, program_type)
    if not found:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return validate_lesson_content(found[1])


@router.get("/content/questions")
def content_questions(
    grade_level: int | None = Query(default=None),
    lesson_id: str | None = Query(default=None),
    issue_only: bool = Query(default=False),
    _admin: User = Depends(require_admin),
):
    return {"items": list_content_questions(grade_level=grade_level, lesson_id=lesson_id, issue_only=issue_only)}


@router.post("/content/questions/validate")
def validate_content_questions(_admin: User = Depends(require_admin)):
    return validate_all_questions()


@router.put("/content/questions/{question_id}")
def update_content_question(
    question_id: str,
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Question payload must be an object")
    # Security: validate question_id for path traversal
    import re
    if not re.match(r"^[a-zA-Z0-9_\-]+$", question_id):
        raise HTTPException(status_code=400, detail="Invalid question_id format")
    # Backup before overwrite
    from app.services.content_status import backup_question
    backup_path = backup_question(question_id, edited_by=_admin.email, note="admin_edit")
    question = db.get(Question, question_id)
    old_payload = None
    if question:
        old_payload = {
            "question_text": question.question_text,
            "choices": question.choices,
            "correct_answer": question.correct_answer,
            "explanation": question.explanation,
        }
        for field in ("question_text", "choices", "correct_answer", "explanation", "hint", "difficulty", "question_type"):
            if field in payload:
                setattr(question, field, payload[field])
        validation = validate_question_payload(
            {
                "id": question.id,
                "question_text": question.question_text,
                "choices": question.choices,
                "correct_answer": question.correct_answer,
                "explanation": question.explanation,
            }
        )
        if not validation["valid"]:
            raise HTTPException(status_code=422, detail=validation)
        db.commit()
        # Audit log
        from app.services.admin_audit import log_content_edit
        log_content_edit(db, _admin, "question", question_id, old_payload or {}, payload, note="admin_edit")
        return {"question_id": question.id, "saved": True, "backup_path": str(backup_path) if backup_path else None, "validation": validation}

    updated = update_question_payload(question_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Question not found")
    validation = validate_question_payload(updated)
    if not validation["valid"]:
        raise HTTPException(status_code=422, detail=validation)
    from app.services.admin_audit import log_content_edit
    log_content_edit(db, _admin, "question", question_id, {}, updated, note="admin_edit")
    return {"question_id": question_id, "saved": True, "backup_path": str(backup_path) if backup_path else None, "question": updated, "validation": validation}


@router.get("/content/qa-summary")
def admin_content_qa_summary(_admin: User = Depends(require_admin)):
    return content_qa_summary()


@router.get("/metrics")
def metrics(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    expire_overdue_manual_grants(db, _admin)
    db.commit()
    now = datetime.now(UTC)
    start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    children = _children(db)
    total_users = int(db.scalar(select(func.count()).select_from(User)) or 0)
    users_by_plan: dict[str, int] = {}
    for child in children:
        key = _plan_type(child)
        users_by_plan[key] = users_by_plan.get(key, 0) + 1
    revenue = _revenue_summary(db)
    return {
        "total_users": total_users,
        "free_users": sum(1 for child in children if (child.membership_status or "free") == "free"),
        "trial_users": sum(1 for child in children if (child.membership_status or "") == "trial"),
        "paid_users": sum(1 for child in children if (child.membership_status or "") in PAID_MEMBERSHIP_STATUSES),
        "thp_users": sum(1 for child in children if _plan_type(child) == "thp"),
        "ep_users": sum(1 for child in children if _plan_type(child) == "ep"),
        "family_users": sum(1 for child in children if _plan_type(child) == "family"),
        "manual_grant_users": sum(1 for child in children if (child.subscription_status or "") == "manual_grant"),
        "canceled_users": sum(1 for child in children if (child.subscription_status or "") == "canceled"),
        "expired_users": sum(1 for child in children if (child.subscription_status or "") in {"expired", "unpaid", "incomplete_expired"}),
        "active_subscriptions": len(_active_paid_children(db)),
        "users_by_plan": users_by_plan,
        "monthly_revenue": revenue["monthly_revenue"],
        "total_revenue": revenue["total_revenue"],
        "mrr": revenue["mrr"],
        "arpu": revenue["arpu"],
        "revenue_by_plan": revenue["revenue_by_plan"],
        "new_users_today": int(db.scalar(select(func.count()).select_from(User).where(User.created_at >= start_today)) or 0),
        "new_users_this_month": int(db.scalar(select(func.count()).select_from(User).where(User.created_at >= start_month)) or 0),
    }


@router.get("/summary")
def summary(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    expire_overdue_manual_grants(db, _admin)
    db.commit()
    users_all = list(db.scalars(select(User)).all())
    children = _children(db)
    lessons_status = _lesson_status_items()
    lessons_by_grade: dict[int, int] = {}
    for lesson in lessons_status:
        grade = int(lesson.get("grade_level") or 0)
        lessons_by_grade[grade] = lessons_by_grade.get(grade, 0) + 1
    return {
        "total_users": len(users_all),
        "active_users": sum(1 for user in users_all if user.is_active is not False),
        "free_users": sum(1 for user in users_all if _effective_user_plan(user) == "free"),
        "paid_reviewer_users": sum(1 for user in users_all if _effective_user_plan(user) in {"reviewer", "founder", "plus", "pro"}),
        "reviewer_users": sum(1 for user in users_all if _effective_user_plan(user) == "reviewer"),
        "total_children": len(children),
        "total_test_sessions": int(db.scalar(select(func.count()).select_from(TestSession)) or 0),
        "lessons_visible_by_grade": lessons_by_grade,
        "th_ep_content_coverage": {
            "has_th": sum(1 for lesson in lessons_status if lesson["has_th"]),
            "has_ep": sum(1 for lesson in lessons_status if lesson["has_ep"]),
            "total": len(lessons_status),
        },
        "content_gaps": [lesson for lesson in lessons_status if not lesson["has_th"] or not lesson["has_test"] or lesson["visual_status"] != "ok"][:20],
    }


@router.get("/overview")
def overview(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    expire_overdue_manual_grants(db, _admin)
    db.commit()
    users_all = list(db.scalars(select(User)).all())
    children = _children(db)
    content_summary = _content_summary()

    paid_children = [child for child in children if (child.membership_status or "") in PAID_MEMBERSHIP_STATUSES or _plan_type(child) in {"thp", "ep", "family"}]
    grade_counts: dict[int, int] = {}
    gender_counts: dict[str, int] = {}
    age_counts: dict[str, int] = {"unknown": 0}
    for child in children:
        grade_counts[int(child.grade_level or 0)] = grade_counts.get(int(child.grade_level or 0), 0) + 1
        gender = (child.avatar_gender or "unknown").lower()
        if gender not in {"male", "female", "other"}:
            gender = "unknown"
        gender_counts[gender] = gender_counts.get(gender, 0) + 1
        age_counts["unknown"] += 1

    pending = int(content_summary.get("needs_review_lessons", 0) or 0) + int(content_summary.get("needs_review_tests", 0) or 0)
    approved = int(content_summary.get("approved_lessons", 0) or 0) + int(content_summary.get("approved_tests", 0) or 0)
    draft = int(content_summary.get("draft_lessons", 0) or 0) + int(content_summary.get("draft_tests", 0) or 0)
    rejected = int(content_summary.get("rejected_lessons", 0) or 0)

    return {
        "members": {
            "total": len(users_all),
            "free": sum(1 for user in users_all if _effective_user_plan(user) == "free"),
            "paid": len(paid_children),
            "paid_th": sum(1 for child in paid_children if _program_type(child) in {"THP", "BOTH"}),
            "paid_ep": sum(1 for child in paid_children if _program_type(child) in {"EP", "BOTH"}),
        },
        "students": {
            "total": len(children),
            "by_grade": [{"grade": grade, "count": grade_counts.get(grade, 0)} for grade in range(1, 7)],
            "by_gender": [{"gender": gender, "count": gender_counts.get(gender, 0)} for gender in ["male", "female", "other", "unknown"]],
            "by_age": [{"age": age, "count": count} for age, count in age_counts.items()],
        },
        "content": {
            "lessons_total": int(content_summary.get("total_lessons", 0) or 0),
            "questions_total": int(content_summary.get("total_tests", 0) or 0),
            "tests_total": int(db.scalar(select(func.count()).select_from(TestSession)) or 0),
            "draft": draft,
            "pending": pending,
            "approved": approved,
            "rejected": rejected,
        },
    }


def _admin_user_payload(user: User) -> dict[str, Any]:
    children = list(user.children or [])
    primary = children[0] if children else None
    return {
        "id": user.id,
        "user_id": user.id,
        "name": primary.nickname if primary else user.email.split("@")[0],
        "email": user.email,
        "role": _admin_role(user.role),
        "storage_role": user.role,
        "plan": _effective_user_plan(user),
        "plan_expires_at": user.plan_expires_at,
        "is_active": user.is_active is not False,
        "membership_status": primary.membership_status if primary else "free",
        "subscription_status": primary.subscription_status if primary else "none",
        "plan_type": _plan_type(primary),
        "plan_code": primary.plan_code if primary else "free",
        "plan_name": _plan_display_name(primary.active_price_code if primary else None, primary.plan_code if primary else "free"),
        "program_type": _program_type(primary),
        "trial_ends_at": primary.access_ends_at if primary and primary.subscription_status == "trial" else None,
        "current_period_end": primary.current_period_end if primary else None,
        "access_ends_at": primary.access_ends_at if primary else None,
        "remaining_time": _remaining_time(primary.access_ends_at if primary else None),
        "admin_note": primary.admin_note if primary else None,
        "manual_grant_reason": primary.manual_grant_reason if primary else None,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
        "children_count": len(children),
        "number_of_child_profiles": len(children),
        "actions": ["view_user", "change_role", "change_plan", "extend_subscription", "cancel_subscription", "reactivate_subscription", "set_free"],
    }


@router.get("/users")
def users(
    search: str | None = Query(default=None),
    plan: str | None = Query(default=None),
    role: str | None = Query(default=None),
    active: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    expire_overdue_manual_grants(db, _admin)
    db.commit()
    rows = db.execute(select(User).order_by(User.created_at.desc())).scalars().all()
    query = (search or "").strip().lower()
    filtered = []
    for user in rows:
        payload = _admin_user_payload(user)
        if query and query not in (payload["email"] or "").lower() and query not in (payload["name"] or "").lower():
            continue
        if plan and payload["plan"] != _normalize_plan(plan):
            continue
        if role and payload["role"] != _admin_role(role):
            continue
        if active is not None and payload["is_active"] is not active:
            continue
        filtered.append(payload)
    return {"users": filtered[offset : offset + limit], "total": len(filtered), "limit": limit, "offset": offset}


@router.get("/users/{user_id}")
def get_user(user_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    expire_overdue_manual_grants(db, _admin)
    db.commit()
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    children = [_child_payload(child, user) for child in list(user.children or [])]
    recent_tests = []
    recent_activity = []
    child_ids = [child["id"] for child in children]
    if child_ids:
        result_by_session = {
            result.test_session_id: result
            for result in db.scalars(select(TestResult).where(TestResult.child_profile_id.in_(child_ids))).all()
        }
        sessions = db.scalars(
            select(TestSession)
            .where(TestSession.child_profile_id.in_(child_ids))
            .order_by(TestSession.started_at.desc())
            .limit(20)
        ).all()
        child_by_id = {child.id: child for child in user.children}
        recent_tests = [
            _session_payload(session, child_by_id.get(session.child_profile_id), user, result_by_session.get(session.id))
            for session in sessions
        ]
        activities = db.scalars(
            select(LessonActivity)
            .where(LessonActivity.child_profile_id.in_(child_ids))
            .order_by(LessonActivity.created_at.desc())
            .limit(20)
        ).all()
        recent_activity = [
            {
                "id": activity.id,
                "child_profile_id": activity.child_profile_id,
                "lesson_id": activity.lesson_id,
                "activity_type": activity.activity_type,
                "created_at": activity.created_at,
            }
            for activity in activities
        ]
    return {
        "profile": _safe_user_profile(user),
        "user": _admin_user_payload(user),
        "children": children,
        "recent_test_sessions": recent_tests,
        "recent_lesson_activity": recent_activity,
        "subscription_summary": _child_subscription_payload(_primary_child(user), user) if _primary_child(user) else {"plan": _effective_user_plan(user)},
    }


def _require_child(user: User) -> ChildProfile:
    child = _primary_child(user)
    if not child:
        raise HTTPException(status_code=400, detail="User has no child profile to update")
    return child


def _apply_plan(child: ChildProfile, payload: AdminPlanPatch) -> None:
    plan_type = (payload.plan_type or payload.plan or "free").lower()
    plan_type = {"founder": "family", "plus": "family", "pro": "family"}.get(plan_type, plan_type)
    program_type = (payload.program_type or ("FREE" if plan_type == "free" else "BOTH")).upper()
    status = (payload.subscription_status or ("free" if plan_type == "free" else "manual_grant")).lower()
    if plan_type not in PLAN_TYPES:
        raise HTTPException(status_code=400, detail="Invalid plan_type")
    if program_type not in PROGRAM_TYPES:
        raise HTTPException(status_code=400, detail="Invalid program_type")
    if status not in ADMIN_SUBSCRIPTION_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid subscription_status")
    if plan_type == "free":
        program_type = "FREE"
        status = "free" if status not in {"expired", "canceled"} else status

    child.plan_type = plan_type
    child.program_type = program_type
    child.billing_program_type = program_type
    child.subscription_status = status
    child.membership_status = _membership_for_status(status)
    child.plan_code = _legacy_plan_code(plan_type, program_type)
    expires_at = payload.plan_expires_at or payload.access_ends_at
    child.current_period_end = expires_at
    child.access_ends_at = expires_at
    child.admin_note = payload.admin_note or payload.note
    child.manual_grant_reason = payload.manual_grant_reason or payload.reason
    child.cancel_at_period_end = status == "canceled"
    if status in {"active", "trial", "manual_grant"}:
        child.paid_at = child.paid_at or datetime.now(UTC)
        child.canceled_at = None
        child.price_type = child.price_type or "manual"
    elif status == "canceled":
        child.canceled_at = datetime.now(UTC)
        child.active_price_code = None
        child.price_type = None
    elif status in {"free", "expired"}:
        child.active_price_code = None
        child.price_type = None


@router.patch("/users/{user_id}/role")
def change_user_role(user_id: str, payload: AdminRolePatch, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_role = _storage_role(payload.role)
    if user.role in {"admin", "owner"} and new_role not in {"admin", "owner"}:
        admin_count = int(db.scalar(select(func.count()).select_from(User).where(User.role.in_(["admin", "owner"]))) or 0)
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last admin")
    old = _child_snapshot(_primary_child(user), user)
    user.role = new_role
    _audit(db, action="change_role", target_user_id=user.id, old_value=old, new_value=_child_snapshot(_primary_child(user), user), admin=_admin, note=payload.admin_note)
    db.commit()
    db.refresh(user)
    return _admin_user_payload(user)


@router.patch("/users/{user_id}/plan")
def change_user_plan(user_id: str, payload: AdminPlanPatch, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    requested_plan = _normalize_plan(payload.plan or payload.plan_type)
    if requested_plan not in ADMIN_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    old = _child_snapshot(_primary_child(user), user) | {"user_plan": getattr(user, "plan", "free"), "user_plan_expires_at": user.plan_expires_at}
    user.plan = requested_plan
    user.plan_expires_at = payload.plan_expires_at or payload.access_ends_at
    child = _primary_child(user)
    if child:
        _apply_plan(child, payload)
        if child.subscription_status in {"active", "trial", "manual_grant"}:
            award_paid_referral_if_needed(db, user.id, reference_id=f"admin:{_admin.id}")
    new = _child_snapshot(child, user) | {"user_plan": user.plan, "user_plan_expires_at": user.plan_expires_at}
    _audit(db, action="change_plan", target_user_id=user.id, old_value=old, new_value=new, admin=_admin, note=payload.admin_note or payload.note or payload.reason)
    db.commit()
    db.refresh(user)
    return _admin_user_payload(user)


@router.get("/referrals")
def referrals(db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> dict:
    return admin_referral_rows(db)


@router.post("/referrals/ledger/{ledger_id}/approve")
def approve_referral_coins(ledger_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> dict:
    ledger = db.get(CoinLedger, ledger_id)
    if not ledger:
        raise HTTPException(status_code=404, detail="Ledger row not found")
    ledger.status = "active"
    ledger.activated_at = datetime.now(UTC)
    _audit(db, action="approve_referral_coins", target_user_id=ledger.user_id, old_value={}, new_value={"ledger_id": ledger.id, "amount": ledger.amount}, admin=_admin, note="approve referral coins")
    db.commit()
    return {"ok": True, "ledger_id": ledger.id, "status": ledger.status}


@router.post("/referrals/ledger/{ledger_id}/reverse")
def reverse_referral_coins(ledger_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> dict:
    ledger = db.get(CoinLedger, ledger_id)
    if not ledger:
        raise HTTPException(status_code=404, detail="Ledger row not found")
    ledger.status = "reversed"
    _audit(db, action="reverse_referral_coins", target_user_id=ledger.user_id, old_value={}, new_value={"ledger_id": ledger.id, "amount": ledger.amount}, admin=_admin, note="reverse referral coins")
    db.commit()
    return {"ok": True, "ledger_id": ledger.id, "status": ledger.status}


@router.patch("/users/{user_id}/active")
def change_user_active(user_id: str, payload: AdminActivePatch, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == _admin.id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot disable your own admin account")
    old = {"is_active": user.is_active}
    user.is_active = payload.is_active
    _audit(db, action="change_active", target_user_id=user.id, old_value=old, new_value={"is_active": user.is_active}, admin=_admin, note=payload.admin_note)
    db.commit()
    db.refresh(user)
    return _admin_user_payload(user)


@router.post("/users/{user_id}/extend-subscription")
def extend_subscription(user_id: str, payload: AdminExtendIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    if payload.days <= 0 or payload.days > 3650:
        raise HTTPException(status_code=400, detail="days must be between 1 and 3650")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    child = _require_child(user)
    old = _child_snapshot(child, user)
    now = datetime.now(UTC)
    current = child.access_ends_at if child.access_ends_at else now
    current = current if current.tzinfo else current.replace(tzinfo=UTC)
    base = current if current > now else now
    child.access_ends_at = base + timedelta(days=payload.days)
    child.current_period_end = child.access_ends_at
    if (child.subscription_status or "free") in {"free", "expired", "canceled", "none"}:
        child.subscription_status = "manual_grant"
        child.membership_status = "plus"
        if _plan_type(child) == "free":
            child.plan_type = "reviewer"
            child.program_type = "BOTH"
            child.billing_program_type = "BOTH"
            child.plan_code = "ep_plus"
    child.admin_note = payload.admin_note or child.admin_note
    _audit(db, action="extend_subscription", target_user_id=user.id, old_value=old, new_value=_child_snapshot(child, user), admin=_admin, note=payload.admin_note)
    db.commit()
    db.refresh(user)
    return _admin_user_payload(user)


@router.post("/users/{user_id}/cancel-subscription")
def cancel_subscription(user_id: str, payload: AdminActionNoteIn | None = None, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    child = _require_child(user)
    old = _child_snapshot(child, user)
    child.subscription_status = "canceled"
    child.membership_status = "free"
    child.plan_type = "free"
    child.plan_code = "free"
    child.program_type = "FREE"
    child.billing_program_type = "FREE"
    child.cancel_at_period_end = False
    child.canceled_at = datetime.now(UTC)
    child.admin_note = payload.admin_note if payload else child.admin_note
    _audit(db, action="cancel_subscription", target_user_id=user.id, old_value=old, new_value=_child_snapshot(child, user), admin=_admin, note=payload.admin_note if payload else None)
    db.commit()
    db.refresh(user)
    return _admin_user_payload(user)


@router.post("/users/{user_id}/reactivate-subscription")
def reactivate_subscription(user_id: str, payload: AdminExtendIn | None = None, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    child = _require_child(user)
    old = _child_snapshot(child, user)
    days = payload.days if payload else 30
    now = datetime.now(UTC)
    child.subscription_status = "manual_grant"
    child.membership_status = "plus"
    child.plan_type = _plan_type(child) if _plan_type(child) != "free" else "reviewer"
    child.program_type = _program_type(child) if _program_type(child) != "FREE" else "BOTH"
    child.billing_program_type = child.program_type
    child.plan_code = _legacy_plan_code(child.plan_type, child.program_type)
    child.access_ends_at = now + timedelta(days=days)
    child.current_period_end = child.access_ends_at
    child.canceled_at = None
    child.cancel_at_period_end = False
    child.admin_note = payload.admin_note if payload else child.admin_note
    _audit(db, action="reactivate_subscription", target_user_id=user.id, old_value=old, new_value=_child_snapshot(child, user), admin=_admin, note=payload.admin_note if payload else None)
    db.commit()
    db.refresh(user)
    return _admin_user_payload(user)


@router.post("/users/{user_id}/set-free")
def set_free(user_id: str, payload: AdminActionNoteIn | None = None, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    child = _require_child(user)
    old = _child_snapshot(child, user)
    child.plan_type = "free"
    child.plan_code = "free"
    child.program_type = "FREE"
    child.billing_program_type = "FREE"
    child.membership_status = "free"
    child.subscription_status = "free"
    child.access_ends_at = None
    child.current_period_end = None
    child.active_price_code = None
    child.price_type = None
    child.cancel_at_period_end = False
    child.admin_note = payload.admin_note if payload else child.admin_note
    _audit(db, action="set_free", target_user_id=user.id, old_value=old, new_value=_child_snapshot(child, user), admin=_admin, note=payload.admin_note if payload else None)
    db.commit()
    db.refresh(user)
    return _admin_user_payload(user)


@router.post("/subscriptions/expire-overdue")
def expire_overdue(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    expired = expire_overdue_manual_grants(db, _admin)
    db.commit()
    return {"expired_count": expired}


@router.get("/children")
def children(
    grade: int | None = Query(default=None, ge=1, le=12),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    statement = select(ChildProfile, User).join(User, ChildProfile.parent_user_id == User.id).order_by(ChildProfile.created_at.desc())
    if grade is not None:
        statement = statement.where(ChildProfile.grade_level == grade)
    rows = db.execute(statement).all()
    items = [_child_payload(child, user) for child, user in rows]
    return {"children": items[offset : offset + limit], "total": len(items), "limit": limit, "offset": offset}


@router.get("/students")
def students(
    grade: int | None = Query(default=None, ge=1, le=12),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return children(grade=grade, limit=limit, offset=offset, db=db, _admin=_admin)


@router.get("/members")
def members(
    search: str | None = Query(default=None),
    plan: str | None = Query(default=None),
    role: str | None = Query(default=None),
    active: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return users(search=search, plan=plan, role=role, active=active, limit=limit, offset=offset, db=db, _admin=_admin)


@router.get("/test-sessions")
def test_sessions(
    grade: int | None = Query(default=None, ge=1, le=12),
    lesson: str | None = Query(default=None),
    user: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    rows = db.execute(
        select(TestSession, ChildProfile, User)
        .join(ChildProfile, TestSession.child_profile_id == ChildProfile.id)
        .join(User, ChildProfile.parent_user_id == User.id)
        .order_by(TestSession.started_at.desc())
    ).all()
    result_by_session = {
        result.test_session_id: result
        for result in db.scalars(select(TestResult).order_by(TestResult.created_at.desc())).all()
    }
    items = []
    query_user = (user or "").strip().lower()
    for session, child, parent in rows:
        if grade is not None and child.grade_level != grade:
            continue
        if lesson and lesson not in str(session.lesson_id or session.quiz_id or ""):
            continue
        if query_user and query_user not in parent.email.lower() and query_user not in parent.id:
            continue
        items.append(_session_payload(session, child, parent, result_by_session.get(session.id)))
    return {"tests": items[offset : offset + limit], "total": len(items), "limit": limit, "offset": offset}


@router.get("/tests")
def tests(
    grade: int | None = Query(default=None, ge=1, le=12),
    grade_level: int | None = Query(default=None, ge=1, le=12),
    lesson: str | None = Query(default=None),
    lesson_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    language: str | None = Query(default=None),
    program_type: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    _admin: User = Depends(require_admin),
):
    requested_grade = grade_level or grade
    requested_program = str(program_type or language or "TH").upper()
    canonical_program = "EP" if requested_program == "EP" else "TH"
    rows = list_canonical_tests(
        canonical_program,
        grade=requested_grade,
        lesson_id=lesson_id or lesson,
        approved_only=False,
    )
    if status:
        rows = [row for row in rows if str(row.get("status") or "").lower() == status.lower()]
    return {"tests": rows[offset : offset + limit], "total": len(rows), "limit": limit, "offset": offset}


@router.get("/tests/{test_id}")
def test_detail(test_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    session = db.get(TestSession, test_id)
    if not session:
        raise HTTPException(status_code=404, detail="Test session not found")
    child = db.get(ChildProfile, session.child_profile_id)
    user = db.get(User, child.parent_user_id) if child else None
    result = db.scalar(select(TestResult).where(TestResult.test_session_id == session.id))
    return _session_payload(session, child, user, result) | {
        "question_ids": session.question_ids,
        "quiz_id": session.quiz_id,
        "metadata": session.metadata_json or {},
    }


@router.patch("/tests/{test_id}")
def update_test_session(test_id: str, payload: dict[str, Any] = Body(...), db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    session = db.get(TestSession, test_id)
    if not session:
        raise HTTPException(status_code=404, detail="Test session not found")
    if "status" in payload:
        session.status = str(payload["status"])
    if "metadata" in payload and isinstance(payload["metadata"], dict):
        metadata = dict(session.metadata_json or {})
        metadata.update(payload["metadata"])
        session.metadata_json = metadata
    db.commit()
    return {"test_id": test_id, "status": session.status, "metadata": session.metadata_json or {}}


@router.get("/subscriptions")
def subscriptions(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    rows = db.execute(select(ChildProfile, User).join(User, ChildProfile.parent_user_id == User.id).order_by(ChildProfile.created_at.desc())).all()
    return {"subscriptions": [_child_subscription_payload(child, user) for child, user in rows]}


@router.get("/revenue")
def revenue(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    return _revenue_summary(db)


@router.get("/lessons/status")
def lesson_status(_admin: User = Depends(require_admin)):
    return {"lessons": _lesson_status_items()}


@router.get("/lessons")
def lessons(
    grade: int | None = Query(default=None),
    grade_level: int | None = Query(default=None),
    level: int | None = Query(default=None),
    class_level: int | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    program_type: str | None = Query(default=None),
    language: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    requested_grade = grade_level or grade or level or class_level
    requested_program = (program_type or language or "").upper()
    if requested_program in {"TH", "THP", "EP"}:
        canonical_items = []
        for item in list_canonical_lessons("EP" if requested_program == "EP" else "TH", grade=requested_grade, include_admin_status=True):
            if status and str(item.get("status") or "").lower() != status.lower():
                continue
            if search:
                query = search.lower()
                if query not in str(item.get("lesson_id") or "").lower() and query not in str(item.get("title") or "").lower():
                    continue
            canonical_items.append(
                {
                    **item,
                    "grade": item.get("grade_level"),
                    "subject": "math",
                    "topic": item.get("topic_code"),
                    "published_status": item.get("status"),
                    "completeness_score": 100 if item.get("student_visible") else 0,
                    "quiz_questions_count": None,
                    "validation_errors": [],
                    "is_mock": False,
                    "has_test": item.get("has_approved_test"),
                    "approved_test_count": 1 if item.get("has_approved_test") else 0,
                    "student_visibility_warning": item.get("student_hidden_reason") or "",
                }
            )
        return {
            "lessons": canonical_items,
            "total": len(canonical_items),
            "active_filters": {"grade": requested_grade, "grade_level": requested_grade, "status": status, "search": search, "program_type": requested_program},
        }
    quality_by_id = _lesson_validation_map()
    rows = db.execute(
        select(Lesson, Skill, Subject)
        .join(Skill, Lesson.skill_id == Skill.id)
        .join(Subject, Skill.subject_id == Subject.id)
        .order_by(Skill.grade_level, Lesson.title)
    ).all()
    items = []
    seen = set()
    for lesson, skill, subject in rows:
        public_id = str((lesson.content or {}).get("lesson_id") or (lesson.content or {}).get("content_id") or lesson.id)
        if requested_grade is not None and int(skill.grade_level or 0) != requested_grade:
            continue
        if status and str(lesson.status or "").lower() != status.lower():
            continue
        if search:
            query = search.lower()
            title = (lesson.title or "").lower()
            if query not in public_id.lower() and query not in title:
                continue
        seen.add(public_id)
        items.append(_lesson_payload(db, lesson, skill, subject, quality_by_id.get(public_id)))
    for quality in quality_by_id.values():
        lesson_id = str(quality.get("lesson_id"))
        if lesson_id in seen:
            continue
        if requested_grade is not None and int(quality.get("grade_level") or 0) != requested_grade:
            continue
        if status and str(quality.get("publish_status") or "").lower() != status.lower():
            continue
        if search:
            query = search.lower()
            title = str(quality.get("title") or "").lower()
            if query not in lesson_id.lower() and query not in title:
                continue
        items.append(
            {
                "lesson_id": lesson_id,
                "db_lesson_id": None,
                "title": quality.get("title") or lesson_id,
                "title_th": quality.get("title") or lesson_id,
                "grade": quality.get("grade_level"),
                "subject": "math",
                "topic": quality.get("topic_code"),
                "program_type": quality.get("program_type"),
                "published_status": quality.get("publish_status"),
                "status": quality.get("publish_status"),
                "completeness_score": 100 if quality.get("publishable") else 0,
                "quiz_questions_count": None,
                "validation_errors": quality.get("issues", []),
                "updated_at": None,
                "is_mock": False,
            }
        )
    return {
        "lessons": items,
        "total": len(items),
        "active_filters": {
            "grade": requested_grade,
            "grade_level": requested_grade,
            "status": status,
            "search": search,
        },
    }


@router.get("/lessons/{lesson_id}")
def admin_lesson_detail(lesson_id: str, _admin: User = Depends(require_admin)):
    status_data = get_lesson_status(lesson_id)
    found = find_lesson_file(lesson_id)
    if not found:
        raise HTTPException(status_code=404, detail="Lesson not found")
    path, payload, _ = found
    return {
        "lesson_id": lesson_id,
        "title": payload.get("title") or payload.get("title_th") or payload.get("title_en") or lesson_id,
        "title_th": payload.get("title_th"),
        "title_en": payload.get("title_en"),
        "grade_level": status_data.get("grade_level") or payload.get("grade_level"),
        "topic": payload.get("topic_code") or payload.get("skill_code") or "",
        "status": status_data.get("status", "needs_review"),
        "reviewer_note": status_data.get("reviewer_note", ""),
        "approved_by": status_data.get("approved_by", ""),
        "approved_at": status_data.get("approved_at", ""),
        "language": status_data.get("language", "TH"),
        "qa_flags": status_data.get("qa_flags", 0),
        "updated_at": status_data.get("updated_at", ""),
        "content": dict(payload),
        "source_path": str(path),
        "validation": validate_lesson_payload(payload),
    }


@router.post("/lessons/{lesson_id}/validate")
def admin_validate_lesson_alias(lesson_id: str, _admin: User = Depends(require_admin)):
    return admin_validate_lesson(lesson_id=lesson_id, _admin=_admin)


@router.post("/lessons/{lesson_id}/approve")
def admin_approve_lesson_alias(
    lesson_id: str,
    reviewer_note: str | None = Body(default=None),
    _admin: User = Depends(require_admin),
):
    return admin_approve_lesson(lesson_id=lesson_id, reviewer_note=reviewer_note, _admin=_admin)


@router.post("/lessons/{lesson_id}/reject")
def admin_reject_lesson_alias(
    lesson_id: str,
    reviewer_note: str | None = Body(default=None),
    _admin: User = Depends(require_admin),
):
    return admin_reject_lesson(lesson_id=lesson_id, reviewer_note=reviewer_note, _admin=_admin)


@router.get("/system/health")
def system_health(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    settings = get_settings()
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    redis_status = "not_configured"
    redis_url = settings.redis_url
    if redis_url:
        parsed = urlparse(redis_url)
        host = parsed.hostname
        port = parsed.port or 6379
        if host:
            try:
                import socket

                with socket.create_connection((host, port), timeout=1):
                    redis_status = "reachable"
            except Exception:
                redis_status = "unreachable"

    content_file_count = 0
    try:
        content_file_count = sum(1 for path in Path(CONTENT_ROOT).rglob("*") if path.is_file())
    except OSError:
        content_file_count = 0

    return {
        "api_status": "ok",
        "database_status": db_status,
        "redis_status": redis_status,
        "content_file_count": content_file_count,
        "environment": settings.environment,
        "app_version": "0.1.0",
    }


@router.get("/system/status")
def system_status(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return system_health(db=db, _admin=_admin)


@router.get("/content/quality")
def admin_content_quality_alias(_admin=Depends(require_admin)):
    return content_quality_report()


@router.patch("/users/{user_id}")
def update_user(user_id: str, payload: AdminUserPatch, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.role is not None:
        if payload.role not in {"parent", "admin", "owner"}:
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role = payload.role
    child = user.children[0] if user.children else None
    if child:
        for field in ("membership_status", "plan_code", "active_price_code", "subscription_status", "current_period_end", "cancel_at_period_end"):
            value = getattr(payload, field)
            if value is not None:
                setattr(child, field, value)
    db.commit()
    return {"user_id": user.id, "role": user.role}


@router.patch("/subscriptions/{subscription_id}")
def update_subscription(subscription_id: str, payload: AdminSubscriptionPatch, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    child = db.get(ChildProfile, subscription_id) or db.scalar(select(ChildProfile).where(ChildProfile.stripe_subscription_id == subscription_id))
    if not child:
        raise HTTPException(status_code=404, detail="Subscription not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(child, field, value)
    if payload.subscription_status == "canceled" and not child.canceled_at:
        child.canceled_at = datetime.now(UTC)
    db.commit()
    return _child_subscription_payload(child, db.get(User, child.parent_user_id))


@router.patch("/lessons/{lesson_id}")
def update_lesson(lesson_id: str, payload: AdminLessonPatch, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    lesson = db.get(Lesson, lesson_id) or db.scalar(
        select(Lesson).where(
            or_(
                Lesson.content["lesson_id"].as_string() == lesson_id,
                Lesson.content["content_id"].as_string() == lesson_id,
            )
        )
    )
    if not lesson:
        found = find_lesson_file(lesson_id)
        if not found:
            raise HTTPException(status_code=404, detail="Lesson not found")
        _, old_payload, _ = found
        content = dict(old_payload)
        if payload.title is not None:
            content["title"] = payload.title
            content["title_th"] = payload.title
        if payload.content is not None:
            content.update(payload.content)
        validation = validate_lesson_content(content)
        if not validation["valid"]:
            raise HTTPException(status_code=422, detail=validation)
        save_lesson(lesson_id, None, content)
        if payload.status is not None:
            update_lesson_status(lesson_id, payload.status, approved_by=_admin.email or str(_admin.id))
        return {"lesson_id": lesson_id, "status": payload.status or get_lesson_status(lesson_id).get("status", "needs_review"), "title": content.get("title") or content.get("title_th"), "validation": validation}
    if payload.status is not None:
        lesson.status = payload.status
    if payload.title is not None:
        lesson.title = payload.title
    if payload.content is not None:
        content = dict(lesson.content or {})
        content.update(payload.content)
        lesson.content = content
    db.commit()
    return {"lesson_id": lesson_id, "status": lesson.status, "title": lesson.title}


@router.patch("/generated-content/{job_id}/approve")
def approve(job_id: str, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    job = db.get(AIGenerationJob, job_id)
    job.status = "completed"
    db.commit()
    return {"id": job.id, "status": job.status}


@router.patch("/generated-content/{job_id}/reject")
def reject(job_id: str, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    job = db.get(AIGenerationJob, job_id)
    job.status = "rejected"
    db.commit()
    return {"id": job.id, "status": job.status}


# ---------------------------------------------------------------------------
# Content status management
# ---------------------------------------------------------------------------

from app.services.content_status import (
    content_summary as _content_summary,
    get_lesson_status,
    get_test_status,
    initialize_all_lesson_status,
    is_lesson_approved,
    is_test_approved,
    load_lessons_status,
    load_tests_status,
    save_lessons_status,
    save_tests_status,
    seed_initial_content_status,
    update_lesson_status,
    update_test_status,
)
from app.services.content_quality import validate_lesson_payload


class ContentLessonStatusPatch(BaseModel):
    status: str | None = None
    title: str | None = None
    reviewer_note: str | None = None
    grade_level: int | None = None
    topic: str | None = None
    content: dict[str, Any] | None = None


class ContentTestStatusPatch(BaseModel):
    status: str | None = None
    content: dict[str, Any] | None = None
    question: str | None = None
    question_th: str | None = None
    question_text: str | None = None
    choices: list[Any] | None = None
    correct_answer: Any | None = None
    explanation: str | None = None
    explanation_th: str | None = None
    difficulty: str | None = None
    skill_tag: str | None = None
    reviewer_note: str | None = None


@router.get("/content/summary")
def admin_content_summary(_admin: User = Depends(require_admin)):
    """Overall content status counts by status, grade, and language."""
    return _content_summary()


@router.post("/content/initialize")
def admin_initialize_content(
    dry_run: bool = Query(default=False),
    force: bool = Query(default=False),
    _admin: User = Depends(require_admin),
):
    """Scan all JSON lesson files and initialize sidecar status records."""
    report = seed_initial_content_status(dry_run=dry_run, force=force)
    return report


@router.get("/content/lessons")
def admin_content_lessons(
    grade: int | None = Query(default=None),
    grade_level: int | None = Query(default=None),
    level: int | None = Query(default=None),
    class_level: int | None = Query(default=None),
    language: str | None = Query(default=None),
    status: str | None = Query(default=None),
    topic: str | None = Query(default=None),
    search: str | None = Query(default=None),
    _admin: User = Depends(require_admin),
):
    """List all tracked lessons with their status metadata."""
    requested_grade = grade_level or grade or level or class_level
    if language in {"TH", "THP", "EP"}:
        items = list_canonical_lessons("EP" if language == "EP" else "TH", grade=requested_grade, include_admin_status=True)
        if status:
            items = [item for item in items if str(item.get("status") or "").lower() == status.lower()]
        if topic:
            items = [item for item in items if str(item.get("topic_code") or "") == topic]
        if search:
            query = search.lower()
            items = [item for item in items if query in str(item.get("lesson_id") or "").lower() or query in str(item.get("title") or "").lower()]
        return {"lessons": items, "total": len(items)}
    all_status = load_lessons_status()
    all_tests_status = load_tests_status()
    items = []
    source_lessons = {str(lesson.get("lesson_id") or ""): lesson for lesson in list_content_lessons()}
    lesson_ids = list(all_status.keys()) if all_status else list(source_lessons.keys())
    for lesson_id in sorted(lesson_ids):
        lesson = source_lessons.get(lesson_id)
        if not lesson:
            found = find_lesson_file(lesson_id)
            if not found:
                continue
            _, payload, _ = found
            lesson = {
                "lesson_id": lesson_id,
                "title_th": payload.get("title_th") or payload.get("title") or lesson_id,
                "title_en": payload.get("title_en"),
                "grade_level": payload.get("grade_level"),
                "topic_code": payload.get("topic_code") or payload.get("skill_code") or lesson_id,
                "skill_code": payload.get("skill_code") or payload.get("topic_code") or lesson_id,
                "has_th": not lesson_id.lower().endswith("_ep"),
                "has_ep": lesson_id.lower().endswith("_ep"),
            }
        lesson_id = str(lesson.get("lesson_id") or "")
        status_data = all_status.get(lesson_id, {})
        lang = status_data.get("language", "TH")
        if language and lang != language:
            continue
        lesson_status = str(status_data.get("status", "needs_review")).lower()
        if status and lesson_status != status.lower():
            continue
        if topic and str(lesson.get("topic_code", "")) != topic:
            continue
        if search:
            query = search.lower()
            title = (lesson.get("title_th") or lesson.get("title_en") or "").lower()
            if query not in lesson_id and query not in title:
                continue
        if requested_grade is not None:
            entry_grade = status_data.get("grade_level") or lesson.get("grade_level")
            if int(entry_grade or 0) != requested_grade:
                continue
        items.append(
            {
                "lesson_id": lesson_id,
                "title": lesson.get("title_th") or lesson.get("title_en") or lesson_id,
                "title_th": lesson.get("title_th") or lesson_id,
                "title_en": lesson.get("title_en"),
                "grade_level": status_data.get("grade_level") or lesson.get("grade_level"),
                "language": lang,
                "status": lesson_status,
                "reviewer_note": status_data.get("reviewer_note", ""),
                "approved_by": status_data.get("approved_by", ""),
                "approved_at": status_data.get("approved_at", ""),
                "qa_flags": status_data.get("qa_flags", 0),
                "updated_at": status_data.get("updated_at", ""),
                "topic": lesson.get("topic_code") or lesson.get("skill_code") or "",
                "topic_code": lesson.get("topic_code"),
                "skill_code": lesson.get("skill_code"),
                "has_th": bool(lesson.get("has_th")),
                "has_ep": bool(lesson.get("has_ep")),
                "has_test": any(str(test.get("lesson_id") or "") == lesson_id for test in all_tests_status.values()),
                "approved_test_count": sum(1 for test in all_tests_status.values() if str(test.get("lesson_id") or "") == lesson_id and str(test.get("status") or "") == "approved"),
                "issue_count": int(status_data.get("qa_flags") or 0),
                "is_approved": lesson_status == "approved",
            }
        )
    return {"lessons": items, "total": len(items)}


@router.get("/content/lessons/{lesson_id}")
def admin_content_lesson_detail(
    lesson_id: str,
    _admin: User = Depends(require_admin),
):
    """Get full lesson content + status metadata for admin review."""
    status_data = get_lesson_status(lesson_id)
    found = find_lesson_file(lesson_id)
    if not found:
        raise HTTPException(status_code=404, detail="Lesson not found")
    path, payload, _ = found
    return {
        "lesson_id": lesson_id,
        "status": status_data.get("status", "needs_review"),
        "reviewer_note": status_data.get("reviewer_note", ""),
        "approved_by": status_data.get("approved_by", ""),
        "approved_at": status_data.get("approved_at", ""),
        "language": status_data.get("language", "TH"),
        "grade_level": status_data.get("grade_level") or payload.get("grade_level"),
        "qa_flags": status_data.get("qa_flags", 0),
        "updated_at": status_data.get("updated_at", ""),
        "content": dict(payload),
        "source_path": str(path),
        "validation": validate_lesson_payload(payload),
    }


@router.patch("/content/lessons/{lesson_id}")
def admin_patch_content_lesson(
    lesson_id: str,
    payload: ContentLessonStatusPatch,
    _admin: User = Depends(require_admin),
):
    """Update status metadata for a lesson (not the lesson content itself)."""
    update_data = payload.model_dump(exclude_unset=True)
    content_payload = update_data.pop("content", None)
    new_status = update_data.pop("status", None)
    new_note = update_data.pop("reviewer_note", "") or ""
    approved_by = _admin.email or str(_admin.id)

    if content_payload is not None:
        if not isinstance(content_payload, dict):
            raise HTTPException(status_code=400, detail="Lesson content must be an object")
        found = find_lesson_file(lesson_id)
        if not found:
            raise HTTPException(status_code=404, detail="Lesson not found")
        _, old_payload, _ = found
        next_payload = dict(old_payload)
        next_payload.update(content_payload)
        validation = validate_lesson_content(next_payload)
        if not validation["valid"]:
            raise HTTPException(status_code=422, detail=validation)
        save_lesson(lesson_id, None, next_payload)

    if new_status:
        update_lesson_status(lesson_id, new_status, reviewer_note=new_note, approved_by=approved_by, **update_data)
    else:
        # Just update extra fields without changing status
        existing = get_lesson_status(lesson_id)
        existing.update(update_data)
        all_status = load_lessons_status()
        all_status[lesson_id] = existing
        save_lessons_status(all_status)

    updated = get_lesson_status(lesson_id)
    return {"lesson_id": lesson_id, **updated}


@router.post("/content/lessons/{lesson_id}/approve")
def admin_approve_lesson(
    lesson_id: str,
    reviewer_note: str | None = Body(default=None),
    _admin: User = Depends(require_admin),
):
    """Mark a lesson as approved."""
    approved_by = _admin.email or str(_admin.id)
    note = reviewer_note or ""
    updated = update_lesson_status(lesson_id, "approved", reviewer_note=note, approved_by=approved_by)
    return {"lesson_id": lesson_id, "status": "approved", "approved_by": updated.get("approved_by"), "approved_at": updated.get("approved_at")}


@router.post("/content/lessons/{lesson_id}/reject")
def admin_reject_lesson(
    lesson_id: str,
    reviewer_note: str | None = Body(default=None),
    _admin: User = Depends(require_admin),
):
    """Mark a lesson as rejected."""
    approved_by = _admin.email or str(_admin.id)
    note = reviewer_note or ""
    updated = update_lesson_status(lesson_id, "rejected", reviewer_note=note, approved_by=approved_by)
    return {"lesson_id": lesson_id, "status": "rejected"}


@router.post("/content/lessons/{lesson_id}/validate")
def admin_validate_lesson(
    lesson_id: str,
    _admin: User = Depends(require_admin),
):
    """Run validate_lesson_payload on a lesson and return all warnings/errors."""
    found = find_lesson_file(lesson_id)
    if not found:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return validate_lesson_payload(found[1])


@router.get("/content/tests")
def admin_content_tests(
    grade: int | None = Query(default=None),
    grade_level: int | None = Query(default=None),
    level: int | None = Query(default=None),
    class_level: int | None = Query(default=None),
    language: str | None = Query(default=None),
    lesson_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    _admin: User = Depends(require_admin),
):
    """List all tracked tests with their status metadata."""
    requested_grade = grade_level or grade or level or class_level
    if language in {"TH", "THP", "EP"}:
        items = list_canonical_tests("EP" if language == "EP" else "TH", grade=requested_grade, lesson_id=lesson_id, approved_only=False)
        if status:
            items = [item for item in items if str(item.get("status") or "").lower() == status.lower()]
        return {"tests": items, "total": len(items)}
    all_status = load_tests_status()
    items = []
    for question in list_content_questions(grade_level=requested_grade, lesson_id=lesson_id):
        test_id = str(question.get("question_id") or question.get("id") or "")
        status_data = all_status.get(test_id, {})
        test_status = str(status_data.get("status", "needs_review")).lower()
        if status and test_status != status.lower():
            continue
        items.append(
            {
                "test_id": test_id,
                "question_id": test_id,
                "lesson_id": question.get("lesson_id"),
                "grade_level": question.get("grade_level"),
                "language": status_data.get("language", language or "TH"),
                "status": test_status,
                "question": question.get("question") or "",
                "question_th": question.get("question") or "",
                "choices": question.get("choices") or [],
                "correct_answer": question.get("correct_answer"),
                "explanation": question.get("explanation") or question.get("explanation_th"),
                "explanation_th": question.get("explanation_th") or question.get("explanation"),
                "difficulty": question.get("difficulty") or "medium",
                "skill_tag": question.get("skill_tag") or question.get("skill_code"),
                "reviewer_note": status_data.get("reviewer_note", ""),
                "approved_by": status_data.get("approved_by", ""),
                "approved_at": status_data.get("approved_at", ""),
                "question_count": status_data.get("question_count", 0),
                "approved_question_count": status_data.get("approved_question_count", 0),
                "is_approved": test_status == "approved",
            }
        )
    return {"tests": items, "total": len(items)}


@router.post("/content/tests/{question_id}/validate")
def admin_validate_content_test(
    question_id: str,
    _admin: User = Depends(require_admin),
):
    for question in list_content_questions():
        if str(question.get("question_id") or "") == question_id:
            return validate_question_payload(question)
    raise HTTPException(status_code=404, detail="Question not found")


@router.patch("/content/tests/{question_id}")
def admin_patch_content_test(
    question_id: str,
    payload: ContentTestStatusPatch,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Update test/question content and/or status in DB."""
    if not isinstance(payload, dict) and hasattr(payload, "model_dump"):
        update_data = payload.model_dump(exclude_unset=True)
    else:
        update_data = payload if isinstance(payload, dict) else {}

    status = update_data.pop("status", None)
    reviewer_note = update_data.pop("reviewer_note", None)
    content = update_data.pop("content", None)
    if isinstance(content, dict):
        update_data.update(content)
    if "question_th" in update_data and "question" not in update_data:
        update_data["question"] = update_data.pop("question_th")
    if "question_text" in update_data and "question" not in update_data:
        update_data["question"] = update_data.pop("question_text")
    if "explanation_th" in update_data and "explanation" not in update_data:
        update_data["explanation"] = update_data.pop("explanation_th")
    question = db.get(Question, question_id)
    if question:
        if status and status in {"approved", "needs_review", "draft", "rejected"}:
            question.status = status
        for field in ("question_text", "choices", "correct_answer", "explanation", "hint", "difficulty"):
            if field in update_data:
                setattr(question, field, update_data[field])
        db.commit()
        return {"question_id": question_id, "status": question.status}

    # Fall back to sidecar update
    content_patch = {key: value for key, value in update_data.items() if key in {"question", "choices", "correct_answer", "explanation", "difficulty", "skill_tag"}}
    updated_question = update_question_payload(question_id, content_patch) if content_patch else None
    if status:
        update_test_status(question_id, status, reviewer_note=reviewer_note)
    elif reviewer_note is not None:
        update_test_status(question_id, get_test_status(question_id).get("status", "needs_review"), reviewer_note=reviewer_note)
    return {
        "question_id": question_id,
        "status": get_test_status(question_id).get("status", "needs_review"),
        "saved": bool(updated_question or status or reviewer_note is not None),
    }


@router.post("/content/tests/{question_id}/approve")
def admin_approve_test(
    question_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Approve a test question in DB."""
    question = db.get(Question, question_id)
    if question:
        question.status = "approved"
        db.commit()
    approved_by = _admin.email or str(_admin.id)
    updated = update_test_status(question_id, "approved", approved_by=approved_by)
    return {"question_id": question_id, "status": "approved", "approved_by": updated.get("approved_by")}


@router.post("/content/tests/{question_id}/reject")
def admin_reject_test(
    question_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Reject a test question in DB."""
    question = db.get(Question, question_id)
    if question:
        question.status = "rejected"
        db.commit()
    approved_by = _admin.email or str(_admin.id)
    update_test_status(question_id, "rejected", approved_by=approved_by)
    return {"question_id": question_id, "status": "rejected"}


@router.get("/questions")
def admin_questions(
    grade: int | None = Query(default=None),
    grade_level: int | None = Query(default=None),
    level: int | None = Query(default=None),
    class_level: int | None = Query(default=None),
    topic: str | None = Query(default=None),
    difficulty: str | None = Query(default=None),
    status: str | None = Query(default=None),
    lesson_id: str | None = Query(default=None),
    _admin: User = Depends(require_admin),
):
    requested_grade = grade_level or grade or level or class_level
    rows = admin_content_tests(
        grade=None,
        grade_level=requested_grade,
        level=None,
        class_level=None,
        language=None,
        lesson_id=lesson_id,
        status=status,
        _admin=_admin,
    )["tests"]
    filtered = []
    for row in rows:
        if topic and topic not in str(row.get("skill_tag") or row.get("lesson_id") or ""):
            continue
        if difficulty and str(row.get("difficulty") or "").lower() != difficulty.lower():
            continue
        filtered.append(row)
    return {
        "questions": filtered,
        "total": len(filtered),
        "filtered_total": len(filtered),
        "active_filters": {
            "grade": requested_grade,
            "grade_level": requested_grade,
            "topic": topic,
            "difficulty": difficulty,
            "status": status,
            "lesson_id": lesson_id,
        },
    }


@router.get("/questions/{question_id}")
def admin_question_detail(question_id: str, _admin: User = Depends(require_admin)):
    for question in list_content_questions():
        test_id = str(question.get("question_id") or question.get("id") or "")
        if test_id == question_id:
            status_data = get_test_status(question_id)
            return {
                "question_id": question_id,
                "status": status_data.get("status", "needs_review"),
                "reviewer_note": status_data.get("reviewer_note", ""),
                **question,
            }
    raise HTTPException(status_code=404, detail="Question not found")


@router.patch("/questions/{question_id}")
def admin_patch_question(
    question_id: str,
    payload: ContentTestStatusPatch,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return admin_patch_content_test(question_id=question_id, payload=payload, db=db, _admin=_admin)


@router.post("/questions/{question_id}/validate")
def admin_validate_question(question_id: str, _admin: User = Depends(require_admin)):
    return admin_validate_content_test(question_id=question_id, _admin=_admin)


@router.post("/questions/{question_id}/approve")
def admin_approve_question(question_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return admin_approve_test(question_id=question_id, db=db, _admin=_admin)


@router.post("/questions/{question_id}/reject")
def admin_reject_question(question_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return admin_reject_test(question_id=question_id, db=db, _admin=_admin)
