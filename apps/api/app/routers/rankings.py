from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.routers.deps import current_user

router = APIRouter(prefix="/rankings", tags=["rankings"])


def _normalize_speed(average_speed_ms: float | None) -> float:
    """Convert avg response time to 0-100 speed score.

    Uses the same formula as the legacy service to keep rankings stable.
    """
    if average_speed_ms is None or average_speed_ms < 500:
        return 0.0
    benchmark_ms = 10000
    return round(
        max(0, min(100, 100 - ((average_speed_ms - benchmark_ms) / benchmark_ms * 50))),
        2,
    )


def _row_to_payload(row, rank_position: int) -> dict:
    mastery = float(row.total_score or 0)
    speed = _normalize_speed(float(row.average_test_speed) if row.average_test_speed is not None else None)
    improvement = float(row.total_xp or 0) / 100.0  # scale XP into improvement_points
    improvement = round(min(100, improvement), 2)
    rank_score = round((mastery * 0.5) + (speed * 0.2) + (improvement * 0.3), 2)
    return {
        "rank_position": rank_position,
        "child_profile_id": row.id,
        "nickname": row.nickname,
        "grade_level": row.grade_level,
        "province": row.province,
        "school_name": row.school_name,
        "mastery_points": mastery,
        "speed_points": speed,
        "improvement_points": improvement,
        "rank_score": rank_score,
        "total_tests_completed": row.total_tests_completed,
        "current_level": row.current_level,
        "streak_count": row.streak_count,
        "current_rank_title": row.current_rank_title,
        "student_photo_url": row.student_photo_url,
    }


@router.get("")
def get_rankings(
    grade_level: int = Query(..., ge=1, le=12, description="Grade level to filter by (1-12)."),
    scope: str = Query("country", description="One of: country, province, grade, school."),
    province: str | None = Query(None, description="Province filter for scope=province."),
    school: str | None = Query(None, description="School name filter for scope=school."),
    limit: int = Query(100, ge=1, le=500),
    _user=Depends(current_user),
    db: Session = Depends(get_db),
):
    """Real ranking data aggregated from child_profiles.

    Scope meanings:
      - country:   all children nationwide (default), filtered by grade_level
      - province:  children in the given province (requires `province` param)
      - grade:     alias for country — already filtered by grade_level
      - school:    children in the given school_name (requires `school` param)
    """
    scope = scope.lower().strip()
    if scope not in ("country", "province", "grade", "school"):
        raise HTTPException(status_code=400, detail=f"Invalid scope: {scope}")

    if scope == "province" and not province:
        raise HTTPException(status_code=400, detail="scope=province requires ?province=<name>")
    if scope == "school" and not school:
        raise HTTPException(status_code=400, detail="scope=school requires ?school=<name>")

    where = [
        "cp.grade_level = :grade_level",
        "cp.total_tests_completed > 0",
        "cp.province IS NOT NULL",
    ]
    params: dict = {"grade_level": grade_level, "limit": limit}

    if scope == "province":
        where.append("cp.province = :province")
        params["province"] = province
    elif scope == "school":
        where.append("cp.school_name = :school")
        params["school"] = school

    sql = text(
        f"""
        SELECT
            cp.id,
            cp.nickname,
            cp.grade_level,
            cp.province,
            cp.school_name,
            cp.total_score,
            cp.total_xp,
            cp.current_level,
            cp.total_tests_completed,
            cp.streak_count,
            cp.average_test_speed,
            cp.current_rank_title,
            cp.student_photo_url
        FROM child_profiles cp
        WHERE {' AND '.join(where)}
        ORDER BY cp.total_score DESC, cp.total_xp DESC
        LIMIT :limit
        """
    )

    rows = db.execute(sql, params).fetchall()
    entries = [_row_to_payload(r, idx + 1) for idx, r in enumerate(rows)]

    # Find current user's children to compute child_own_rank
    own_sql = text(
        """
        SELECT id FROM child_profiles
        WHERE parent_user_id = :user_id
        """
    )
    my_children = [r[0] for r in db.execute(own_sql, {"user_id": _user.id}).fetchall()]

    child_own_rank = None
    if my_children:
        # Pick the best-ranked child (by total_score) for the user
        best_sql = text(
            """
            SELECT
                cp.id,
                cp.nickname,
                cp.grade_level,
                cp.province,
                cp.school_name,
                cp.total_score,
                cp.total_xp,
                cp.current_level,
                cp.total_tests_completed,
                cp.streak_count,
                cp.average_test_speed,
                cp.current_rank_title,
                cp.student_photo_url
            FROM child_profiles cp
            WHERE cp.id = ANY(:ids)
            ORDER BY cp.total_score DESC
            LIMIT 1
            """
        )
        best_row = db.execute(best_sql, {"ids": my_children}).fetchone()
        if best_row:
            # Compute the global position by counting higher-scored profiles
            count_sql = text(
                f"""
                SELECT COUNT(*) FROM child_profiles cp
                WHERE {' AND '.join(where)}
                  AND (cp.total_score > :my_score
                       OR (cp.total_score = :my_score AND cp.total_xp > :my_xp))
                """
            )
            params_count = {**params, "my_score": best_row.total_score, "my_xp": best_row.total_xp}
            higher_count = db.execute(count_sql, params_count).scalar() or 0
            child_own_rank = _row_to_payload(best_row, higher_count + 1)

    # Province roll-up for the selected grade (used by province scope UI to show
    # "other provinces" totals when scope=province)
    province_summary = []
    summary_sql = text(
        """
        SELECT
            cp.province,
            COUNT(*) AS child_count,
            AVG(cp.total_score)::numeric(10,2) AS avg_score,
            MAX(cp.total_score) AS top_score
        FROM child_profiles cp
        WHERE cp.grade_level = :grade_level
          AND cp.total_tests_completed > 0
          AND cp.province IS NOT NULL
        GROUP BY cp.province
        ORDER BY top_score DESC
        """
    )
    summary_rows = db.execute(summary_sql, {"grade_level": grade_level}).fetchall()
    province_summary = [
        {
            "province": r.province,
            "child_count": int(r.child_count),
            "avg_score": float(r.avg_score or 0),
            "top_score": int(r.top_score or 0),
        }
        for r in summary_rows
    ]

    return {
        "scope": scope,
        "grade_level": grade_level,
        "province": province if scope == "province" else None,
        "school": school if scope == "school" else None,
        "entries": entries,
        "child_own_rank": child_own_rank,
        "province_summary": province_summary,
        "is_mock": False,
    }
