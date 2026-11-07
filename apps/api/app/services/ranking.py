from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models import ChildProfile


@dataclass(frozen=True)
class RankingInput:
    child_profile_id: str
    nickname: str
    grade_level: int
    province: str | None
    mastery_points: float
    median_response_time_ms: int
    improvement_points: float
    daily_xp: int = 0
    repeated_attempts: int = 0
    suspicious_sessions: int = 0


def normalize_speed_points(median_response_time_ms: int, benchmark_ms: int = 10000) -> float:
    if median_response_time_ms < 500:
        return 0
    return round(max(0, min(100, 100 - ((median_response_time_ms - benchmark_ms) / benchmark_ms * 50))), 2)


def rank_score(mastery_points: float, speed_points: float, improvement_points: float) -> float:
    return round((mastery_points * 0.5) + (speed_points * 0.2) + (improvement_points * 0.3), 2)


def build_rankings(rows: list[RankingInput], grade_level: int, province: str | None = None) -> list[dict]:
    filtered = [row for row in rows if row.grade_level == grade_level and (province is None or row.province == province)]
    scored = []
    for row in filtered:
        if row.suspicious_sessions:
            continue
        speed = normalize_speed_points(row.median_response_time_ms)
        score = rank_score(row.mastery_points, speed, row.improvement_points)
        scored.append(
            {
                "child_profile_id": row.child_profile_id,
                "nickname": row.nickname,
                "grade_level": row.grade_level,
                "province": row.province,
                "mastery_points": round(row.mastery_points, 2),
                "speed_points": speed,
                "improvement_points": round(row.improvement_points, 2),
                "rank_score": score,
            }
        )
    scored.sort(key=lambda item: item["rank_score"], reverse=True)
    for index, item in enumerate(scored, start=1):
        item["rank_position"] = index
        item["generated_at"] = datetime.utcnow().isoformat()
    return scored


# ─── Leaderboard position helpers (shared by /rankings, /me/rank-summary,
#     /children/{id}/rank-summary) ────────────────────────────────────────────
#
# The leaderboard ranks a child by (total_score DESC, total_xp DESC) inside a
# scope. "grade" scope = every ranked child in the same grade level;
# "province" scope = same grade level restricted to one province.
# A child is only ranked when they have completed at least one test and have
# a province on file, which mirrors the WHERE clause used by GET /rankings.


def _ranked_filters(child: ChildProfile, scope: str, province: str | None = None):
    filters = [
        ChildProfile.grade_level == child.grade_level,
        ChildProfile.total_tests_completed > 0,
        ChildProfile.province.is_not(None),
    ]
    if scope == "province" and province:
        filters.append(ChildProfile.province == province)
    return filters


def _is_rankable(child: ChildProfile, scope: str, province: str | None = None) -> bool:
    if not child.grade_level:
        return False
    if not (child.total_tests_completed or 0) > 0:
        return False
    if not child.province:
        return False
    if scope == "province" and province and child.province != province:
        return False
    return True


def rank_position(
    db: Session,
    child: ChildProfile,
    scope: str = "grade",
    province: str | None = None,
) -> tuple[int | None, int]:
    """Return (rank_position, total_in_scope) for ``child`` inside ``scope``.

    ``rank_position`` is 1-based and ``None`` when the child is not rankable
    in that scope (no province, no completed tests, …). ``total_in_scope`` is
    always the size of the comparable group.
    """
    filters = _ranked_filters(child, scope, province)
    total_in_scope = int(
        db.execute(select(func.count()).select_from(ChildProfile).where(*filters)).scalar() or 0
    )
    if not _is_rankable(child, scope, province):
        return None, total_in_scope

    higher = db.execute(
        select(func.count())
        .select_from(ChildProfile)
        .where(*filters)
        .where(
            or_(
                ChildProfile.total_score > (child.total_score or 0),
                and_(
                    ChildProfile.total_score == (child.total_score or 0),
                    ChildProfile.total_xp > (child.total_xp or 0),
                ),
            )
        )
    ).scalar()
    return int(higher or 0) + 1, total_in_scope
