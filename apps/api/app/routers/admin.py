from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import AIGenerationJob, AdminAuditLog, ChildProfile, Lesson, Question, Skill, Subject, User
from app.routers.deps import require_admin
from app.services.content_quality import content_quality_report
from app.services.lesson_content import (
    find_lesson_file,
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

router = APIRouter(prefix="/admin", tags=["admin"])


ACTIVE_SUBSCRIPTION_STATUSES = {"active", "trialing", "paid"}
PAID_MEMBERSHIP_STATUSES = {"paid", "plus"}
MANUAL_ACTIVE_STATUSES = {"active", "trial", "trialing", "manual_grant"}
PLAN_TYPES = {"free", "thp", "ep", "family", "reviewer"}
PROGRAM_TYPES = {"FREE", "THP", "EP", "BOTH"}
ADMIN_SUBSCRIPTION_STATUSES = {"free", "active", "trial", "manual_grant", "expired", "canceled"}


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
    plan_type: str
    program_type: str
    subscription_status: str
    access_ends_at: datetime | None = None
    admin_note: str | None = None
    manual_grant_reason: str | None = None


class AdminExtendIn(BaseModel):
    days: int = 30
    admin_note: str | None = None


class AdminActionNoteIn(BaseModel):
    admin_note: str | None = None


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
    _admin: User = Depends(require_admin),
):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Lesson payload must be an object")
    validation = validate_lesson_content(payload)
    if not validation["valid"]:
        raise HTTPException(status_code=422, detail=validation)
    path, backup = save_lesson(lesson_id, program_type, payload)
    return {
        "lesson_id": lesson_id,
        "saved": True,
        "path": str(path),
        "backup_path": str(backup) if backup else None,
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
    question = db.get(Question, question_id)
    if question:
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
        return {"question_id": question.id, "saved": True, "validation": validation}

    updated = update_question_payload(question_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Question not found")
    validation = validate_question_payload(updated)
    if not validation["valid"]:
        raise HTTPException(status_code=422, detail=validation)
    return {"question_id": question_id, "saved": True, "question": updated, "validation": validation}


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


def _admin_user_payload(user: User) -> dict[str, Any]:
    children = list(user.children or [])
    primary = children[0] if children else None
    return {
        "user_id": user.id,
        "name": primary.nickname if primary else user.email.split("@")[0],
        "email": user.email,
        "role": user.role,
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
        "last_login_at": None,
        "number_of_child_profiles": len(children),
        "actions": ["view_user", "change_role", "change_plan", "extend_subscription", "cancel_subscription", "reactivate_subscription", "set_free"],
    }


@router.get("/users")
def users(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    expire_overdue_manual_grants(db, _admin)
    db.commit()
    rows = db.execute(select(User).order_by(User.created_at.desc())).scalars().all()
    return {"users": [_admin_user_payload(user) for user in rows]}


@router.get("/users/{user_id}")
def get_user(user_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    expire_overdue_manual_grants(db, _admin)
    db.commit()
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _admin_user_payload(user)


def _require_child(user: User) -> ChildProfile:
    child = _primary_child(user)
    if not child:
        raise HTTPException(status_code=400, detail="User has no child profile to update")
    return child


def _apply_plan(child: ChildProfile, payload: AdminPlanPatch) -> None:
    plan_type = payload.plan_type.lower()
    program_type = payload.program_type.upper()
    status = payload.subscription_status.lower()
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
    child.current_period_end = payload.access_ends_at
    child.access_ends_at = payload.access_ends_at
    child.admin_note = payload.admin_note
    child.manual_grant_reason = payload.manual_grant_reason
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
    if payload.role not in {"parent", "admin", "owner", "editor", "viewer"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    old = _child_snapshot(_primary_child(user), user)
    user.role = payload.role
    _audit(db, action="change_role", target_user_id=user.id, old_value=old, new_value=_child_snapshot(_primary_child(user), user), admin=_admin, note=payload.admin_note)
    db.commit()
    db.refresh(user)
    return _admin_user_payload(user)


@router.patch("/users/{user_id}/plan")
def change_user_plan(user_id: str, payload: AdminPlanPatch, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    child = _require_child(user)
    old = _child_snapshot(child, user)
    _apply_plan(child, payload)
    _audit(db, action="change_plan", target_user_id=user.id, old_value=old, new_value=_child_snapshot(child, user), admin=_admin, note=payload.admin_note)
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


@router.get("/subscriptions")
def subscriptions(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    rows = db.execute(select(ChildProfile, User).join(User, ChildProfile.parent_user_id == User.id).order_by(ChildProfile.created_at.desc())).all()
    return {"subscriptions": [_child_subscription_payload(child, user) for child, user in rows]}


@router.get("/revenue")
def revenue(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    return _revenue_summary(db)


@router.get("/lessons")
def lessons(db: Session = Depends(get_db), _admin=Depends(require_admin)):
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
        seen.add(public_id)
        items.append(_lesson_payload(db, lesson, skill, subject, quality_by_id.get(public_id)))
    for quality in quality_by_id.values():
        lesson_id = str(quality.get("lesson_id"))
        if lesson_id in seen:
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
    return {"lessons": items}


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
        raise HTTPException(status_code=404, detail="Lesson not found")
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
