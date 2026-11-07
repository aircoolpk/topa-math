from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models import ChildProfile, Lesson, PublicShare, TestResult, TestSession, User
from app.routers.deps import current_user
from app.services.affiliates import affiliate_summary, request_withdrawal, send_withdrawal_notifications, upsert_payout_account, withdrawal_payload
from app.services.rank_titles import rank_title_for_score
from app.services.referrals import ensure_referral_token, record_referral_event, visitor_hash


router = APIRouter(tags=["share"])


class TestResultShareIn(BaseModel):
    session_id: str


class ReferralClickIn(BaseModel):
    referral_token: str
    share_token: str | None = None


class AffiliatePayoutAccountIn(BaseModel):
    payout_method: str
    account_holder_name: str = Field(min_length=1, max_length=160)
    bank_name: str | None = None
    account_number: str | None = None
    promptpay_value: str | None = None


class AffiliateWithdrawalIn(BaseModel):
    amount_minor: int = Field(gt=0)


def _frontend_base_url() -> str:
    return get_settings().frontend_base_url.rstrip("/")


def _backend_base_url() -> str:
    return get_settings().backend_base_url.rstrip("/")


def _profile(db: Session, user: User) -> ChildProfile:
    child = db.scalar(select(ChildProfile).where(ChildProfile.parent_user_id == user.id))
    if not child:
        raise HTTPException(status_code=404, detail="ไม่พบโปรไฟล์นักเรียน")
    return child


def _display_name(child: ChildProfile) -> str:
    nickname = (child.nickname or "").strip()
    if nickname:
        return nickname
    first = (child.first_name or "").strip()
    if first:
        return first[:1] + "."
    return "นักเรียน TOPA"


def _absolute_url(url: str | None) -> str | None:
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/storage/"):
        return f"{_backend_base_url()}{url}"
    return url


def _referral_url(referral_token: str) -> str:
    return f"{_frontend_base_url()}?ref={referral_token}"


def _share_urls(share_url: str, title: str) -> dict:
    encoded_url = quote(share_url, safe="")
    encoded_text = quote(title, safe="")
    return {
        "share_url": share_url,
        "copy_url": share_url,
        "facebook_url": f"https://www.facebook.com/sharer/sharer.php?u={encoded_url}",
        "x_url": f"https://twitter.com/intent/tweet?url={encoded_url}&text={encoded_text}",
        "line_url": f"https://social-plugins.line.me/lineit/share?url={encoded_url}",
    }


def _create_token(db: Session) -> str:
    for _ in range(5):
        token = secrets.token_urlsafe(18)
        exists = db.scalar(select(PublicShare.id).where(PublicShare.token == token))
        if not exists:
            return token
    raise HTTPException(status_code=500, detail="ไม่สามารถสร้างลิงก์แชร์ได้")


def _create_share(db: Session, *, user: User | None, share_type: str, data: dict) -> PublicShare:
    share = PublicShare(
        token=_create_token(db),
        share_type=share_type,
        created_by_user_id=user.id if user else None,
        data=data,
        expires_at=datetime.now(UTC) + timedelta(days=180),
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    return share


def _lesson_title(db: Session, session: TestSession) -> tuple[str, int | None]:
    lesson = db.get(Lesson, session.lesson_id) if session.lesson_id else None
    content = lesson.content or {} if lesson else {}
    title = str(content.get("title_th") or content.get("title") or lesson.title if lesson else "")
    grade = content.get("grade_level")
    if not title:
        title = "แบบทดสอบ TOPA Math"
    try:
        grade_int = int(grade) if grade is not None else None
    except (TypeError, ValueError):
        grade_int = None
    return title, grade_int


@router.post("/me/share/dashboard")
def create_dashboard_share(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    referral_token = ensure_referral_token(db, user)
    rank = child.current_rank_title or rank_title_for_score(child.total_score or 0)
    title = f"{_display_name(child)} ชวนมาเรียนเลขสนุก ๆ กับ TOPA Math"
    data = {
        "display_name": _display_name(child),
        "avatar_url": _absolute_url(child.student_photo_url),
        "avatar_gender": child.avatar_gender or "girl",
        "grade_level": child.grade_level,
        "level": child.current_level or 1,
        "xp": child.total_xp or 0,
        "score": child.total_score or 0,
        "rank": rank,
        "title": title,
        "description": "มาเรียนเลขสนุก ๆ กับ TOPA Math กันนะ",
        "referral_token": referral_token,
        "cta_url": _referral_url(referral_token),
    }
    share = _create_share(db, user=user, share_type="dashboard", data=data)
    return {**_share_urls(_referral_url(referral_token), title), "mode": "public_share", "token": share.token}


@router.get("/me/referral")
def my_referral(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    from app.services.referrals import referral_summary

    summary = referral_summary(db, user)
    db.commit()
    return summary


@router.get("/me/affiliate")
def my_affiliate(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    summary = affiliate_summary(db, user)
    db.commit()
    return summary


@router.put("/me/affiliate/payout-account")
def save_affiliate_payout_account(payload: AffiliatePayoutAccountIn, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    account = upsert_payout_account(
        db,
        user,
        payout_method=payload.payout_method,
        account_holder_name=payload.account_holder_name,
        bank_name=payload.bank_name,
        account_number=payload.account_number,
        promptpay_value=payload.promptpay_value,
    )
    db.commit()
    return {"ok": True, "payout_account_id": account.id}


@router.post("/me/affiliate/withdrawals")
def create_affiliate_withdrawal(payload: AffiliateWithdrawalIn, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    withdrawal = request_withdrawal(db, user, payload.amount_minor)
    db.commit()
    db.refresh(withdrawal)
    send_withdrawal_notifications(user, withdrawal)
    return {"ok": True, "withdrawal": withdrawal_payload(withdrawal)}


@router.post("/referrals/click")
def track_referral_click(payload: ReferralClickIn, request: Request, db: Session = Depends(get_db)) -> dict:
    user_agent = request.headers.get("user-agent")
    client_host = request.client.host if request.client else None
    event = record_referral_event(
        db,
        token=payload.referral_token,
        event_type="clicked",
        share_token=payload.share_token,
        visitor=visitor_hash(client_host, user_agent),
        metadata={"source": "register_or_share_page"},
    )
    db.commit()
    return {"tracked": bool(event)}


@router.post("/me/share/test-result")
def create_test_result_share(
    payload: TestResultShareIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    child = _profile(db, user)
    referral_token = ensure_referral_token(db, user)
    session = db.get(TestSession, payload.session_id)
    if not session or session.child_profile_id != child.id:
        raise HTTPException(status_code=404, detail="ไม่พบผลสอบนี้")
    result = db.scalar(
        select(TestResult)
        .where(TestResult.test_session_id == session.id, TestResult.child_profile_id == child.id)
        .order_by(TestResult.created_at.desc())
    )
    if not result:
        raise HTTPException(status_code=404, detail="ยังไม่มีผลสอบสำหรับเซสชันนี้")
    lesson_title, grade_level = _lesson_title(db, session)
    score_percent = float(result.accuracy or 0)
    title = f"ผลสอบ TOPA Math: {int(round(score_percent))}%"
    data = {
        "display_name": _display_name(child),
        "lesson_title": lesson_title,
        "grade_level": grade_level or child.grade_level,
        "score_percent": score_percent,
        "correct_count": result.correct_count or 0,
        "total_questions": result.total_questions or 0,
        "badge": "ทำได้ดีมาก!" if score_percent >= 70 else "ฝึกต่ออีกนิด เก่งขึ้นแน่นอน",
        "title": title,
        "description": "ลองฝึกเลขสนุก ๆ กับ TOPA Math แล้วมาเก็บคะแนนไปด้วยกัน",
        "referral_token": referral_token,
        "cta_url": _referral_url(referral_token),
    }
    share = _create_share(db, user=user, share_type="test_result", data=data)
    return {**_share_urls(_referral_url(referral_token), title), "mode": "public_share", "token": share.token}


def _public_share(db: Session, token: str, share_type: str, request: Request | None = None) -> dict:
    share = db.scalar(select(PublicShare).where(PublicShare.token == token, PublicShare.share_type == share_type))
    now = datetime.now(UTC)
    if not share or share.revoked_at or (share.expires_at and share.expires_at < now):
        raise HTTPException(status_code=404, detail="ไม่พบลิงก์แชร์นี้")
    referral_token = str((share.data or {}).get("referral_token") or "")
    if referral_token and request:
        user_agent = request.headers.get("user-agent")
        client_host = request.client.host if request.client else None
        record_referral_event(
            db,
            token=referral_token,
            event_type="clicked",
            share_token=share.token,
            visitor=visitor_hash(client_host, user_agent),
            metadata={"share_type": share.share_type},
        )
        db.commit()
    return {
        "token": share.token,
        "share_type": share.share_type,
        "created_at": share.created_at.isoformat() if share.created_at else None,
        "data": share.data or {},
    }


@router.get("/share/dashboard/{token}")
def get_dashboard_share(token: str, request: Request, db: Session = Depends(get_db)) -> dict:
    return _public_share(db, token, "dashboard", request)


@router.get("/share/test-result/{token}")
def get_test_result_share(token: str, request: Request, db: Session = Depends(get_db)) -> dict:
    return _public_share(db, token, "test_result", request)
