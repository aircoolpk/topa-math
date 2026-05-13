from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import AvatarItem, ChildInventory, ChildProfile
from app.routers.deps import current_user

router = APIRouter(tags=["avatar"])


@router.get("/avatar/items")
def avatar_items(db: Session = Depends(get_db), _user=Depends(current_user)):
    return db.scalars(select(AvatarItem)).all()


@router.get("/children/{child_id}/inventory")
def inventory(child_id: str, db: Session = Depends(get_db), _user=Depends(current_user)):
    return db.scalars(select(ChildInventory).where(ChildInventory.child_profile_id == child_id)).all()


@router.patch("/children/{child_id}/avatar")
def update_avatar(child_id: str, avatar_config: dict, db: Session = Depends(get_db), _user=Depends(current_user)):
    child = db.get(ChildProfile, child_id)
    child.avatar_config = avatar_config
    db.commit()
    return {"avatar_config": child.avatar_config}
