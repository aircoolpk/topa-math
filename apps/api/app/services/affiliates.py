from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import AdminAuditLog, AffiliateCommissionLedger, AffiliatePayoutAccount, AffiliateWithdrawalRequest, ReferralEvent, User
from app.services.email_notifications import OutboundEmail, send_email
from app.services.referrals import ensure_referral_token


logger = logging.getLogger(__name__)

WITHDRAWAL_STATUSES = {"pending_review", "approved", "processing", "paid", "rejected"}
ACTIVE_WITHDRAWAL_STATUSES = {"pending_review", "approved", "processing", "paid"}
OPEN_WITHDRAWAL_STATUSES = {"pending_review", "approved", "processing"}


def mask_email(email: str | None) -> str | None:
    if not email or "@" not in email:
        return email
    name, domain = email.split("@", 1)
    if len(name) <= 2:
        return f"{name[:1]}***@{domain}"
    return f"{name[:2]}***@{domain}"


def _last4(value: str | None) -> str | None:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    return digits[-4:] if digits else None


def _mask_last4(last4: str | None) -> str | None:
    return f"****{last4}" if last4 else None


def _now() -> datetime:
    return datetime.now(UTC)


def commission_minor(amount_paid_minor: int, rate_bps: int | None = None) -> int:
    rate = int(rate_bps if rate_bps is not None else get_settings().affiliate_commission_rate_bps)
    return (int(amount_paid_minor) * rate) // 10_000


def refresh_available_commissions(db: Session, user_id: str | None = None) -> None:
    filters = [AffiliateCommissionLedger.status == "pending", AffiliateCommissionLedger.available_at <= _now()]
    if user_id:
        filters.append(AffiliateCommissionLedger.affiliate_user_id == user_id)
    for row in db.scalars(select(AffiliateCommissionLedger).where(*filters)).all():
        row.status = "available"


def create_commission_for_payment(
    db: Session,
    *,
    referred_user_id: str,
    payment_reference_id: str | None,
    amount_paid_minor: int | None,
    currency: str = "THB",
    source_event_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AffiliateCommissionLedger | None:
    if not payment_reference_id or amount_paid_minor is None or int(amount_paid_minor) <= 0:
        return None
    existing = db.scalar(
        select(AffiliateCommissionLedger).where(AffiliateCommissionLedger.payment_reference_id == payment_reference_id)
    )
    if existing:
        return existing
    referred = db.get(User, referred_user_id)
    if not referred or not referred.referred_by_user_id or referred.referred_by_user_id == referred.id:
        return None
    referrer = db.get(User, referred.referred_by_user_id)
    if not referrer or referrer.id == referred.id:
        return None
    rate_bps = int(get_settings().affiliate_commission_rate_bps)
    amount = int(amount_paid_minor)
    commission = commission_minor(amount, rate_bps)
    if commission <= 0:
        return None
    hold_days = max(0, int(get_settings().affiliate_commission_hold_days or 0))
    ledger = AffiliateCommissionLedger(
        affiliate_user_id=referrer.id,
        referred_user_id=referred.id,
        payment_reference_id=payment_reference_id,
        source_event_id=source_event_id,
        amount_paid_minor=amount,
        commission_minor=commission,
        currency=str(currency or "THB").upper()[:3],
        rate_bps=rate_bps,
        status="pending" if hold_days else "available",
        available_at=_now() + timedelta(days=hold_days) if hold_days else _now(),
        metadata_json=metadata or {},
    )
    db.add(ledger)
    return ledger


def reverse_commission_for_payment(db: Session, *, payment_reference_id: str | None, reason: str, source_event_id: str | None = None) -> AffiliateCommissionLedger | None:
    if not payment_reference_id:
        return None
    ledger = db.scalar(
        select(AffiliateCommissionLedger).where(AffiliateCommissionLedger.payment_reference_id == payment_reference_id)
    )
    if not ledger or ledger.status == "reversed":
        return ledger
    if ledger.status == "withdrawn":
        meta = dict(ledger.metadata_json or {})
        meta["reverse_requested_after_withdrawal"] = True
        meta["reverse_reason"] = reason
        meta["reverse_event_id"] = source_event_id
        ledger.metadata_json = meta
        return ledger
    ledger.status = "reversed"
    ledger.reversed_at = _now()
    meta = dict(ledger.metadata_json or {})
    meta["reverse_reason"] = reason
    meta["reverse_event_id"] = source_event_id
    ledger.metadata_json = meta
    return ledger


def upsert_payout_account(
    db: Session,
    user: User,
    *,
    payout_method: str,
    account_holder_name: str,
    bank_name: str | None = None,
    account_number: str | None = None,
    promptpay_value: str | None = None,
) -> AffiliatePayoutAccount:
    method = payout_method.lower().strip()
    if method not in {"bank", "promptpay"}:
        raise HTTPException(status_code=400, detail="Invalid payout_method")
    if method == "bank" and (not bank_name or not account_number):
        raise HTTPException(status_code=400, detail="bank_name and account_number are required")
    if method == "promptpay" and not promptpay_value:
        raise HTTPException(status_code=400, detail="promptpay_value is required")
    account = db.scalar(select(AffiliatePayoutAccount).where(AffiliatePayoutAccount.user_id == user.id))
    if not account:
        account = AffiliatePayoutAccount(user_id=user.id, payout_method=method, account_holder_name=account_holder_name)
        db.add(account)
    account.payout_method = method
    account.account_holder_name = account_holder_name.strip()
    account.bank_name = bank_name.strip() if bank_name else None
    account.account_last4 = _last4(account_number) if method == "bank" else None
    account.promptpay_last4 = _last4(promptpay_value) if method == "promptpay" else None
    account.payout_details = {
        "payout_method": method,
        "bank_name": bank_name.strip() if bank_name else None,
        "account_number": account_number.strip() if account_number else None,
        "promptpay_value": promptpay_value.strip() if promptpay_value else None,
    }
    return account


def payout_account_payload(account: AffiliatePayoutAccount | None) -> dict[str, Any] | None:
    if not account:
        return None
    return {
        "id": account.id,
        "payout_method": account.payout_method,
        "account_holder_name": account.account_holder_name,
        "bank_name": account.bank_name,
        "account_masked": _mask_last4(account.account_last4),
        "promptpay_masked": _mask_last4(account.promptpay_last4),
        "updated_at": account.updated_at,
    }


def affiliate_summary(db: Session, user: User) -> dict[str, Any]:
    refresh_available_commissions(db, user.id)
    token = ensure_referral_token(db, user)
    settings = get_settings()
    referred_users = db.scalars(select(User).where(User.referred_by_user_id == user.id).order_by(User.created_at.desc())).all()
    ledgers = db.scalars(
        select(AffiliateCommissionLedger)
        .where(AffiliateCommissionLedger.affiliate_user_id == user.id)
        .order_by(AffiliateCommissionLedger.created_at.desc())
    ).all()
    withdrawals = db.scalars(
        select(AffiliateWithdrawalRequest)
        .where(AffiliateWithdrawalRequest.user_id == user.id)
        .order_by(AffiliateWithdrawalRequest.requested_at.desc())
    ).all()
    paid_user_ids = {row.referred_user_id for row in ledgers if row.status != "reversed"}
    account = db.scalar(select(AffiliatePayoutAccount).where(AffiliatePayoutAccount.user_id == user.id))
    return {
        "referral_token": token,
        "referral_url": f"{settings.frontend_base_url.rstrip('/')}?ref={token}",
        "registered_count": len(referred_users),
        "paid_member_count": len(paid_user_ids),
        "total_referred_paid_minor": sum(row.amount_paid_minor for row in ledgers if row.status != "reversed"),
        "total_commission_minor": sum(row.commission_minor for row in ledgers if row.status != "reversed"),
        "pending_balance_minor": sum(row.commission_minor for row in ledgers if row.status == "pending"),
        "available_balance_minor": sum(row.commission_minor for row in ledgers if row.status == "available"),
        "withdrawn_balance_minor": sum(row.amount_minor for row in withdrawals if row.status in ACTIVE_WITHDRAWAL_STATUSES),
        "min_withdrawal_minor": int(settings.affiliate_min_withdrawal_minor),
        "payout_account": payout_account_payload(account),
        "registrations": [
            {
                "user_id": row.id,
                "email_masked": mask_email(row.email),
                "created_at": row.created_at,
                "has_paid": row.id in paid_user_ids,
            }
            for row in referred_users
        ],
        "commissions": [
            {
                "id": row.id,
                "referred_user_id": row.referred_user_id,
                "referred_email_masked": mask_email(db.get(User, row.referred_user_id).email if db.get(User, row.referred_user_id) else None),
                "payment_reference_id": row.payment_reference_id,
                "amount_paid_minor": row.amount_paid_minor,
                "commission_minor": row.commission_minor,
                "currency": row.currency,
                "rate_bps": row.rate_bps,
                "status": row.status,
                "available_at": row.available_at,
                "created_at": row.created_at,
            }
            for row in ledgers
        ],
        "withdrawals": [withdrawal_payload(row) for row in withdrawals],
    }


def withdrawal_payload(row: AffiliateWithdrawalRequest) -> dict[str, Any]:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "amount_minor": row.amount_minor,
        "currency": row.currency,
        "status": row.status,
        "admin_note": row.admin_note,
        "requested_at": row.requested_at,
        "updated_at": row.updated_at,
        "paid_at": row.paid_at,
    }


def send_withdrawal_notifications(user: User, withdrawal: AffiliateWithdrawalRequest) -> None:
    settings = get_settings()
    admin_email = (settings.affiliate_admin_notification_email or "").strip()
    sender = (settings.email_from or "").strip()
    admin_url = f"{settings.frontend_base_url.rstrip('/')}/admin/affiliates"
    amount = f"{withdrawal.amount_minor // 100}.{withdrawal.amount_minor % 100:02d} {withdrawal.currency}"

    messages: list[OutboundEmail] = []
    if admin_email:
        messages.append(
            OutboundEmail(
                to_email=admin_email,
                from_email=sender or None,
                subject="TOPA Affiliate withdrawal request",
                text_body=(
                    "New affiliate withdrawal request\n\n"
                    f"Withdrawal ID: {withdrawal.id}\n"
                    f"User ID: {user.id}\n"
                    f"User email: {mask_email(user.email)}\n"
                    f"Amount: {amount}\n"
                    f"Status: {withdrawal.status}\n"
                    f"Admin page: {admin_url}\n"
                ),
            )
        )
    messages.append(
        OutboundEmail(
            to_email=user.email,
            from_email=sender or None,
            subject="TOPA Affiliate withdrawal request received",
            text_body=(
                "We received your affiliate withdrawal request.\n\n"
                f"Withdrawal ID: {withdrawal.id}\n"
                f"Amount: {amount}\n"
                f"Status: {withdrawal.status}\n"
                "Our admin team will review and process the transfer manually.\n"
            ),
        )
    )

    for message in messages:
        try:
            send_email(message)
        except Exception:
            logger.exception("affiliate_withdrawal_email_failed withdrawal_id=%s to=%s", withdrawal.id, mask_email(message.to_email))


def request_withdrawal(db: Session, user: User, amount_minor: int) -> AffiliateWithdrawalRequest:
    refresh_available_commissions(db, user.id)
    amount = int(amount_minor)
    min_amount = int(get_settings().affiliate_min_withdrawal_minor)
    if amount < min_amount:
        raise HTTPException(status_code=400, detail="Withdrawal amount is below minimum")
    account = db.scalar(select(AffiliatePayoutAccount).where(AffiliatePayoutAccount.user_id == user.id))
    if not account:
        raise HTTPException(status_code=400, detail="Payout account is required")
    open_request = db.scalar(
        select(AffiliateWithdrawalRequest)
        .where(AffiliateWithdrawalRequest.user_id == user.id, AffiliateWithdrawalRequest.status.in_(OPEN_WITHDRAWAL_STATUSES))
        .order_by(AffiliateWithdrawalRequest.requested_at.desc())
        .with_for_update()
    )
    if open_request:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Withdrawal request already pending")
    available_rows = db.scalars(
        select(AffiliateCommissionLedger)
        .where(AffiliateCommissionLedger.affiliate_user_id == user.id, AffiliateCommissionLedger.status == "available")
        .order_by(AffiliateCommissionLedger.created_at)
        .with_for_update()
    ).all()
    available_total = sum(row.commission_minor for row in available_rows)
    if available_total < amount:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Insufficient available balance")
    request = AffiliateWithdrawalRequest(user_id=user.id, payout_account_id=account.id, amount_minor=amount, status="pending_review")
    db.add(request)
    db.flush()
    reserved = 0
    for row in available_rows:
        if reserved >= amount:
            break
        remaining = amount - reserved
        if row.commission_minor > remaining:
            remainder = AffiliateCommissionLedger(
                affiliate_user_id=row.affiliate_user_id,
                referred_user_id=row.referred_user_id,
                payment_reference_id=f"{row.payment_reference_id}:remainder:{request.id}",
                source_event_id=row.source_event_id,
                amount_paid_minor=row.amount_paid_minor,
                commission_minor=row.commission_minor - remaining,
                currency=row.currency,
                rate_bps=row.rate_bps,
                status="available",
                available_at=row.available_at,
                metadata_json={**(row.metadata_json or {}), "split_from_ledger_id": row.id},
            )
            db.add(remainder)
            row.commission_minor = remaining
        row.status = "withdrawn"
        row.withdrawal_request_id = request.id
        reserved += row.commission_minor
    if reserved < amount:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Insufficient available balance")
    db.add(
        AdminAuditLog(
            action="affiliate_withdrawal_requested",
            target_user_id=user.id,
            old_value={"available_balance_minor": available_total},
            new_value={"withdrawal_id": request.id, "amount_minor": amount, "currency": request.currency, "status": request.status},
            changed_by_admin_id=None,
            note="Affiliate withdrawal requested by user",
        )
    )
    return request


def admin_affiliate_dashboard(db: Session) -> dict[str, Any]:
    refresh_available_commissions(db)
    affiliates = []
    referrer_ids = {
        user_id
        for (user_id,) in db.execute(select(User.referred_by_user_id).where(User.referred_by_user_id.is_not(None))).all()
        if user_id
    } | {
        user_id
        for (user_id,) in db.execute(select(AffiliateCommissionLedger.affiliate_user_id)).all()
        if user_id
    }
    for user_id in referrer_ids:
        user = db.get(User, user_id)
        if not user:
            continue
        registered = int(db.scalar(select(func.count()).select_from(User).where(User.referred_by_user_id == user.id)) or 0)
        ledgers = db.scalars(select(AffiliateCommissionLedger).where(AffiliateCommissionLedger.affiliate_user_id == user.id)).all()
        affiliates.append(
            {
                "user_id": user.id,
                "email_masked": mask_email(user.email),
                "registered_count": registered,
                "paid_member_count": len({row.referred_user_id for row in ledgers if row.status != "reversed"}),
                "total_referred_paid_minor": sum(row.amount_paid_minor for row in ledgers if row.status != "reversed"),
                "total_commission_minor": sum(row.commission_minor for row in ledgers if row.status != "reversed"),
                "pending_balance_minor": sum(row.commission_minor for row in ledgers if row.status == "pending"),
                "available_balance_minor": sum(row.commission_minor for row in ledgers if row.status == "available"),
                "withdrawn_balance_minor": int(
                    db.scalar(
                        select(func.coalesce(func.sum(AffiliateWithdrawalRequest.amount_minor), 0)).where(
                            AffiliateWithdrawalRequest.user_id == user.id,
                            AffiliateWithdrawalRequest.status.in_(ACTIVE_WITHDRAWAL_STATUSES),
                        )
                    )
                    or 0
                ),
            }
        )
    withdrawals = db.scalars(select(AffiliateWithdrawalRequest).order_by(AffiliateWithdrawalRequest.requested_at.desc()).limit(500)).all()
    return {
        "affiliates": affiliates,
        "withdrawals": [
            {
                **withdrawal_payload(row),
                "email_masked": mask_email(db.get(User, row.user_id).email if db.get(User, row.user_id) else None),
                "payout_account": payout_account_payload(db.get(AffiliatePayoutAccount, row.payout_account_id)),
            }
            for row in withdrawals
        ],
        "recent_commissions": [
            {
                "id": row.id,
                "affiliate_user_id": row.affiliate_user_id,
                "affiliate_email_masked": mask_email(db.get(User, row.affiliate_user_id).email if db.get(User, row.affiliate_user_id) else None),
                "referred_user_id": row.referred_user_id,
                "referred_email_masked": mask_email(db.get(User, row.referred_user_id).email if db.get(User, row.referred_user_id) else None),
                "amount_paid_minor": row.amount_paid_minor,
                "commission_minor": row.commission_minor,
                "status": row.status,
                "created_at": row.created_at,
                "available_at": row.available_at,
            }
            for row in db.scalars(select(AffiliateCommissionLedger).order_by(AffiliateCommissionLedger.created_at.desc()).limit(500)).all()
        ],
        "summary": {
            "registered": int(db.scalar(select(func.count()).select_from(ReferralEvent).where(ReferralEvent.event_type == "registered")) or 0),
            "paid_members": int(db.scalar(select(func.count(func.distinct(AffiliateCommissionLedger.referred_user_id))).where(AffiliateCommissionLedger.status != "reversed")) or 0),
            "total_commission_minor": int(db.scalar(select(func.coalesce(func.sum(AffiliateCommissionLedger.commission_minor), 0)).where(AffiliateCommissionLedger.status != "reversed")) or 0),
            "available_balance_minor": int(db.scalar(select(func.coalesce(func.sum(AffiliateCommissionLedger.commission_minor), 0)).where(AffiliateCommissionLedger.status == "available")) or 0),
        },
    }


def update_withdrawal_status(db: Session, withdrawal_id: str, *, status_value: str, admin: User, admin_note: str | None = None) -> AffiliateWithdrawalRequest:
    if status_value not in WITHDRAWAL_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid withdrawal status")
    row = db.get(AffiliateWithdrawalRequest, withdrawal_id)
    if not row:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    if row.status == "paid" and status_value != "paid":
        raise HTTPException(status_code=400, detail="Paid withdrawal cannot be changed")
    row.status = status_value
    row.reviewed_by_admin_id = admin.id
    row.admin_note = admin_note
    if status_value == "paid":
        row.paid_at = _now()
    if status_value == "rejected":
        for ledger in db.scalars(select(AffiliateCommissionLedger).where(AffiliateCommissionLedger.withdrawal_request_id == row.id)).all():
            ledger.status = "available"
            ledger.withdrawal_request_id = None
    return row
