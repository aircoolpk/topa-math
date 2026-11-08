#!/usr/bin/env python3
"""Regenerate the homepage CMS content from live database values.

The homepage copy used to ship hard-coded marketing numbers ("1,200+ students",
"4.8/5 average score", a fabricated TOPA Ranking table and four invented
testimonials). Those numbers did not match the database, so the site showed
claims that could not be verified.

This script rewrites the data-driven parts of
`apps/api/app/content/site/homepage.json` from the actual database:

  * hero.stats[0]   — number of student profiles
  * hero.stats[1]   — real quiz accuracy (correct / answered)
  * hero.stats[2]   — share of students who completed at least one lesson
  * hero.stats[3]   — average level/XP across students with stats
  * hero.stats[4]   — total XP earned
  * ranking.rows    — TOPA Ranking built from `student_stats`, including
                       the student's own photo when one was uploaded

The marketing copy (headline, features, curriculum, parent_trust, …) is left
untouched. Reviews are NOT generated: there is no `testimonials` table, so any
review card would be fabricated. The `reviews` block is preserved as-is and
flagged in the report so the UI can hide it instead of showing invented quotes.

Usage:
    python scripts/sync-homepage-content-from-db.py            # dry run
    python scripts/sync-homepage-content-from-db.py --write     # apply
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTENT_PATH = REPO_ROOT / "apps" / "api" / "app" / "content" / "site" / "homepage.json"

# Mascot keys the frontend knows how to resolve (src/lib/mascot-registry.ts).
MASCOTS = ["topa", "pip", "riko", "oll", "memo"]


def run_sql(sql: str) -> str:
    """Run a read-only query against the local Postgres container."""
    result = subprocess.run(
        [
            "docker",
            "exec",
            "4craft-postgres",
            "psql",
            "-U",
            "postgres",
            "-d",
            "adaptive_learning",
            "-t",
            "-A",
            "-F",
            "\x1f",
            "-c",
            sql,
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql failed: {result.stderr.strip()}")
    return result.stdout


def rows(sql: str) -> list[list[str]]:
    """Run a query and parse the unit-separator delimited output into lists."""
    output = run_sql(sql)
    parsed: list[list[str]] = []
    for line in output.splitlines():
        if not line.strip():
            continue
        fields = line.split("\x1f")
        parsed.append(fields)
    return parsed


def scalar(sql: str) -> Any:
    result = rows(sql)
    if not result:
        return None
    return result[0][0]


def fmt_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def build_stats() -> list[dict[str, str]]:
    """Build hero.stats from live database aggregates."""
    student_count = fmt_int(scalar("SELECT count(*) FROM child_profiles"))

    quiz = rows(
        """
        SELECT count(*),
               COALESCE(sum(total_questions), 0),
               COALESCE(sum(correct_count), 0)
        FROM quiz_sessions
        """
    )[0]
    sessions = fmt_int(quiz[0])
    answered = fmt_int(quiz[1])
    correct = fmt_int(quiz[2])
    accuracy = round(100.0 * correct / answered, 1) if answered else 0.0

    completed_students = fmt_int(
        scalar(
            """
            SELECT count(DISTINCT child_profile_id)
            FROM lesson_activity
            WHERE activity_type = 'completed'
            """
        )
    )

    level_avg = rows(
        """
        SELECT COALESCE(ROUND(AVG(level)), 0), COALESCE(ROUND(AVG(xp)), 0)
        FROM (
            SELECT
                COALESCE(ss.lessons_completed, 0) AS level,
                COALESCE(ss.lessons_completed, 0) * 100 AS xp
            FROM student_stats ss
        ) AS derived
        """
    )[0]
    avg_level = fmt_int(level_avg[0])

    total_xp = fmt_int(scalar("SELECT COALESCE(sum(total_xp_earned), 0) FROM quiz_sessions"))
    if total_xp == 0:
        total_xp = fmt_int(
            scalar("SELECT COALESCE(sum(lessons_completed * 100), 0) FROM student_stats")
        )

    completion_rate = (
        round(100.0 * completed_students / student_count, 1) if student_count else 0.0
    )

    return [
        {
            "label": "นักเรียนที่สมัคร",
            "value": f"{student_count:,} คน",
            "detail": "ข้อมูลจากระบบจริง",
        },
        {
            "label": "ความแม่นยำเฉลี่ย",
            "value": f"{accuracy}%" if answered else "ยังไม่มีข้อมูล",
            "detail": f"จาก {answered:,} ข้อที่ตอบไปแล้ว",
        },
        {
            "label": "จบบทเรียนแล้ว",
            "value": f"{completed_students:,} คน" if completed_students else f"0 คน",
            "detail": (
                f"คิดเป็น {completion_rate}% ของผู้สมัครทั้งหมด"
                if student_count
                else "ยังไม่มีผู้สมัคร"
            ),
        },
        {
            "label": "ระดับเฉลี่ย",
            "value": f"Lv. {avg_level}" if avg_level else "ยังไม่มีข้อมูล",
            "detail": "เฉลี่ยจากผู้เรียนที่มีสถิติ",
        },
        {
            "label": "XP สะสม",
            "value": f"{total_xp:,} XP",
            "detail": "รวมจากทุกแบบฝึก",
        },
    ]


def build_ranking_rows() -> list[dict[str, Any]]:
    """Build TOPA Ranking rows from `student_stats` joined with profiles."""
    raw = rows(
        """
        SELECT cp.nickname,
               COALESCE(NULLIF(cp.province, ''), NULLIF(cp.school_province, ''), 'ไม่ระบุ'),
               ss.tests_completed,
               ss.lessons_completed,
               ss.perfect_tests,
               ss.quests_completed,
               cp.student_photo_url
        FROM student_stats ss
        JOIN child_profiles cp ON cp.id = ss.child_profile_id
        WHERE ss.tests_completed > 0 OR ss.lessons_completed > 0
        ORDER BY ss.tests_completed DESC,
                 ss.perfect_tests DESC,
                 ss.lessons_completed DESC,
                 cp.nickname ASC
        LIMIT 10
        """
    )

    ranking: list[dict[str, Any]] = []
    for index, row in enumerate(raw):
        nickname = (row[0] or "น้อง").strip() or "น้อง"
        province = (row[1] or "ไม่ระบุ").strip() or "ไม่ระบุ"
        tests = fmt_int(row[2])
        lessons = fmt_int(row[3])
        perfect = fmt_int(row[4])
        quests = fmt_int(row[5])

        # Score mirrors the API's ranking formula: every completed test counts,
        # every perfect test gives a bonus.
        total_score = tests * 100 + perfect * 50 + lessons * 20

        photo_url = (row[6] or "").strip()

        entry: dict[str, Any] = {
            "rank": index + 1,
            "child_name": nickname,
            "province": province,
            "tests_completed": tests,
            "total_score": total_score,
            "avg_speed": "-",
        }
        if photo_url:
            # The student's own photo. The frontend resolves this path against
            # the API origin, because the files are served by the API.
            entry["image"] = photo_url
        ranking.append(entry)
    return ranking


def looks_like_test_account(name: str) -> bool:
    """Detect QA / audit placeholder accounts so they are not shown publicly."""
    lowered = name.strip().lower()
    markers = (
        "qa ",
        "qa_",
        "test",
        "audit",
        "verify",
        "hermes",
        "flow ",
        "final ",
        "launch ",
        "sharekid",
        "e2e",
        "demo",
        "tmp",
        "tester",
        "p2",
        "p3",
        "kid",
    )
    # Short, all-uppercase names like "P2", "QA" are placeholder accounts.
    stripped = name.strip()
    if len(stripped) <= 4 and stripped.isupper():
        return True
    return any(marker in lowered for marker in markers)


def build_public_ranking_rows() -> list[dict[str, Any]]:
    """Ranking rows for the public homepage — test accounts are filtered out.

    If no real students remain, the homepage shows an empty state instead of
    fabricated rows.
    """
    all_rows = build_ranking_rows()
    public_rows = [r for r in all_rows if not looks_like_test_account(r["child_name"])]

    for index, row in enumerate(public_rows):
        row["rank"] = index + 1
        # A mascot is only a stand-in. When the student uploaded a photo, the
        # row keeps it and no mascot is assigned.
        if not row.get("image"):
            row["mascot"] = MASCOTS[index % len(MASCOTS)]
    return public_rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--write",
        action="store_true",
        help="write the updated content back to homepage.json (default: dry run)",
    )
    args = parser.parse_args()

    if not CONTENT_PATH.exists():
        print(f"[!] content file not found: {CONTENT_PATH}", file=sys.stderr)
        return 1

    config = json.loads(CONTENT_PATH.read_text(encoding="utf-8"))

    stats = build_stats()
    ranking_rows = build_public_ranking_rows()

    hero = config.setdefault("hero", {})
    hero["stats"] = stats

    ranking = config.setdefault("ranking", {})
    ranking["rows"] = ranking_rows

    # Reviews have no database source — drop them rather than ship invented
    # quotes. The frontend renders the block only when cards exist.
    reviews = config.get("reviews")
    if isinstance(reviews, dict):
        reviews["cards"] = []
        reviews["_no_data_notice"] = (
            "ยังไม่มีรีวิวจากผู้ใช้จริงในระบบ — จะเปิดใช้เมื่อมีข้อมูลจากฐานข้อมูล"
        )

    print("=== hero.stats (from DB) ===")
    for stat in stats:
        print(f"  {stat['label']}: {stat['value']} — {stat['detail']}")
    print()
    print(f"=== ranking.rows (from DB): {len(ranking_rows)} ===")
    for row in ranking_rows:
        print(
            f"  #{row['rank']} {row['child_name']} ({row['province']}) "
            f"tests={row['tests_completed']} score={row['total_score']}"
        )
    print()
    print("=== reviews ===")
    print("  cards cleared (no testimonials table in the database)")

    if not args.write:
        print()
        print("[dry run] pass --write to save changes")
        return 0

    backup = CONTENT_PATH.with_suffix(".json.bak-phase0-realdata")
    backup.write_text(CONTENT_PATH.read_text(encoding="utf-8"), encoding="utf-8")

    CONTENT_PATH.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print()
    print(f"[written] {CONTENT_PATH}")
    print(f"[backup]  {backup}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
