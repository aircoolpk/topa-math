RANK_RULES = [
    # MVP thresholds: rank title is computed from total_score, falling back
    # to total_xp where an endpoint has no score yet.
    ("เด็กหลังห้อง", 0),
    ("เด็กนักเรียน", 100),
    ("เด็กเก่ง", 300),
    ("เด็กหัวแถว", 700),
    ("หัวหน้าห้อง", 1200),
    ("ประธานรุ่น", 2000),
    ("เด็กอัจฉริยะ", 3500),
]


def rank_title_for_score(score: int) -> str:
    current = RANK_RULES[0][0]
    for title, min_score in RANK_RULES:
        if score >= min_score:
            current = title
    return current


def next_rank_title_for_score(score: int) -> str | None:
    """Return the rank title one step above ``score``, or None at the top rank."""
    current_index = 0
    for index, (_title, min_score) in enumerate(RANK_RULES):
        if score >= min_score:
            current_index = index
    if current_index + 1 < len(RANK_RULES):
        return RANK_RULES[current_index + 1][0]
    return None
