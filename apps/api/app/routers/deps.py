import logging

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import get_settings
from app.core.security import decode_token
from app.models import User

logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def current_user(request: Request, token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    token = token or request.cookies.get(get_settings().auth_cookie_name)
    if not token:
        logger.warning("auth_unauthorized cause=missing_token path=%s method=%s", request.url.path, request.method)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except ValueError as exc:
        logger.warning("auth_unauthorized cause=invalid_token path=%s method=%s", request.url.path, request.method)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    user = db.get(User, payload.get("sub"))
    if not user:
        logger.warning("auth_unauthorized cause=user_not_found path=%s method=%s user_id=%s", request.url.path, request.method, payload.get("sub"))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.is_active is False:
        logger.warning("auth_forbidden cause=disabled_user path=%s method=%s user_id=%s", request.url.path, request.method, user.id)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role not in {"admin", "owner"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return user
