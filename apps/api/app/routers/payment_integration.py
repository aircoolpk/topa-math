import hashlib
import json
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import User
from app.models.payment_integration import MppTestTransaction, MppTestWebhookEvent
from app.routers.deps import require_admin
from app.services import payment_integration as service

router = APIRouter(tags=["MPP staging UAT"])
PREFIX = "/admin/payment-integration-test"


def uat_admin(user: User = Depends(require_admin)):
    service.staging_settings()
    return user


class WithdrawalRecipient(BaseModel):
    merchant_customer_id: str = Field(min_length=1, max_length=120)
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    phone: str = Field(min_length=3, max_length=40)
    bank_code: str = Field(min_length=2, max_length=24, pattern=r"^[A-Z0-9_-]+$")
    bank_name: str = Field(min_length=2, max_length=120)
    bank_account_number: str = Field(min_length=6, max_length=32, pattern=r"^[0-9 -]+$")
    bank_account_name: str = Field(min_length=2, max_length=180)


def locked(db, transaction_id):
    row = db.scalar(select(MppTestTransaction).where(MppTestTransaction.id == transaction_id).with_for_update())
    if not row:
        raise HTTPException(404, "UAT transaction not found")
    return row


@router.get(PREFIX)
def list_tests(db: Session = Depends(get_db), admin: User = Depends(uat_admin)):
    settings = service.staging_settings()
    return {"configured": bool(settings.mpp_project_api_key), "webhook_configured": bool(settings.mpp_webhook_signing_secret), "transactions": [service.view(row) for row in db.scalars(select(MppTestTransaction).order_by(MppTestTransaction.created_at.desc()).limit(100)).all()]}


@router.post(PREFIX + "/orders")
def create_order(db: Session = Depends(get_db), admin: User = Depends(uat_admin)):
    row = MppTestTransaction(created_by=admin.id, kind="payment", merchant_order_id="topa-uat-" + str(uuid4()), idempotency_key="topa-uat-" + str(uuid4()), amount=1500, status="PENDING_PAYMENT")
    db.add(row)
    db.flush()
    service.check(row, "order", "Create TOPA test order", "PENDING_PAYMENT; 1500 satang", "PENDING_PAYMENT; 1500 satang", True)
    db.commit()
    return service.view(row)


@router.post(PREFIX + "/{transaction_id}/payment")
@router.post(PREFIX + "/{transaction_id}/retry")
def send_payment(transaction_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(uat_admin)):
    row = locked(db, transaction_id)
    if row.kind != "payment":
        raise HTTPException(409, "Payment test required")
    retry = request.url.path.endswith("/retry")
    if retry and not row.payment_id:
        raise HTTPException(409, "Create payment before testing idempotency")
    try:
        service.create_payment(row, retry)
    except HTTPException as exc:
        service.check(row, "idempotency" if retry else "payment", "POST /payments", "Staging payment created", exc.detail, False)
    db.commit()
    return service.view(row)


@router.post(PREFIX + "/{transaction_id}/recheck")
def status_recheck(transaction_id: str, db: Session = Depends(get_db), admin: User = Depends(uat_admin)):
    row = locked(db, transaction_id)
    try:
        service.recheck(row)
    except HTTPException as exc:
        service.check(row, "recheck", "GET public status", "Status retrieved", exc.detail, False)
    db.commit()
    return service.view(row)


@router.get(PREFIX + "/{transaction_id}/hosted-url")
def hosted_url(transaction_id: str, db: Session = Depends(get_db), admin: User = Depends(uat_admin)):
    row = locked(db, transaction_id)
    if not row.payment_session_url:
        raise HTTPException(409, "Payment session not created")
    # The session URL is a public payment capability, never the project API key.
    return {"url": row.payment_session_url}


@router.post(PREFIX + "/withdrawals")
def create_withdrawal(payload: WithdrawalRecipient, db: Session = Depends(get_db), admin: User = Depends(uat_admin)):
    row = MppTestTransaction(created_by=admin.id, kind="withdrawal", merchant_order_id="topa-uat-wd-" + str(uuid4()), idempotency_key="topa-uat-wd-" + str(uuid4()), amount=1500, status="PENDING_WITHDRAWAL")
    db.add(row)
    db.commit()
    row = locked(db, row.id)
    body = {**payload.model_dump(), "merchant_withdrawal_reference": row.merchant_order_id, "amount": row.amount, "currency": "THB", "metadata": {"uat": True, "topa_test_transaction_id": row.id}}
    try:
        result = service.mpp_request("POST", "/withdrawals", body, key=row.idempotency_key)
        valid = result.get("merchant_withdrawal_reference") == row.merchant_order_id and type(result.get("amount")) is int and result["amount"] == row.amount and result.get("currency") == "THB" and bool(result.get("public_id")) and bool(result.get("status_token"))
        service.check(row, "withdrawal", "POST /withdrawals", "1500 satang; withdrawal ID + status token", "Withdrawal matched" if valid else "Withdrawal response mismatch", valid, result)
        if valid:
            row.withdrawal_id = str(result["public_id"])
            row.status_token = str(result["status_token"])
            row.remote_status = result.get("status")
    except HTTPException as exc:
        service.check(row, "withdrawal", "POST /withdrawals", "Withdrawal created", exc.detail, False)
    db.commit()
    return service.view(row)


@router.post("/webhooks/mpp/staging")
async def webhook(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    if len(raw) > 262144:
        raise HTTPException(413, "Webhook too large")
    service.verify_signature(raw, request.headers.get("X-Webhook-Signature"))
    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError()
        event_id, event_type, data = payload["event_id"], payload["event_type"], payload["data"]
        if not isinstance(event_id, str) or not 0 < len(event_id) <= 160 or not isinstance(event_type, str) or len(event_type) > 80 or not isinstance(data, dict):
            raise ValueError()
    except (ValueError, KeyError, TypeError):
        raise HTTPException(400, "Invalid webhook envelope") from None
    digest = hashlib.sha256(raw).hexdigest()
    existing = db.get(MppTestWebhookEvent, event_id)
    if existing:
        if existing.body_sha256 != digest:
            raise HTTPException(409, "Event ID reused with different body")
        return {"ok": True, "duplicate": True}
    is_payment = event_type.startswith("payment.")
    is_withdrawal = event_type.startswith("withdrawal.")
    if not is_payment and not is_withdrawal:
        raise HTTPException(400, "Unsupported UAT event")
    remote_id = data.get("payment_id") if is_payment else data.get("withdrawal_id", data.get("public_id"))
    if not isinstance(remote_id, str) or not remote_id:
        raise HTTPException(400, "Missing remote ID")
    column = MppTestTransaction.payment_id if is_payment else MppTestTransaction.withdrawal_id
    row = db.scalar(select(MppTestTransaction).where(column == remote_id).with_for_update())
    if not row:
        # Ask the sender to retry if delivery raced payment creation.
        raise HTTPException(409, "UAT transaction not found; retry delivery")
    valid = service.payment_matches(row, data) if is_payment else data.get("merchant_withdrawal_reference") == row.merchant_order_id and type(data.get("amount")) is int and data["amount"] == row.amount and data.get("currency") == "THB"
    if not valid:
        raise HTTPException(400, "Webhook identity or amount mismatch")
    event = MppTestWebhookEvent(event_id=event_id, event_type=event_type, body_sha256=digest, transaction_id=row.id, outcome="processed")
    db.add(event)
    try:
        db.flush()
        if row.status != "PAID":
            row.remote_status = str(data.get("status", event_type.split(".")[-1]))[:40]
        if event_type in {"payment.confirmed", "withdrawal.paid"}:
            row.status = "PAID"
        service.check(row, "webhook", "Receive signed " + event_type, "Signature valid; matching UAT transaction; single processing", "Processed " + event_id, True, data)
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.get(MppTestWebhookEvent, event_id)
        if not existing or existing.body_sha256 != digest:
            raise HTTPException(409, "Webhook conflict") from None
        return {"ok": True, "duplicate": True}
    return {"ok": True, "duplicate": False}
