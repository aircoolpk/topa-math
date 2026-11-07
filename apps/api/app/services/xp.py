import math


XP_SOURCES = {
    "lesson_complete": 20,
    "correct_answer": 5,
    "daily_quest": 50,
    "weak_skill_improved": 80,
}


def required_xp_for_next_level(level: int) -> int:
    return math.ceil(100 * (max(1, level) ** 1.35))


def level_progress(total_xp: int) -> tuple[int, int, int]:
    """Return (level, xp_into_level, xp_required_for_next_level) for a total XP amount.

    ``level_from_total_xp`` walks the same curve, so the XP already banked
    inside the current level and the XP required to advance to the next one
    are derived from the identical progression:

    * ``xp_into_level`` — XP accumulated since reaching the current level
      (the numerator of the level progress bar).
    * ``xp_required_for_next_level`` — total XP the current level band needs
      before the child levels up (the denominator).
    """
    level = 1
    remaining = max(0, int(total_xp or 0))
    while remaining >= required_xp_for_next_level(level):
        remaining -= required_xp_for_next_level(level)
        level += 1
    return level, remaining, required_xp_for_next_level(level)


def level_from_total_xp(total_xp: int) -> int:
    return level_progress(total_xp)[0]
