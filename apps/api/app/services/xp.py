import math


XP_SOURCES = {
    "lesson_complete": 20,
    "correct_answer": 5,
    "daily_quest": 50,
    "weak_skill_improved": 80,
}


def required_xp_for_next_level(level: int) -> int:
    return math.ceil(100 * (max(1, level) ** 1.35))


def level_from_total_xp(total_xp: int) -> int:
    level = 1
    remaining = max(0, total_xp)
    while remaining >= required_xp_for_next_level(level):
        remaining -= required_xp_for_next_level(level)
        level += 1
    return level
