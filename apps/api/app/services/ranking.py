from dataclasses import dataclass
from datetime import datetime


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
