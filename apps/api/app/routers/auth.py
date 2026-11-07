import hashlib
import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.routers.deps import current_user
from app.schemas.api import LoginIn, TokenOut, UserCreate, UserOut
from app.services.referrals import attach_registration_referral, ensure_referral_token

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _client_category(request: Request) -> str:
    user_agent = request.headers.get("user-agent", "").lower()
    if "ipad" in user_agent or "tablet" in user_agent:
        return "tablet"
    if any(marker in user_agent for marker in ("iphone", "ipod", "android", "mobile")):
        return "mobile"
    return "desktop"


def _email_fingerprint(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()[:12]


def _set_auth_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite.lower(),
        domain=settings.auth_cookie_domain or None,
        path=settings.auth_cookie_path,
    )


@router.post("/register", response_model=TokenOut)
def register(payload: UserCreate, response: Response, db: Session = Depends(get_db)) -> TokenOut:
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(email=payload.email.lower(), password_hash=hash_password(payload.password), role="parent")
    db.add(user)
    db.flush()
    ensure_referral_token(db, user)
    attach_registration_referral(db, user, payload.referral_token)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, user.role)
    _set_auth_cookie(response, token)
    return TokenOut(access_token=token)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)) -> TokenOut:
    normalized_email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == normalized_email))
    client_category = _client_category(request)
    log_context = {
        "email_fingerprint": _email_fingerprint(normalized_email),
        "client_category": client_category,
        "origin": request.headers.get("origin", "-"),
    }
    if not user:
        logger.warning(
            "login_failed reason=user_not_found email_fingerprint=%s client_category=%s origin=%s",
            log_context["email_fingerprint"],
            client_category,
            log_context["origin"],
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(payload.password, user.password_hash):
        logger.warning(
            "login_failed reason=password_mismatch user_id=%s email_fingerprint=%s client_category=%s origin=%s",
            user.id,
            log_context["email_fingerprint"],
            client_category,
            log_context["origin"],
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.is_active is False:
        logger.warning(
            "login_failed reason=account_disabled user_id=%s client_category=%s origin=%s",
            user.id,
            client_category,
            log_context["origin"],
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    user.last_login_at = datetime.now(UTC)
    db.commit()
    token = create_access_token(user.id, user.role)
    _set_auth_cookie(response, token)
    logger.info(
        "login_succeeded user_id=%s client_category=%s origin=%s auth_cookie=%s",
        user.id,
        client_category,
        log_context["origin"],
        get_settings().auth_cookie_name,
    )
    return TokenOut(access_token=token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> Response:
    settings = get_settings()
    response.delete_cookie(
        key=settings.auth_cookie_name,
        domain=settings.auth_cookie_domain or None,
        path=settings.auth_cookie_path,
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite=settings.auth_cookie_samesite.lower(),
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut(id=user.id, email=user.email, role=user.role)
