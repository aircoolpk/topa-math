from dataclasses import dataclass
from statistics import pstdev


MASTERY_LEVELS = (
    (80, "mastered"),
    (60, "good"),
    (40, "learning"),
    (0, "needs_help"),
)


@dataclass(frozen=True)
class AnswerResult:
    is_correct: bool
    response_time_ms: int
    difficulty: str = "easy"


def clamp_score(value: float) -> float:
    return round(max(0, min(100, value)), 2)


def mastery_level(score: float) -> str:
    for threshold, level in MASTERY_LEVELS:
        if score >= threshold:
            return level
    return "needs_help"


def speed_score(response_times_ms: list[int], target_ms: int = 10000) -> float:
    valid_times = [time for time in response_times_ms if time and time > 0]
    if not valid_times:
        return 50
    avg_time = sum(valid_times) / len(valid_times)
    return clamp_score(100 - ((avg_time - target_ms) / target_ms * 50))


def consistency_score(results: list[AnswerResult]) -> float:
    if len(results) < 2:
        return 80 if results and results[0].is_correct else 40
    values = [100 if result.is_correct else 0 for result in results]
    deviation = pstdev(values)
    return clamp_score(100 - deviation)


def calculate_mastery_score(results: list[AnswerResult]) -> float:
    if not results:
        return 0
    accuracy = sum(1 for result in results if result.is_correct) / len(results) * 100
    recent = results[-5:]
    recent_performance = sum(1 for result in recent if result.is_correct) / len(recent) * 100
    speed = speed_score([result.response_time_ms for result in results])
    consistency = consistency_score(results)
    return clamp_score((accuracy * 0.6) + (recent_performance * 0.2) + (speed * 0.1) + (consistency * 0.1))


def infer_mistake_type(
    is_correct: bool,
    response_time_ms: int,
    previous_incorrect_for_skill: int = 0,
    slow_threshold_ms: int = 15000,
) -> str | None:
    if is_correct and response_time_ms >= slow_threshold_ms:
        return "speed_issue"
    if is_correct:
        return None
    if response_time_ms and response_time_ms < 1500:
        return "careless_mistake"
    if previous_incorrect_for_skill >= 2:
        return "concept_misunderstanding"
    return "calculation_error"
