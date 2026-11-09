from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.announcements import public_announcement_items
from app.services.homepage_content import public_homepage_config

router = APIRouter(prefix="/site", tags=["site"])


@router.get("/homepage")
def site_homepage(response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return public_homepage_config(announcements={"items": public_announcement_items(db)})


@router.get("/announcements")
def site_announcements(db: Session = Depends(get_db)):
    return {"items": public_announcement_items(db)}
