from app.models import ChildProfile


PAID_MEMBERSHIP_STATUSES = {"paid", "plus", "trial"}


def recommended_foundation_grade(grade_level: int) -> int:
    if grade_level <= 1:
        return 1
    return max(1, min(6, grade_level - 1))


def remaining_free_tests(child: ChildProfile) -> int:
    limit = child.free_test_limit or 5
    used = child.test_attempts_used or 0
    return max(0, limit - used)


def is_paid(child: ChildProfile) -> bool:
    return (child.membership_status or "free").lower() in PAID_MEMBERSHIP_STATUSES


def is_th_plus(child: ChildProfile) -> bool:
    return is_paid(child) and (child.plan_code or "").lower() in {"th_plus", "ep_plus", "plus_monthly"}


def is_ep_plus(child: ChildProfile) -> bool:
    if not is_paid(child):
        return False
    program_fields = {
        (child.billing_program_type or "").upper(),
        (child.program_type or "").upper(),
    }
    plan_fields = " ".join(
        str(value or "").lower()
        for value in (
            child.plan_code,
            child.plan_type,
            child.active_price_code,
            child.price_type,
            child.manual_grant_reason,
        )
    )
    return bool(program_fields & {"EP", "BOTH"}) or "ep_" in plan_fields or "ep-plus" in plan_fields


def can_access_program(child: ChildProfile, program_type: str | None) -> bool:
    normalized = (program_type or "TH").upper()
    if normalized == "EP":
        return is_ep_plus(child)
    return is_th_plus(child) or is_ep_plus(child) or is_paid(child)
