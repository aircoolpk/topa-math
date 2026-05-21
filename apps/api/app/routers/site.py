from fastapi import APIRouter, Response

from app.services.homepage_content import public_homepage_config

router = APIRouter(prefix="/site", tags=["site"])


@router.get("/homepage")
def site_homepage(response: Response):
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return public_homepage_config()
