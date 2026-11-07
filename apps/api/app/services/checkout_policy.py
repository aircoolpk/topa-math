from fastapi import HTTPException
from app.core.config import get_settings


def default_gateway():
    gateway = get_settings().payment_gateway_default.strip().lower()
    if gateway not in {'stripe', 'mpp'}:
        raise HTTPException(503, {'code': 'PAYMENT_GATEWAY_CONFIGURATION_INVALID'})
    return gateway


def require_mpp_access(user):
    settings = get_settings()
    if not settings.mpp_checkout_enabled:
        raise HTTPException(503, {'code': 'MPP_CHECKOUT_DISABLED'})
    allowed_ids = {value.strip() for value in settings.mpp_checkout_test_user_ids.split(',') if value.strip()}
    if user.role != 'admin' and user.id not in allowed_ids:
        raise HTTPException(403, {'code': 'MPP_CHECKOUT_ACCOUNT_NOT_AUTHORIZED'})

