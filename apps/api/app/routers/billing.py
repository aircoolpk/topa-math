from dataclasses import dataclass
from datetime import UTC, datetime
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models import ChildProfile, User
from app.routers.deps import current_user

try:
    import stripe
except ImportError:  # pragma: no cover - dependency is declared, this keeps app importable before install.
    stripe = None


router = APIRouter(tags=["billing"])
logger = logging.getLogger(__name__)

PAID_SUBSCRIPTION_STATUSES = {"active", "trialing"}
FOUNDER_PLAN_CODES = {"th_founder_monthly", "ep_founder_monthly"}
FOUNDER_COUNT_SUBSCRIPTION_STATUSES = {"active", "trialing", "paid"}
FOUNDER_COUNT_MEMBERSHIP_STATUSES = {"paid", "plus"}
UNPAID_SUBSCRIPTION_STATUSES = {"unpaid", "canceled", "incomplete", "incomplete_expired", "paused"}


@dataclass(frozen=True)
class BillingPlan:
    plan_code: str
    price_env: str
    product_id: str
    display_name: str
    program_type: str
    billing_interval: str
    price_type: str
    amount_thb: int

    @property
    def entitlement_plan_code(self) -> str:
        return "ep_plus" if self.program_type == "EP" else "th_plus"


PLAN_CATALOG: dict[str, BillingPlan] = {
    "th_founder_monthly": BillingPlan(
        plan_code="th_founder_monthly",
        price_env="stripe_price_th_founder_monthly",
        product_id="prod_USgNoW3SqfYosf",
        display_name="Plus TH Founder",
        program_type="TH",
        billing_interval="month",
        price_type="founder",
        amount_thb=199,
    ),
    "ep_founder_monthly": BillingPlan(
        plan_code="ep_founder_monthly",
        price_env="stripe_price_ep_founder_monthly",
        product_id="prod_USgTRV2ZTxagVu",
        display_name="Plus EP Founder",
        program_type="EP",
        billing_interval="month",
        price_type="founder",
        amount_thb=399,
    ),
    "th_plus_monthly": BillingPlan(
        plan_code="th_plus_monthly",
        price_env="stripe_price_th_plus_monthly",
        product_id="prod_USg9dDnZ1L1Wye",
        display_name="Plus TH",
        program_type="TH",
        billing_interval="month",
        price_type="normal",
        amount_thb=299,
    ),
    "ep_plus_monthly": BillingPlan(
        plan_code="ep_plus_monthly",
        price_env="stripe_price_ep_plus_monthly",
        product_id="prod_USgHn9EzVjHbsR",
        display_name="Plus EP",
        program_type="EP",
        billing_interval="month",
        price_type="normal",
        amount_thb=599,
    ),
    "th_plus_yearly_promo": BillingPlan(
        plan_code="th_plus_yearly_promo",
        price_env="stripe_price_th_plus_yearly_promo",
        product_id="prod_USga7vRK8g1M0d",
        display_name="Plus TH Year Promotion",
        program_type="TH",
        billing_interval="year",
        price_type="yearly_promo",
        amount_thb=2990,
    ),
    "ep_plus_yearly_promo": BillingPlan(
        plan_code="ep_plus_yearly_promo",
        price_env="stripe_price_ep_plus_yearly_promo",
        product_id="prod_USgai3JWRR6tQ2",
        display_name="Plus EP Year Promotion",
        program_type="EP",
        billing_interval="year",
        price_type="yearly_promo",
        amount_thb=5990,
    ),
}


class CheckoutSessionIn(BaseModel):
    plan_code: str


def _profile(db: Session, user: User) -> ChildProfile:
    child = db.scalar(select(ChildProfile).where(ChildProfile.parent_user_id == user.id))
    if not child:
        raise HTTPException(status_code=404, detail="ไม่พบโปรไฟล์นักเรียน")
    return child


def _optional_profile(db: Session, user: User) -> ChildProfile | None:
    return db.scalar(select(ChildProfile).where(ChildProfile.parent_user_id == user.id))


def _env_name(settings_attr: str) -> str:
    return settings_attr.upper()


def _require_setting(settings_attr: str) -> Any:
    value = getattr(get_settings(), settings_attr, None)
    if value is None or value == "":
        raise HTTPException(status_code=500, detail=f"Stripe configuration missing: {_env_name(settings_attr)}")
    return value


def _require_stripe() -> Any:
    if stripe is None:
        raise HTTPException(status_code=500, detail="Stripe dependency is not installed")
    stripe.api_key = _require_setting("stripe_secret_key")
    return stripe


def _price_id_for_plan(plan: BillingPlan) -> str:
    return str(_require_setting(plan.price_env))


def is_founder_plan(plan_or_code: BillingPlan | str | None) -> bool:
    plan_code = plan_or_code.plan_code if isinstance(plan_or_code, BillingPlan) else plan_or_code
    return str(plan_code or "") in FOUNDER_PLAN_CODES


def get_founder_used_count(db: Session) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(ChildProfile)
            .where(
                ChildProfile.active_price_code.in_(FOUNDER_PLAN_CODES),
                ChildProfile.subscription_status.in_(FOUNDER_COUNT_SUBSCRIPTION_STATUSES),
                ChildProfile.membership_status.in_(FOUNDER_COUNT_MEMBERSHIP_STATUSES),
            )
        )
        or 0
    )


def _founder_limit() -> int:
    return max(0, int(get_settings().founder_price_limit or 100))


def _founder_slots(db: Session) -> dict:
    limit = _founder_limit()
    used = get_founder_used_count(db)
    return {
        "founder_limit": limit,
        "founder_used": used,
        "founder_slots_remaining": max(0, limit - used),
        "founder_shared_pool": True,
    }


def _unix_to_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    return datetime.fromtimestamp(int(value), tz=UTC)


def _stripe_get(obj: Any, key: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    getter = getattr(obj, "get", None)
    if callable(getter):
        return getter(key, default)
    return getattr(obj, key, default)


def _id(value: Any) -> str | None:
    if isinstance(value, str):
        return value
    return _stripe_get(value, "id")


def _plan_from_price_id(price_id: str | None) -> BillingPlan | None:
    if not price_id:
        return None
    settings = get_settings()
    for plan in PLAN_CATALOG.values():
        if getattr(settings, plan.price_env, None) == price_id:
            return plan
    return None


def _find_child_for_event(db: Session, *, user_id: str | None = None, customer_id: str | None = None, subscription_id: str | None = None) -> ChildProfile | None:
    if user_id:
        child = db.scalar(select(ChildProfile).where(ChildProfile.parent_user_id == user_id))
        if child:
            return child
    filters = []
    if subscription_id:
        filters.append(ChildProfile.stripe_subscription_id == subscription_id)
    if customer_id:
        filters.append(ChildProfile.stripe_customer_id == customer_id)
    if not filters:
        return None
    return db.scalar(select(ChildProfile).where(or_(*filters)))


def _apply_paid_plan(child: ChildProfile, plan: BillingPlan) -> None:
    child.membership_status = "plus"
    child.plan_code = plan.entitlement_plan_code
    child.active_price_code = plan.plan_code
    child.price_type = plan.price_type
    child.billing_program_type = plan.program_type
    child.paid_at = child.paid_at or datetime.now(UTC)
    child.canceled_at = None


def _clear_paid_access(child: ChildProfile) -> None:
    child.membership_status = "free"
    child.plan_code = "free"
    child.active_price_code = None
    child.price_type = None
    child.billing_program_type = None


def _apply_subscription_state(child: ChildProfile, subscription: Any, *, plan: BillingPlan | None = None) -> None:
    subscription_id = _id(subscription)
    customer_id = _id(_stripe_get(subscription, "customer"))
    status_value = str(_stripe_get(subscription, "status", "none") or "none")
    price_id = None
    items = _stripe_get(subscription, "items")
    data = _stripe_get(items, "data", []) if items else []
    if data:
        price_id = _id(_stripe_get(data[0], "price"))
    plan = plan or _plan_from_price_id(price_id) or PLAN_CATALOG.get(child.active_price_code or "")

    child.stripe_customer_id = customer_id or child.stripe_customer_id
    child.stripe_subscription_id = subscription_id or child.stripe_subscription_id
    child.subscription_status = status_value
    child.current_period_end = _unix_to_datetime(_stripe_get(subscription, "current_period_end"))
    child.cancel_at_period_end = bool(_stripe_get(subscription, "cancel_at_period_end", False))

    if status_value in PAID_SUBSCRIPTION_STATUSES and plan:
        _apply_paid_plan(child, plan)
    elif status_value in UNPAID_SUBSCRIPTION_STATUSES:
        _clear_paid_access(child)
        if status_value in {"canceled", "incomplete_expired"}:
            child.canceled_at = child.canceled_at or datetime.now(UTC)


def _status_payload(child: ChildProfile) -> dict:
    return {
        "membership_status": child.membership_status or "free",
        "plan_code": child.plan_code or "free",
        "active_price_code": child.active_price_code,
        "price_type": child.price_type,
        "program_type": child.billing_program_type,
        "subscription_status": child.subscription_status or "none",
        "current_period_end": child.current_period_end.isoformat() if child.current_period_end else None,
        "cancel_at_period_end": bool(child.cancel_at_period_end),
    }


@router.get("/billing/prices")
def billing_prices(db: Session = Depends(get_db)) -> dict:
    founder = _founder_slots(db)
    free_plan = {
        "plan_code": "free",
        "display_name": "\u0e17\u0e14\u0e25\u0e2d\u0e07\u0e43\u0e0a\u0e49\u0e1f\u0e23\u0e35",
        "program_type": "FREE",
        "price_thb": 0,
        "billing_interval": "none",
        "price_type": "free",
        "available": True,
    }
    return {
        "plans": [
            free_plan,
            *[
            (
                {
                    "plan_code": plan.plan_code,
                    "display_name": plan.display_name,
                    "program_type": plan.program_type,
                    "price_thb": plan.amount_thb,
                    "billing_interval": plan.billing_interval,
                    "price_type": plan.price_type,
                    "product_id": plan.product_id,
                    "available": founder["founder_slots_remaining"] > 0,
                    **founder,
                    "note_th": "\u0e08\u0e33\u0e01\u0e31\u0e14\u0e23\u0e27\u0e21 100 \u0e2a\u0e34\u0e17\u0e18\u0e34\u0e4c\u0e41\u0e23\u0e01",
                }
                if is_founder_plan(plan)
                else {
                    "plan_code": plan.plan_code,
                    "display_name": plan.display_name,
                    "program_type": plan.program_type,
                    "price_thb": plan.amount_thb,
                    "billing_interval": plan.billing_interval,
                    "price_type": plan.price_type,
                    "product_id": plan.product_id,
                    "available": True,
                }
            )
            for plan in PLAN_CATALOG.values()
            ],
        ]
    }


def _dev_plan_payload(plan: BillingPlan) -> dict:
    return {
        "id": plan.plan_code,
        "plan_code": plan.plan_code,
        "name": plan.display_name,
        "display_name": plan.display_name,
        "program_type": plan.program_type,
        "price_monthly": plan.amount_thb if plan.billing_interval == "month" else None,
        "price_thb": plan.amount_thb,
        "currency": "THB",
        "billing_interval": plan.billing_interval,
        "price_type": plan.price_type,
        "description": (
            "บทเรียน EP พร้อมคำแปลไทย"
            if plan.program_type == "EP"
            else "บทเรียนภาษาไทย ป.1-ป.6"
        ),
        "features": (
            [
                "บทเรียนภาษาอังกฤษง่าย",
                "มีคำแปลไทย",
                "Singapore Math diagrams",
                "แบบฝึกหัด EP",
            ]
            if plan.program_type == "EP"
            else [
                "บทเรียนภาษาไทย",
                "แบบฝึกหัดรายวัน",
                "ระบบวิเคราะห์จุดอ่อน",
                "ภารกิจ XP และเลเวล",
            ]
        ),
        "stripe_price_id": getattr(get_settings(), plan.price_env, None),
        "product_id": plan.product_id,
        "is_available": True,
        "available": True,
    }


@router.get("/billing/plans")
def billing_plans(db: Session = Depends(get_db)) -> dict:
    logger.info("GET /billing/plans")
    founder = _founder_slots(db)
    plans = [
        {
            "id": "free",
            "plan_code": "free",
            "name": "Free",
            "display_name": "Free",
            "program_type": "FREE",
            "price_monthly": 0,
            "price_thb": 0,
            "currency": "THB",
            "billing_interval": "none",
            "price_type": "free",
            "description": "ทดลองใช้งาน",
            "features": [
                "ทดลองเรียนฟรี",
                "เรียนได้ 3 เควส",
                "ทำภารกิจระดับเริ่มต้น",
                "Avatar พื้นฐาน",
            ],
            "is_current": False,
            "is_available": True,
            "available": True,
        },
        {
            "id": "thp_monthly",
            "plan_code": "thp_monthly",
            "name": "Thai Program",
            "display_name": "Thai Program",
            "program_type": "THP",
            "price_monthly": 299,
            "price_thb": 299,
            "currency": "THB",
            "billing_interval": "month",
            "price_type": "normal",
            "description": "บทเรียนภาษาไทย ป.1-ป.6",
            "features": [
                "บทเรียนภาษาไทย",
                "แบบฝึกหัดรายวัน",
                "ระบบวิเคราะห์จุดอ่อน",
                "ภารกิจ XP และเลเวล",
            ],
            "stripe_price_id": getattr(get_settings(), "stripe_price_th_plus_monthly", None),
            "is_available": True,
            "available": True,
            "checkout_plan_code": "th_plus_monthly",
        },
        {
            "id": "ep_monthly",
            "plan_code": "ep_monthly",
            "name": "English Program",
            "display_name": "English Program",
            "program_type": "EP",
            "price_monthly": 499,
            "price_thb": 499,
            "currency": "THB",
            "billing_interval": "month",
            "price_type": "normal",
            "description": "บทเรียน EP พร้อมคำแปลไทย",
            "features": [
                "บทเรียนภาษาอังกฤษง่าย",
                "มีคำแปลไทย",
                "Singapore Math diagrams",
                "แบบฝึกหัด EP",
            ],
            "stripe_price_id": getattr(get_settings(), "stripe_price_ep_plus_monthly", None),
            "is_available": True,
            "available": True,
            "checkout_plan_code": "ep_plus_monthly",
        },
        {
            "id": "family_monthly",
            "plan_code": "family_monthly",
            "name": "Family",
            "display_name": "Family",
            "program_type": "BOTH",
            "price_monthly": 799,
            "price_thb": 799,
            "currency": "THB",
            "billing_interval": "month",
            "price_type": "normal",
            "description": "เหมาะสำหรับครอบครัว",
            "features": [
                "ใช้ได้ทั้ง THP และ EP",
                "รองรับหลายโปรไฟล์เด็ก",
                "รายงานผลรายสัปดาห์",
                "สิทธิ์ครบทุกบทเรียน",
            ],
            "stripe_price_id": None,
            "is_available": True,
            "available": True,
        },
    ]
    return {"plans": plans, **founder, "source": "backend"}


@router.post("/billing/create-checkout-session")
def create_checkout_session(payload: CheckoutSessionIn, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    logger.info("Stripe checkout endpoint called plan_code=%s", payload.plan_code)
    plan = PLAN_CATALOG.get(payload.plan_code)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan_code")
    if is_founder_plan(plan) and _founder_slots(db)["founder_slots_remaining"] <= 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="\u0e2a\u0e34\u0e17\u0e18\u0e34\u0e4c Founder Price \u0e04\u0e23\u0e1a\u0e41\u0e25\u0e49\u0e27 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e41\u0e1e\u0e47\u0e01\u0e40\u0e01\u0e08\u0e23\u0e32\u0e04\u0e32\u0e1b\u0e01\u0e15\u0e34",
        )
    price_id = _price_id_for_plan(plan)
    frontend_base_url = str(_require_setting("frontend_base_url"))
    stripe_client = _require_stripe()
    child = _optional_profile(db, user)
    logger.info("Stripe checkout using price env var %s for plan_code=%s", _env_name(plan.price_env), plan.plan_code)

    customer_id = child.stripe_customer_id if child else None
    if not customer_id:
        customer = stripe_client.Customer.create(
            email=user.email,
            metadata={"user_id": user.id, **({"child_id": child.id} if child else {})},
        )
        customer_id = _id(customer)
        if child:
            child.stripe_customer_id = customer_id
            db.commit()

    session = stripe_client.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{frontend_base_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{frontend_base_url}/pricing?canceled=1",
        client_reference_id=user.id,
        metadata={
            "user_id": user.id,
            **({"child_id": child.id} if child else {}),
            "plan_code": plan.plan_code,
            "program_type": plan.program_type,
            "price_type": plan.price_type,
            "product_id": plan.product_id,
        },
    )
    logger.info("Stripe checkout session created plan_code=%s session_id=%s", plan.plan_code, _id(session))
    return {
        "checkout_url": _stripe_get(session, "url"),
        "plan_code": plan.plan_code,
        "price_type": plan.price_type,
        "program_type": plan.program_type,
    }


@router.post("/billing/create-portal-session")
def create_portal_session(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    stripe_client = _require_stripe()
    child = _profile(db, user)
    if not child.stripe_customer_id:
        raise HTTPException(status_code=400, detail="\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e39\u0e01\u0e04\u0e49\u0e32 Stripe")
    settings = get_settings()
    portal = stripe_client.billing_portal.Session.create(
        customer=child.stripe_customer_id,
        return_url=settings.stripe_customer_portal_return_url or f"{settings.frontend_base_url}/dashboard",
    )
    return {"portal_url": _stripe_get(portal, "url")}


@router.get("/billing/status")
def billing_status(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    return _status_payload(_profile(db, user))


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    stripe_client = _require_stripe()
    settings = get_settings()
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=500, detail="Stripe configuration missing: STRIPE_WEBHOOK_SECRET")
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    try:
        event = stripe_client.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe signature") from exc

    event_type = _stripe_get(event, "type")
    data_object = _stripe_get(_stripe_get(event, "data", {}), "object", {})

    if event_type == "checkout.session.completed":
        metadata = _stripe_get(data_object, "metadata", {}) or {}
        selected_plan_code = _stripe_get(metadata, "plan_code")
        selected_plan = PLAN_CATALOG.get(str(selected_plan_code or ""))
        user_id = _stripe_get(metadata, "user_id") or _stripe_get(data_object, "client_reference_id")
        subscription_id = _id(_stripe_get(data_object, "subscription"))
        customer_id = _id(_stripe_get(data_object, "customer"))
        child = _find_child_for_event(db, user_id=user_id, customer_id=customer_id, subscription_id=subscription_id)
        if child:
            child.stripe_customer_id = customer_id or child.stripe_customer_id
            child.stripe_subscription_id = subscription_id or child.stripe_subscription_id
            if selected_plan:
                child.active_price_code = selected_plan.plan_code
                child.price_type = selected_plan.price_type
                child.billing_program_type = selected_plan.program_type
            if subscription_id:
                subscription = stripe_client.Subscription.retrieve(subscription_id)
                _apply_subscription_state(child, subscription, plan=selected_plan)

    elif event_type in {"customer.subscription.created", "customer.subscription.updated"}:
        subscription_id = _id(data_object)
        customer_id = _id(_stripe_get(data_object, "customer"))
        child = _find_child_for_event(db, customer_id=customer_id, subscription_id=subscription_id)
        if child:
            _apply_subscription_state(child, data_object)

    elif event_type == "customer.subscription.deleted":
        subscription_id = _id(data_object)
        customer_id = _id(_stripe_get(data_object, "customer"))
        child = _find_child_for_event(db, customer_id=customer_id, subscription_id=subscription_id)
        if child:
            _clear_paid_access(child)
            child.subscription_status = "canceled"
            child.cancel_at_period_end = False
            child.canceled_at = datetime.now(UTC)

    elif event_type == "invoice.paid":
        subscription_id = _id(_stripe_get(data_object, "subscription"))
        customer_id = _id(_stripe_get(data_object, "customer"))
        child = _find_child_for_event(db, customer_id=customer_id, subscription_id=subscription_id)
        if child and subscription_id:
            subscription = stripe_client.Subscription.retrieve(subscription_id)
            _apply_subscription_state(child, subscription)

    elif event_type == "invoice.payment_failed":
        subscription_id = _id(_stripe_get(data_object, "subscription"))
        customer_id = _id(_stripe_get(data_object, "customer"))
        child = _find_child_for_event(db, customer_id=customer_id, subscription_id=subscription_id)
        if child:
            child.subscription_status = "past_due"

    db.commit()
    return {"received": True}
