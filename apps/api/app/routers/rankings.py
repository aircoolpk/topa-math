from fastapi import APIRouter, Depends

from app.routers.deps import current_user
from app.services.ranking import RankingInput, build_rankings

router = APIRouter(prefix="/rankings", tags=["rankings"])


@router.get("")
def rankings(grade_level: int, scope: str = "country", province: str | None = None, _user=Depends(current_user)):
    sample = [
        RankingInput("demo-1", "น้องดาว", grade_level, province or "Bangkok", 82, 7200, 18),
        RankingInput("demo-2", "น้องเมฆ", grade_level, province or "Bangkok", 74, 6500, 25),
    ]
    return build_rankings(sample, grade_level=grade_level, province=province if scope == "province" else None)
