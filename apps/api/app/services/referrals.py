from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import CoinLedger, ReferralEvent, User


def ensure_referral_token(db: Session, user: User) -> str:
    if user.referral_token:
        return user.referral_token
    for _ in range(5):
        token = secrets.token_urlsafe(12)
        if not db.scalar(select(User.id).where(User.referral_token == token)):
            user.referral_token = token
            db.flush()
            return token
    raise RuntimeError("Could not create referral token")


def referrer_for_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    return db.scalar(select(User).where(User.referral_token == token))


def visitor_hash(ip: str | None, user_agent: str | None) -> str | None:
    value = f"{ip or ''}|{user_agent or ''}".strip("|")
    if not value:
        return None
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def record_referral_event(
    db: Session,
    *,
    token: str | None,
    event_type: str,
    referred_user: User | None = None,
    share_token: str | None = None,
    visitor: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> ReferralEvent | None:
    if not get_settings().referral_enabled:
        return None
    referrer = referrer_for_token(db, token)
    if not referrer:
        return None
    if referred_user and referred_user.id == referrer.id:
        return None
    if event_type == "clicked" and visitor:
        existing_click = db.scalar(
            select(ReferralEvent.id).where(
                ReferralEvent.referrer_user_id == referrer.id,
                ReferralEvent.event_type == "clicked",
                ReferralEvent.share_token == share_token,
                ReferralEvent.visitor_hash == visitor,
            )
        )
        if existing_click:
            return None
    event = ReferralEvent(
        referrer_user_id=referrer.id,
        referred_user_id=referred_user.id if referred_user else None,
        referral_token=str(token),
        event_type=event_type,
        share_token=share_token,
        visitor_hash=visitor,
        metadata_json=metadata or {},
    )
    db.add(event)
    return event


def attach_registration_referral(db: Session, user: User, token: str | None) -> ReferralEvent | None:
    if not get_settings().referral_enabled or user.referred_by_user_id:
        return None
    referrer = referrer_for_token(db, token)
    if not referrer or referrer.id == user.id:
        return None
    user.referred_by_user_id = referrer.id
    event = record_referral_event(db, token=token, event_type="registered", referred_user=user)
    award_referral_coins(
        db,
        referrer_user_id=referrer.id,
        amount=get_settings().referral_register_coins,
        reward_type="referral_registered",
        reference_id=f"registered:{user.id}",
        note="Referral registration reward",
    )
    return event


def award_referral_coins(
    db: Session,
    *,
    referrer_user_id: str,
    amount: int,
    reward_type: str,
    reference_id: str,
    note: str,
) -> CoinLedger | None:
    if amount <= 0:
        return None
    existing = db.scalar(
        select(CoinLedger).where(
            CoinLedger.user_id == referrer_user_id,
            CoinLedger.reference_id == reference_id,
            CoinLedger.type == reward_type,
        )
    )
    if existing:
        return existing
    hold_days = max(0, int(get_settings().referral_reward_hold_days or 0))
    ledger = CoinLedger(
        user_id=referrer_user_id,
        amount=amount,
        type=reward_type,
        status="pending",
        reference_id=reference_id,
        activated_at=datetime.now(UTC) + timedelta(days=hold_days) if hold_days else None,
        note=note,
    )
    db.add(ledger)
    return ledger


def award_paid_referral_if_needed(db: Session, referred_user_id: str, *, reference_id: str | None = None) -> CoinLedger | None:
    if not get_settings().referral_enabled:
        return None
    referred = db.get(User, referred_user_id)
    if not referred or not referred.referred_by_user_id:
        return None
    existing_paid = db.scalar(
        select(CoinLedger).where(
            CoinLedger.type == "referral_paid",
            CoinLedger.reference_id == f"paid:{referred.id}",
        )
    )
    if existing_paid:
        return existing_paid
    referrer = db.get(User, referred.referred_by_user_id)
    if not referrer or referrer.id == referred.id:
        return None
    record_referral_event(
        db,
        token=referrer.referral_token,
        event_type="paid",
        referred_user=referred,
        metadata={"payment_reference": reference_id},
    )
    return award_referral_coins(
        db,
        referrer_user_id=referrer.id,
        amount=get_settings().referral_paid_coins,
        reward_type="referral_paid",
        reference_id=f"paid:{referred.id}",
        note="First paid subscription referral reward",
    )


def referral_summary(db: Session, user: User) -> dict[str, Any]:
    token = ensure_referral_token(db, user)
    referral_url = f"{get_settings().frontend_base_url.rstrip('/')}?ref={token}"
    events = db.scalars(select(ReferralEvent).where(ReferralEvent.referrer_user_id == user.id)).all()
    ledgers = db.scalars(select(CoinLedger).where(CoinLedger.user_id == user.id).order_by(CoinLedger.created_at.desc())).all()
    return {
        "referral_token": token,
        "referral_url": referral_url,
        "click_count": sum(1 for event in events if event.event_type == "clicked"),
        "registered_count": len({event.referred_user_id for event in events if event.event_type == "registered" and event.referred_user_id}),
        "paid_count": len({event.referred_user_id for event in events if event.event_type == "paid" and event.referred_user_id}),
        "pending_coins": sum(row.amount for row in ledgers if row.status == "pending"),
        "active_coins": sum(row.amount for row in ledgers if row.status == "active"),
        "history": [
            {
                "id": row.id,
                "amount": row.amount,
                "type": row.type,
                "status": row.status,
                "reference_id": row.reference_id,
                "created_at": row.created_at,
                "activated_at": row.activated_at,
                "note": row.note,
            }
            for row in ledgers
        ],
    }


def admin_referral_rows(db: Session) -> dict[str, Any]:
    events = db.scalars(select(ReferralEvent).order_by(ReferralEvent.created_at.desc()).limit(500)).all()
    ledger_by_reference = {row.reference_id: row for row in db.scalars(select(CoinLedger)).all() if row.reference_id}
    rows = []
    for event in events:
        referrer = db.get(User, event.referrer_user_id)
        referred = db.get(User, event.referred_user_id) if event.referred_user_id else None
        ledger = ledger_by_reference.get(f"{event.event_type}:{event.referred_user_id}") or ledger_by_reference.get(f"paid:{event.referred_user_id}")
        rows.append(
            {
                "id": event.id,
                "referrer_user_id": event.referrer_user_id,
                "referrer_email": referrer.email if referrer else None,
                "referred_user_id": event.referred_user_id,
                "referred_email": referred.email if referred else None,
                "status": event.event_type,
                "token": event.referral_token,
                "share_token": event.share_token,
                "coins_awarded": ledger.amount if ledger else 0,
                "reward_status": ledger.status if ledger else None,
                "ledger_id": ledger.id if ledger else None,
                "created_at": event.created_at,
                "visitor_hash": event.visitor_hash,
            }
        )
    return {
        "rows": rows,
        "summary": {
            "clicks": int(db.scalar(select(func.count()).select_from(ReferralEvent).where(ReferralEvent.event_type == "clicked")) or 0),
            "registered": int(db.scalar(select(func.count()).select_from(ReferralEvent).where(ReferralEvent.event_type == "registered")) or 0),
            "paid": int(db.scalar(select(func.count()).select_from(ReferralEvent).where(ReferralEvent.event_type == "paid")) or 0),
            "pending_coins": int(db.scalar(select(func.coalesce(func.sum(CoinLedger.amount), 0)).where(CoinLedger.status == "pending")) or 0),
            "active_coins": int(db.scalar(select(func.coalesce(func.sum(CoinLedger.amount), 0)).where(CoinLedger.status == "active")) or 0),
        },
    }
