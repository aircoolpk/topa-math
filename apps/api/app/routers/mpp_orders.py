from datetime import UTC, datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import User
from app.models.mpp_purchase import MppPurchaseOrder
from app.routers.deps import current_user, require_admin
from app.services import mpp_checkout as service

router = APIRouter(tags=['MPP purchases'])


@router.get('/billing/mpp/orders')
def orders(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(MppPurchaseOrder).where(MppPurchaseOrder.user_id == user.id).order_by(MppPurchaseOrder.created_at.desc()).limit(30)).all()
    return [service.view(row) for row in rows]


@router.get('/billing/mpp/orders/{order_id}')
def order_detail(order_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return service.view(service.owned_order(db, user, order_id))


@router.post('/billing/mpp/orders/{order_id}/retry')
def retry_order(order_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return service.view(service.submit_order(db, user, order_id))


@router.post('/billing/mpp/orders/{order_id}/recheck')
def recheck_order(order_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return service.view(service.recheck_order(db, user, order_id))


@router.post('/admin/mpp/reconcile')
def reconcile(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    rows = db.scalars(select(MppPurchaseOrder).where(MppPurchaseOrder.status == 'PENDING', MppPurchaseOrder.payment_id.is_not(None)).order_by(MppPurchaseOrder.last_rechecked_at.asc().nullsfirst()).limit(1)).all()
    results = []
    for row in rows:
        owner = db.get(User, row.user_id)
        try:
            service.recheck_order(db, owner, row.id)
            results.append({'order_id': row.id, 'status': row.status})
        except HTTPException:
            db.rollback()
            results.append({'order_id': row.id, 'status': 'RECHECK_FAILED'})
    return {'results': results}


@router.post('/webhooks/mpp/payments')
async def payment_webhook(request: Request):
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 262144:
            raise HTTPException(413, 'Webhook too large')
    # Intentionally no guessed header, HMAC formula, envelope or status mapping.
    # A real contract-specific adapter must verify these exact bytes before
    # constructing VerifiedPaymentEvidence and calling apply_verified_evidence.
    raise HTTPException(503, {'code': 'MPP_WEBHOOK_CONTRACT_REQUIRED'})
