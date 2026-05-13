from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import AvatarItem, ChildInventory, ChildProfile, User
from app.routers.deps import current_user
from app.schemas.api import ChildCreate, ChildOut, ChildUpdate
from app.services.xp import level_from_total_xp

router = APIRouter(prefix="/children", tags=["children"])


def child_to_out(child: ChildProfile) -> ChildOut:
    return ChildOut(
        id=child.id,
        first_name=child.first_name,
        last_name=child.last_name,
        nickname=child.nickname or "",
        grade_level=child.grade_level or 1,
        province=child.province,
        district=child.district,
        school_name=child.school_name,
        school_province=child.school_province,
        school_district=child.school_district,
        student_photo_url=child.student_photo_url,
        student_photo_path=child.student_photo_path,
        avatar_gender=child.avatar_gender,
        avatar_config=child.avatar_config or {},
        program_type=child.program_type or "THP",
        membership_status=child.membership_status or "free",
        total_score=child.total_score or 0,
        total_xp=child.total_xp or 0,
        coins=child.coins or 0,
        current_level=child.current_level or 1,
        days_active=child.days_active or 0,
        test_attempts_used=child.test_attempts_used or 0,
        free_test_limit=child.free_test_limit or 5,
        total_tests_completed=child.total_tests_completed or 0,
        average_test_accuracy=float(child.average_test_accuracy or 0),
        average_test_speed=float(child.average_test_speed or 0),
        current_rank_title=child.current_rank_title or "Beginner",
        streak_count=child.streak_count or 0,
        created_at=child.created_at,
        updated_at=child.updated_at,
    )


@router.post("", response_model=ChildOut)
def create_child(payload: ChildCreate, db: Session = Depends(get_db), user: User = Depends(current_user)) -> ChildOut:
    existing = db.scalar(select(ChildProfile).where(ChildProfile.parent_user_id == user.id))
    if existing:
        raise HTTPException(status_code=409, detail="User already has a student profile")
    child = ChildProfile(parent_user_id=user.id, **payload.model_dump())
    db.add(child)
    db.flush()
    default_items = db.scalars(select(AvatarItem).where(AvatarItem.is_default.is_(True))).all()
    for item in default_items:
        db.add(ChildInventory(child_profile_id=child.id, avatar_item_id=item.id))
    db.commit()
    db.refresh(child)
    return child_to_out(child)


@router.get("", response_model=list[ChildOut])
def list_children(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[ChildOut]:
    children = db.scalars(select(ChildProfile).where(ChildProfile.parent_user_id == user.id)).all()
    return [child_to_out(child) for child in children]


@router.patch("/{child_id}", response_model=ChildOut)
def update_child(
    child_id: str,
    payload: ChildUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> ChildOut:
    child = db.get(ChildProfile, child_id)
    if not child or child.parent_user_id != user.id:
        raise HTTPException(status_code=404, detail="Child not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(child, field, value)
    db.commit()
    db.refresh(child)
    return child_to_out(child)


@router.get("/{child_id}", response_model=ChildOut)
def get_child(child_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> ChildOut:
    child = db.get(ChildProfile, child_id)
    if not child or child.parent_user_id != user.id:
        raise HTTPException(status_code=404, detail="Child not found")
    child.current_level = level_from_total_xp(child.total_xp)
    return child_to_out(child)
