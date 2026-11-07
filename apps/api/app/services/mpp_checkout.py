"""Persistent one-time checkout; unknown vendor confirmation remains pending."""
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from urllib.parse import quote, urlsplit
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import ChildProfile, User
from app.models.mpp_purchase import MppPackagePrice, MppPurchaseEvent, MppPurchaseOrder
from app.services import payment_integration as transport
from app.services.checkout_policy import require_mpp_access
from app.models.checkout_reservation import CheckoutReservation


def require_checkout_ready():
    settings = get_settings()
    blockers = []
    if settings.environment.lower() in {'production', 'prod'}:
        blockers.append('production_uat_not_approved')
    if (settings.mpp_api_base_url.rstrip('/'), settings.mpp_payment_base_url.rstrip('/')) != ('https://staging-api.mmerchant.cc/api/v1', 'https://staging-pay.mmerchant.cc'):
        blockers.append('staging_hosts_required')
    if not (settings.mpp_project_api_key or '').strip():
        blockers.append('missing_project_api_key')
    if settings.mpp_amount_unit != 'minor':
        blockers.append('amount_unit_unverified')
    if not (settings.mpp_expected_merchant_name or '').strip() or not (settings.mpp_expected_project_name or '').strip():
        blockers.append('missing_expected_merchant_project')
    if blockers:
        raise HTTPException(503, {'code': 'MPP_CHECKOUT_BLOCKED', 'blockers': blockers})
    return settings


def reject_live_stripe(child):
    if child.stripe_subscription_id and child.subscription_status not in {'canceled', 'incomplete_expired'}:
        raise HTTPException(409, {'code': 'EXISTING_STRIPE_SUBSCRIPTION'})


@lru_cache(maxsize=4)
def validate_openapi(base_url):
    from urllib.request import Request, build_opener
    import json
    try:
        with build_opener(transport.NoRedirect()).open(Request(base_url.removesuffix('/api/v1') + '/openapi.json'), timeout=10) as response:
            schema = json.loads(response.read(1048576))
        operation = schema['paths']['/api/v1/payments']['post']
        headers = {p['name'].lower() for p in operation['parameters']}
        fields = schema['components']['schemas']['PaymentCreateResponse']['properties']
        required = {'payment_id', 'merchant_order_id', 'amount', 'currency', 'payment_session_token', 'payment_session_url', 'expires_at', 'merchant', 'project'}
        if not required.issubset(fields) or not {'x-api-key', 'idempotency-key'}.issubset(headers) or fields['amount'].get('type') != 'integer':
            raise ValueError()
    except Exception:
        raise HTTPException(503, {'code': 'MPP_CONTRACT_UNAVAILABLE'}) from None


def utc(value):
    return value.replace(tzinfo=UTC) if value and value.tzinfo is None else value


def owned_order(db, user, order_id):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    row = db.scalar(select(MppPurchaseOrder).where(MppPurchaseOrder.id == order_id, MppPurchaseOrder.user_id == user.id))
    if not row:
        raise HTTPException(404, 'Payment order not found')
    db.scalar(select(ChildProfile).where(ChildProfile.id == row.child_id).with_for_update().execution_options(populate_existing=True))
    row = db.scalar(select(MppPurchaseOrder).where(MppPurchaseOrder.id == order_id, MppPurchaseOrder.user_id == user.id).with_for_update().execution_options(populate_existing=True))
    return row


def new_or_pending_order(db, user, plan_code):
    require_mpp_access(user)
    settings = require_checkout_ready()
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    if db.scalar(select(CheckoutReservation).where(CheckoutReservation.user_id == user.id, CheckoutReservation.status == 'PENDING')):
        raise HTTPException(409, {'code': 'CHECKOUT_PROVIDER_LOCKED', 'provider': 'stripe'})
    child = db.scalar(select(ChildProfile).where(ChildProfile.parent_user_id == user.id).order_by(ChildProfile.id).with_for_update())
    if not child:
        raise HTTPException(409, {'code': 'CHILD_PROFILE_REQUIRED'})
    reject_live_stripe(child)
    existing = db.scalar(select(MppPurchaseOrder).where(MppPurchaseOrder.child_id == child.id, MppPurchaseOrder.status == 'PENDING').order_by(MppPurchaseOrder.created_at).with_for_update())
    if existing:
        if existing.plan_code != plan_code:
            raise HTTPException(409, {'code': 'PAYMENT_ALREADY_PENDING'})
        db.commit()
        return existing
    founders = {'th_founder_monthly', 'ep_founder_monthly'}
    if plan_code in founders:
        db.scalars(select(MppPackagePrice).where(MppPackagePrice.plan_code.in_(founders)).order_by(MppPackagePrice.plan_code).with_for_update()).all()
        paid_ids = select(ChildProfile.id).where(
            ChildProfile.active_price_code.in_(founders),
            ChildProfile.membership_status.in_({'paid', 'plus'}),
            or_(
                and_(or_(ChildProfile.membership_provider.is_(None), ChildProfile.membership_provider != 'mpp'), ChildProfile.subscription_status.in_({'active', 'trialing', 'paid'})),
                and_(ChildProfile.membership_provider == 'mpp', ChildProfile.mpp_access_ends_at > datetime.now(UTC)),
            ),
        )
        paid = db.scalar(select(func.count()).select_from(paid_ids.subquery())) or 0
        reserved = db.scalar(select(func.count()).select_from(MppPurchaseOrder).where(MppPurchaseOrder.plan_code.in_(founders), MppPurchaseOrder.status == 'PENDING', MppPurchaseOrder.child_id.not_in(paid_ids))) or 0
        renewing_founder = db.scalar(paid_ids.where(ChildProfile.id == child.id)) is not None
        if not renewing_founder and paid + reserved >= int(settings.founder_user_limit or settings.founder_price_limit or 100):
            raise HTTPException(409, {'code': 'FOUNDER_FULL'})
    price = db.scalar(select(MppPackagePrice).where(MppPackagePrice.plan_code == plan_code).with_for_update())
    if not price or not price.active or price.currency != 'THB' or price.amount_minor <= 0 or price.duration_days != 30:
        raise HTTPException(409, {'code': 'MPP_PACKAGE_UNAVAILABLE'})
    row = MppPurchaseOrder(user_id=user.id, child_id=child.id, plan_code=price.plan_code, amount_minor=price.amount_minor, currency=price.currency, duration_days=price.duration_days, entitlement_plan=price.entitlement_plan, program_type=price.program_type, merchant_order_id='topa-purchase-' + str(uuid4()), idempotency_key='topa-purchase-' + str(uuid4()), api_origin=settings.mpp_api_base_url.rstrip('/'), merchant_name=settings.mpp_expected_merchant_name.strip(), project_name=settings.mpp_expected_project_name.strip(), status='PENDING')
    db.add(row)
    db.commit()
    return row


def payload(row):
    return {'merchant_order_id': row.merchant_order_id, 'amount': row.amount_minor, 'currency': row.currency, 'customer_reference': row.user_id, 'description': 'TOPA Math ' + row.plan_code, 'metadata': {'topa_order_id': row.id, 'topa_child_id': row.child_id}, 'expires_in_seconds': 900}


def identity_matches(row, data):
    return data.get('merchant_order_id') == row.merchant_order_id and type(data.get('amount')) is int and data['amount'] == row.amount_minor and data.get('currency') == row.currency


def submit_order(db, user, order_id):
    settings = require_checkout_ready()
    row = owned_order(db, user, order_id)
    if row.status != 'PENDING':
        raise HTTPException(409, {'code': 'PAYMENT_NOT_PENDING'})
    child = db.get(ChildProfile, row.child_id)
    if not child or child.parent_user_id != user.id:
        raise HTTPException(409, {'code': 'ORDER_OWNER_MISMATCH'})
    reject_live_stripe(child)
    if row.api_origin != settings.mpp_api_base_url.rstrip('/') or row.merchant_name != settings.mpp_expected_merchant_name.strip() or row.project_name != settings.mpp_expected_project_name.strip():
        raise HTTPException(409, {'code': 'PAYMENT_PROJECT_CHANGED'})
    if row.session_url:
        if utc(row.expires_at) <= datetime.now(UTC):
            raise HTTPException(409, {'code': 'PAYMENT_SESSION_EXPIRED', 'order_id': row.id})
        return row
    try:
        validate_openapi(row.api_origin)
        data = transport.mpp_request('POST', '/payments', payload(row), key=row.idempotency_key)
        url = data.get('payment_session_url')
        parsed = urlsplit(url) if isinstance(url, str) else None
        expires = datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00'))
        valid = identity_matches(row, data) and data.get('merchant', {}).get('display_name') == row.merchant_name and data.get('project', {}).get('name') == row.project_name and isinstance(data.get('payment_id'), str) and 0 < len(data['payment_id']) <= 120 and isinstance(data.get('payment_session_token'), str) and bool(data['payment_session_token']) and parsed and parsed.scheme == 'https' and parsed.netloc == urlsplit(settings.mpp_payment_base_url).netloc and not parsed.username and not parsed.password and expires.tzinfo is not None
        if not valid:
            raise ValueError()
        row.payment_id, row.session_token, row.session_url = data['payment_id'], data['payment_session_token'], url
        row.remote_status = str(data.get('status', ''))[:40]
        row.expires_at, row.last_error = expires, None
    except HTTPException as error:
        row.last_error = 'MPP_CONTRACT_UNAVAILABLE' if isinstance(error.detail, dict) and error.detail.get('code') == 'MPP_CONTRACT_UNAVAILABLE' else 'MPP_REQUEST_FAILED'
        db.commit()
        raise HTTPException(error.status_code, {'code': row.last_error, 'order_id': row.id}) from None
    except (ValueError, KeyError, TypeError, AttributeError):
        row.last_error = 'MPP_RESPONSE_MISMATCH'
        db.commit()
        raise HTTPException(502, {'code': row.last_error, 'order_id': row.id}) from None
    db.commit()
    return row


def recheck_order(db, user, order_id):
    require_checkout_ready()
    row = owned_order(db, user, order_id)
    if not row.session_token:
        raise HTTPException(409, {'code': 'PAYMENT_NOT_CREATED'})
    if row.api_origin != get_settings().mpp_api_base_url.rstrip('/'):
        raise HTTPException(409, {'code': 'PAYMENT_PROJECT_CHANGED'})
    data = transport.mpp_request('GET', '/pay/' + quote(row.session_token, safe=''))
    if not identity_matches(row, data) or data.get('payment_id') != row.payment_id or data.get('customer_reference') != user.id or data.get('merchant_display_name') != row.merchant_name or data.get('project_name') != row.project_name:
        raise HTTPException(502, {'code': 'MPP_RESPONSE_MISMATCH'})
    row.remote_status = str(data.get('status', ''))[:40]
    row.last_rechecked_at = datetime.now(UTC)
    # Status text is evidence for display, not membership authorization.
    row.last_error = 'MPP_CONFIRMATION_CONTRACT_REQUIRED' if row.status == 'PENDING' else None
    db.commit()
    return row


def view(row):
    return {'order_id': row.id, 'provider': 'mpp', 'plan_code': row.plan_code, 'amount_minor': row.amount_minor, 'currency': row.currency, 'duration_days': row.duration_days, 'auto_renew': False, 'status': row.status, 'remote_status': row.remote_status, 'merchant_name': row.merchant_name, 'project_name': row.project_name, 'checkout_url': row.session_url if row.status == 'PENDING' and row.expires_at and utc(row.expires_at) > datetime.now(UTC) else None, 'expires_at': row.expires_at, 'granted_at': row.granted_at, 'verification_blocker': row.last_error}


@dataclass(frozen=True)
class VerifiedPaymentEvidence:
    """Backend-only adapter output, never an HTTP input."""
    event_id: str
    body_digest: str
    payment_id: str
    merchant_order_id: str
    customer_reference: str
    amount_minor: int
    currency: str
    merchant_name: str
    project_name: str
    outcome: str


def apply_verified_evidence(db: Session, order_id: str, evidence: VerifiedPaymentEvidence):
    row = db.get(MppPurchaseOrder, order_id)
    if not row:
        raise HTTPException(404, 'Payment order not found')
    user = db.scalar(select(User).where(User.id == row.user_id).with_for_update())
    child = db.scalar(select(ChildProfile).where(ChildProfile.id == row.child_id).with_for_update().execution_options(populate_existing=True))
    row = db.scalar(select(MppPurchaseOrder).where(MppPurchaseOrder.id == order_id).with_for_update().execution_options(populate_existing=True))
    if evidence.outcome not in {'CONFIRMED', 'FAILED', 'EXPIRED'} or len(evidence.body_digest) != 64 or not evidence.event_id or len(evidence.event_id) > 160 or evidence.payment_id != row.payment_id or evidence.merchant_order_id != row.merchant_order_id or evidence.customer_reference != row.user_id or type(evidence.amount_minor) is not int or evidence.amount_minor != row.amount_minor or evidence.currency != row.currency or evidence.merchant_name != row.merchant_name or evidence.project_name != row.project_name:
        raise HTTPException(400, 'Verified payment identity mismatch')
    event = db.get(MppPurchaseEvent, evidence.event_id)
    if event:
        if event.body_digest != evidence.body_digest or event.order_id != row.id:
            raise HTTPException(409, 'Payment event conflict')
        return row
    if not child or child.id != row.child_id or child.parent_user_id != row.user_id or not user or user.is_active is False:
        raise HTTPException(409, 'Order ownership invalid')
    db.add(MppPurchaseEvent(event_id=evidence.event_id, order_id=row.id, body_digest=evidence.body_digest, outcome=evidence.outcome))
    db.flush()
    if evidence.outcome != 'CONFIRMED':
        if not row.granted_at:
            row.status = evidence.outcome
        return row
    if row.granted_at:
        return row
    reject_live_stripe(child)
    now = datetime.now(UTC)
    ends = max(now, utc(child.mpp_access_ends_at) or now) + timedelta(days=row.duration_days)
    child.membership_provider, child.mpp_access_ends_at, child.access_ends_at = 'mpp', ends, ends
    child.membership_status = 'plus'
    child.plan_code, child.plan_type = row.entitlement_plan, row.entitlement_plan
    child.active_price_code, child.billing_program_type = row.plan_code, row.program_type
    child.price_type = 'founder' if 'founder' in row.plan_code else 'normal'
    child.paid_at = child.paid_at or now
    row.status, row.granted_at, row.last_error = 'PAID', now, None
    return row
