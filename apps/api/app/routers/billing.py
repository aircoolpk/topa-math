from dataclasses import dataclass
from datetime import UTC, datetime
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models import ChildProfile, User
from app.routers.deps import current_user
from app.services.affiliates import create_commission_for_payment, reverse_commission_for_payment
from app.services.referrals import award_paid_referral_if_needed
from app.services import mpp_checkout
from app.models.mpp_purchase import MppPackagePrice, MppPurchaseOrder
from app.models.checkout_reservation import CheckoutReservation
from app.services.checkout_policy import default_gateway, require_mpp_access

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
    features: tuple[str, ...] = ()

    @property
    def entitlement_plan_code(self) -> str:
        return "ep_plus" if self.program_type == "EP" else "th_plus"


# Feature lists are the single source of truth for TH / EP benefits shown on
# the pricing & billing pages. They were previously hardcoded as DEFAULT_*_FEATURES
# in the frontend; centralising them here lets the admin adjust copy without
# shipping new frontend builds.

TH_PLAN_FEATURES: tuple[str, ...] = (
    "ปลดล็อกบทเรียนคณิต ป.1-ป.6 ทั้งหมด",
    "แบบทดสอบทุกระดับชั้น ไม่จำกัด",
    "ระบบ AI วิเคราะห์จุดอ่อน",
    "แบบฝึกเฉพาะบุคคล",
    "Quest รายวัน / สัปดาห์ / เดือน",
    "XP / Level / Rank ทั่วประเทศ",
    "Avatar และของตกแต่งพื้นฐาน",
)

EP_PLAN_FEATURES: tuple[str, ...] = (
    "ทุกอย่างในแพ็กเกจ TH",
    "โหมด English Program (EP)",
    "โจทย์และบทเรียนคณิตเป็นภาษาอังกฤษ",
    "คำศัพท์คณิตศาสตร์ภาษาอังกฤษ",
    "เหมาะกับเด็ก EP / Inter / สองภาษา",
    "ปลดล็อกทั้ง TH และ EP ในบัญชีเดียว",
)


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
        features=TH_PLAN_FEATURES,
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
        features=EP_PLAN_FEATURES,
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
        features=TH_PLAN_FEATURES,
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
        features=EP_PLAN_FEATURES,
    ),
    "th_plus_yearly_promo": BillingPlan(
        plan_code="th_plus_yearly_promo",
        price_env="stripe_price_th_plus_yearly",
        product_id="prod_USga7vRK8g1M0d",
        display_name="Plus TH Year Promotion",
        program_type="TH",
        billing_interval="year",
        price_type="yearly_promo",
        amount_thb=2990,
        features=TH_PLAN_FEATURES,
    ),
    "ep_plus_yearly_promo": BillingPlan(
        plan_code="ep_plus_yearly_promo",
        price_env="stripe_price_ep_plus_yearly",
        product_id="prod_USgai3JWRR6tQ2",
        display_name="Plus EP Year Promotion",
        program_type="EP",
        billing_interval="year",
        price_type="yearly_promo",
        amount_thb=5990,
        features=EP_PLAN_FEATURES,
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


def _stripe_checkout_ready(plan: BillingPlan) -> tuple[bool, str | None]:
    settings = get_settings()
    if stripe is None:
        return False, "stripe_dependency"
    if not getattr(settings, "stripe_secret_key", None):
        return False, "stripe_secret_key"
    if not getattr(settings, plan.price_env, None):
        return False, plan.price_env
    return True, None


def _manual_pending_checkout(db: Session, user: User, child: ChildProfile | None, plan: BillingPlan, *, reason: str | None = None) -> dict:
    now = datetime.now(UTC)
    request_owner_id = child.id if child else user.id
    request_id = f"pending-{request_owner_id}"
    if child:
        child.subscription_status = "pending"
        child.active_price_code = plan.plan_code
        child.price_type = plan.price_type
        child.billing_program_type = plan.program_type
        child.admin_note = f"Manual beta payment pending: {plan.plan_code}"
        child.manual_grant_reason = f"pending_payment:{plan.plan_code}"[:120]
        db.commit()
    logger.warning(
        "Manual beta payment pending user_id=%s child_id=%s plan_code=%s reason=%s",
        user.id,
        child.id if child else None,
        plan.plan_code,
        reason,
    )
    return {
        "mode": "manual_pending",
        "status": "pending",
        "message": "\u0e2a\u0e48\u0e07\u0e04\u0e33\u0e02\u0e2d\u0e2a\u0e21\u0e31\u0e04\u0e23\u0e41\u0e1e\u0e47\u0e01\u0e40\u0e01\u0e08\u0e41\u0e25\u0e49\u0e27 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e2d\u0e1c\u0e39\u0e49\u0e14\u0e39\u0e41\u0e25\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19",
        "payment_request": {
            "id": request_id,
            "user_id": user.id,
            "plan": plan.plan_code,
            "program": plan.program_type,
            "billing_period": plan.billing_interval,
            "price": plan.amount_thb,
            "status": "pending",
            "created_at": now.isoformat(),
        },
        "plan_code": plan.plan_code,
        "price_type": plan.price_type,
        "program_type": plan.program_type,
    }


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
                or_(and_(or_(ChildProfile.membership_provider.is_(None), ChildProfile.membership_provider != 'mpp'), ChildProfile.subscription_status.in_(FOUNDER_COUNT_SUBSCRIPTION_STATUSES)), and_(ChildProfile.membership_provider == 'mpp', ChildProfile.mpp_access_ends_at > datetime.now(UTC))),
                ChildProfile.membership_status.in_(FOUNDER_COUNT_MEMBERSHIP_STATUSES),
            )
        )
        or 0
    )


def _founder_limit() -> int:
    settings = get_settings()
    return max(0, int(settings.founder_user_limit or settings.founder_price_limit or 100))


def _founder_slots(db: Session) -> dict:
    limit = _founder_limit()
    used = get_founder_used_count(db)
    reserved = int(db.scalar(select(func.count()).select_from(MppPurchaseOrder).where(MppPurchaseOrder.plan_code.in_(FOUNDER_PLAN_CODES), MppPurchaseOrder.status == 'PENDING')) or 0)
    return {
        "founder_limit": limit,
        "founder_used": used,
        "founder_slots_remaining": max(0, limit - used - reserved),
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


def _invoice_payment_reference(invoice_id: str | None) -> str | None:
    return f"stripe_invoice:{invoice_id}" if invoice_id else None


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
    if child.membership_provider == 'mpp':
        from app.services.foundation import is_paid
        if is_paid(child):
            return
        child.membership_provider = 'stripe'
    child.membership_status = "plus"
    child.plan_code = plan.entitlement_plan_code
    child.active_price_code = plan.plan_code
    child.price_type = plan.price_type
    child.billing_program_type = plan.program_type
    child.paid_at = child.paid_at or datetime.now(UTC)
    child.canceled_at = None


def _clear_paid_access(child: ChildProfile) -> None:
    if child.membership_provider == 'mpp':
        return
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
    if child.membership_provider == 'mpp':
        from app.services.foundation import is_paid
        paid = is_paid(child)
        return {'provider': 'mpp', 'auto_renew': False, 'membership_status': 'plus' if paid else 'free', 'plan_code': child.plan_code if paid else 'free', 'plan': 'plus' if paid else 'free', 'is_paid': paid, 'active_price_code': child.active_price_code, 'price_type': child.price_type, 'program_type': child.billing_program_type, 'subscription_status': 'active' if paid else 'expired', 'subscription_id': None, 'current_period_end': child.mpp_access_ends_at.isoformat() if child.mpp_access_ends_at else None, 'cancel_at_period_end': False}
    membership_status = child.membership_status or "free"
    subscription_status = child.subscription_status or "none"
    is_paid = membership_status in {"paid", "plus"} and subscription_status in {
        "active",
        "trialing",
        "trial",
        "manual_grant",
    }
    return {
        "membership_status": membership_status,
        "plan_code": child.plan_code or "free",
        "plan": "plus" if is_paid else "free",
        "is_paid": is_paid,
        "active_price_code": child.active_price_code,
        "price_type": child.price_type,
        "program_type": child.billing_program_type,
        "subscription_status": subscription_status,
        "subscription_id": child.stripe_subscription_id,
        "current_period_end": child.current_period_end.isoformat() if child.current_period_end else None,
        "cancel_at_period_end": bool(child.cancel_at_period_end),
    }


@router.get("/billing/prices")
def billing_prices(db: Session = Depends(get_db)) -> dict:
    founder = _founder_slots(db)
    settings = get_settings()
    founder_only = bool(settings.founder_pricing_enabled) and founder["founder_slots_remaining"] > 0
    free_plan = {
        "plan_code": "free",
        "display_name": "\u0e17\u0e14\u0e25\u0e2d\u0e07\u0e43\u0e0a\u0e49\u0e1f\u0e23\u0e35",
        "program_type": "FREE",
        "price_thb": 0,
        "billing_interval": "none",
        "price_type": "free",
        "available": True,
    }
    visible_plans = [
        plan
        for plan in PLAN_CATALOG.values()
        if is_founder_plan(plan) or not founder_only
    ]
    result = {
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
                                "stripe_price_id": getattr(settings, plan.price_env, None),
                                "available": founder["founder_slots_remaining"] > 0,
                                **founder,
                                "note_th": "\u0e08\u0e33\u0e01\u0e31\u0e14\u0e23\u0e27\u0e21 100 \u0e2a\u0e34\u0e17\u0e18\u0b34\u0e4c\u0e41\u0e23\u0e01",
                                "features": list(plan.features),
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
                                "stripe_price_id": getattr(settings, plan.price_env, None),
                                "available": True,
                                "features": list(plan.features),
                            }
                        )
            for plan in visible_plans
            ],
        ]
    }
    for item in result['plans']:
        if item['plan_code'] == 'free':
            continue
        if default_gateway() == 'stripe':
            item['auto_renew'] = True
            continue
        price = db.get(MppPackagePrice, item['plan_code'])
        item['price_minor'] = price.amount_minor if price else None
        item['duration_days'] = price.duration_days if price else None
        item['auto_renew'] = False
        item['available'] = bool(item.get('available', True) and price and price.active)
    result['checkout_provider'] = default_gateway()
    return result


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
        "features": list(plan.features) if plan.features else (
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
    settings = get_settings()
    if bool(settings.founder_pricing_enabled) and founder["founder_slots_remaining"] > 0:
        plans = [
            {"id": "free", "plan_code": "free", "name": "Free", "display_name": "Free", "program_type": "FREE", "price_monthly": 0, "price_thb": 0, "currency": "THB", "billing_interval": "none", "price_type": "free", "stripe_price_id": None, "is_available": True, "available": True},
            {**_dev_plan_payload(PLAN_CATALOG["th_founder_monthly"]), "checkout_plan_code": "th_founder_monthly", **founder},
            {**_dev_plan_payload(PLAN_CATALOG["ep_founder_monthly"]), "checkout_plan_code": "ep_founder_monthly", **founder},
        ]
        return {"plans": plans, **founder, "source": "backend"}
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


@router.post("/billing/mpp/checkout")
def create_mpp_checkout(payload: CheckoutSessionIn, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    plan = PLAN_CATALOG.get(payload.plan_code)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan_code")
    order = mpp_checkout.new_or_pending_order(db, user, plan.plan_code)
    return mpp_checkout.view(mpp_checkout.submit_order(db, user, order.id))


@router.post('/billing/create-checkout-session')
def create_checkout_session(payload: CheckoutSessionIn, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    if payload.plan_code not in PLAN_CATALOG:
        raise HTTPException(400, 'Invalid plan_code')
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    pending = db.scalar(select(MppPurchaseOrder).where(MppPurchaseOrder.user_id == user.id, MppPurchaseOrder.status == 'PENDING'))
    if pending:
        if pending.plan_code != payload.plan_code:
            raise HTTPException(409, {'code': 'CHECKOUT_PROVIDER_LOCKED', 'provider': 'mpp'})
        result = mpp_checkout.view(pending)
        if not result['checkout_url']:
            raise HTTPException(409, {'code': 'CHECKOUT_RECONCILIATION_REQUIRED', 'provider': 'mpp', 'order_id': pending.id})
        return result
    reservation = db.scalar(select(CheckoutReservation).where(CheckoutReservation.user_id == user.id, CheckoutReservation.status == 'PENDING'))
    if reservation:
        if reservation.plan_code != payload.plan_code or not reservation.checkout_url:
            raise HTTPException(409, {'code': 'CHECKOUT_RECONCILIATION_REQUIRED', 'provider': reservation.provider})
        return {'provider': reservation.provider, 'order_id': reservation.id, 'checkout_url': reservation.checkout_url}
    if default_gateway() == 'mpp':
        require_mpp_access(user)
        return create_mpp_checkout(payload, db, user)
    child = _optional_profile(db, user)
    if child:
        mpp_checkout.reject_live_stripe(child)
        if child.membership_provider == 'mpp' and mpp_checkout.utc(child.mpp_access_ends_at) and mpp_checkout.utc(child.mpp_access_ends_at) > datetime.now(UTC):
            raise HTTPException(409, {'code': 'EXISTING_MPP_MEMBERSHIP'})
    if is_founder_plan(PLAN_CATALOG[payload.plan_code]) and _founder_slots(db)['founder_slots_remaining'] <= 0:
        raise HTTPException(409, {'code': 'FOUNDER_FULL'})
    reservation = CheckoutReservation(user_id=user.id, provider='stripe', plan_code=payload.plan_code)
    db.add(reservation)
    db.commit()
    result = _legacy_stripe_checkout_session(payload, db, user, idempotency_key=reservation.id)
    reservation.external_id = result.get('session_id')
    reservation.checkout_url = result.get('checkout_url')
    db.commit()
    return {'provider': 'stripe', 'order_id': reservation.id, **result}


@router.get('/billing/checkouts/{reservation_id}')
def checkout_reservation_status(reservation_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    row = db.scalar(select(CheckoutReservation).where(CheckoutReservation.id == reservation_id, CheckoutReservation.user_id == user.id))
    if not row:
        raise HTTPException(404, 'Checkout not found')
    return {'order_id': row.id, 'provider': row.provider, 'status': row.status}


def _legacy_stripe_checkout_session(payload: CheckoutSessionIn, db: Session, user: User, *, idempotency_key: str | None = None) -> dict:
    """Legacy subscription purchase; gateway choice is enforced by the caller."""
    plan = PLAN_CATALOG.get(payload.plan_code)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan_code")
    child = _optional_profile(db, user)
    checkout_ready, missing_reason = _stripe_checkout_ready(plan)
    if not checkout_ready:
        return _manual_pending_checkout(db, user, child, plan, reason=missing_reason)

    price_id = _price_id_for_plan(plan)
    frontend_base_url = str(_require_setting("frontend_base_url"))
    stripe_client = _require_stripe()
    logger.info("Stripe checkout using price env var %s for plan_code=%s", _env_name(plan.price_env), plan.plan_code)

    customer_id = child.stripe_customer_id if child else None
    if not customer_id:
        try:
            customer = stripe_client.Customer.create(
                idempotency_key=('customer-' + idempotency_key) if idempotency_key else None,
                email=user.email,
                metadata={"user_id": user.id, **({"child_id": child.id} if child else {})},
            )
        except Exception as exc:
            logger.exception("Stripe customer creation failed plan_code=%s", plan.plan_code)
            return _manual_pending_checkout(db, user, child, plan, reason=exc.__class__.__name__)
        customer_id = _id(customer)
        if child:
            child.stripe_customer_id = customer_id
            db.commit()

    try:
        session = stripe_client.checkout.Session.create(
            idempotency_key=idempotency_key,
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{frontend_base_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_base_url}/pricing?canceled=1",
            client_reference_id=user.id,
            metadata={
                'topa_checkout_reservation_id': idempotency_key,
                "user_id": user.id,
                **({"child_id": child.id} if child else {}),
                "plan_code": plan.plan_code,
                "program_type": plan.program_type,
                "price_type": plan.price_type,
                "product_id": plan.product_id,
            },
        )
    except Exception as exc:
        logger.exception("Stripe checkout session failed plan_code=%s", plan.plan_code)
        return _manual_pending_checkout(db, user, child, plan, reason=exc.__class__.__name__)
    logger.info("Stripe checkout session created plan_code=%s session_id=%s", plan.plan_code, _id(session))
    return {
        'session_id': _id(session),
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
    event_id = _id(event)
    data_object = _stripe_get(_stripe_get(event, "data", {}), "object", {})
    if event_type in {'checkout.session.completed', 'checkout.session.expired'}:
        metadata = _stripe_get(data_object, 'metadata', {}) or {}
        reservation_id = _stripe_get(metadata, 'topa_checkout_reservation_id')
        if reservation_id:
            db.scalar(select(User).where(User.id == _stripe_get(metadata, 'user_id')).with_for_update())
            reservation = db.get(CheckoutReservation, reservation_id)
            if reservation and reservation.provider == 'stripe' and reservation.user_id == _stripe_get(metadata, 'user_id') and reservation.external_id in {None, _id(data_object)}:
                if (event_type == 'checkout.session.expired' and reservation.status == 'PENDING') or (event_type == 'checkout.session.completed' and _id(_stripe_get(data_object, 'subscription'))):
                    reservation.external_id = _id(data_object)
                    reservation.status = 'EXPIRED' if event_type.endswith('.expired') else 'COMPLETED'

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
                if child.subscription_status in PAID_SUBSCRIPTION_STATUSES:
                    award_paid_referral_if_needed(db, child.parent_user_id, reference_id=subscription_id)

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
        invoice_id = _id(data_object)
        subscription_id = _id(_stripe_get(data_object, "subscription"))
        customer_id = _id(_stripe_get(data_object, "customer"))
        child = _find_child_for_event(db, customer_id=customer_id, subscription_id=subscription_id)
        if child and subscription_id:
            subscription = stripe_client.Subscription.retrieve(subscription_id)
            _apply_subscription_state(child, subscription)
            if child.subscription_status in PAID_SUBSCRIPTION_STATUSES:
                award_paid_referral_if_needed(db, child.parent_user_id, reference_id=subscription_id)
                create_commission_for_payment(
                    db,
                    referred_user_id=child.parent_user_id,
                    payment_reference_id=_invoice_payment_reference(invoice_id),
                    amount_paid_minor=_stripe_get(data_object, "amount_paid"),
                    currency=_stripe_get(data_object, "currency", "THB"),
                    source_event_id=event_id,
                    metadata={
                        "stripe_invoice_id": invoice_id,
                        "stripe_subscription_id": subscription_id,
                        "stripe_customer_id": customer_id,
                        "stripe_payment_intent": _id(_stripe_get(data_object, "payment_intent")),
                    },
                )

    elif event_type == "invoice.payment_failed":
        subscription_id = _id(_stripe_get(data_object, "subscription"))
        customer_id = _id(_stripe_get(data_object, "customer"))
        child = _find_child_for_event(db, customer_id=customer_id, subscription_id=subscription_id)
        if child:
            child.subscription_status = "past_due"

    elif event_type in {"charge.refunded", "charge.dispute.created"}:
        invoice_id = _id(_stripe_get(data_object, "invoice"))
        reverse_commission_for_payment(
            db,
            payment_reference_id=_invoice_payment_reference(invoice_id),
            reason="refund" if event_type == "charge.refunded" else "chargeback",
            source_event_id=event_id,
        )

    db.commit()
    return {"received": True}
