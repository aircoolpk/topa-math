"""Badge display metadata.

The ``badges`` table stores an English ``name``/``description`` only, so the
Thai label, emoji icon and category for each badge code live here. Seeded
codes are listed in ``app/seeds/seed.py``.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class BadgeMeta:
    name_th: str
    icon: str
    category: str


BADGE_CATALOG: dict[str, BadgeMeta] = {
    "first-lesson": BadgeMeta(name_th="บทเรียนแรก", icon="🌱", category="learning"),
    "streak-3": BadgeMeta(name_th="ต่อเนื่อง 3 วัน", icon="🔥", category="streak"),
    "streak-7": BadgeMeta(name_th="ต่อเนื่อง 7 วัน", icon="🏆", category="streak"),
    "addition-hero": BadgeMeta(name_th="ผู้เชี่ยวชาญการบวก", icon="➕", category="skill"),
    "speed-star": BadgeMeta(name_th="ดาวจับเวลา", icon="⚡", category="speed"),
    "improvement-champion": BadgeMeta(name_th="แชมป์การพัฒนา", icon="📈", category="growth"),
}

DEFAULT_BADGE_META = BadgeMeta(name_th="", icon="🏅", category="achievement")


def badge_meta(code: str) -> BadgeMeta:
    return BADGE_CATALOG.get(code, DEFAULT_BADGE_META)
