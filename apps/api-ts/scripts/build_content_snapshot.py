"""Build the Worker content snapshot from the FastAPI content directory.

The legacy FastAPI service serves the lesson catalogue and the lesson detail
from the filesystem (``apps/api/app/content/math``) plus the sidecar approval
status files, **not** from the ``lessons`` table in Postgres. The table is only
a lazily written mirror of whichever variant a child happened to open, so it
cannot reproduce the catalogue (verified: the mirror's title for
``g3_addition_subtraction`` is "…(ตอนที่ 2)" while the canonical file title is
"…", and the mirror has no ``g3_numbers`` row at all).

To port the endpoints without a 105 MB bundle we therefore snapshot exactly
the two things the Worker needs:

* the *student-visible* catalogue per (program, grade) — the same rows
  ``list_canonical_lessons`` produces, and
* the full payload of every **approved** lesson / quiz variant, plus the
  per-variant review status of *all* variants (needed by
  ``topic_folder_diagnostics``).

Approval is resolved with FastAPI's own ``lesson_content`` service so the
snapshot can never drift from the legacy behaviour.

Usage::

    apps/api/.venv/Scripts/python.exe apps/api-ts/scripts/build_content_snapshot.py

The output is written to ``apps/api-ts/src/content/lessons.snapshot.json``.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = REPO_ROOT / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))
os.chdir(API_ROOT)

from app.services import lesson_content as lc  # noqa: E402  (needs the path above)

OUTPUT = REPO_ROOT / "apps" / "api-ts" / "src" / "content" / "lessons.snapshot.json"

PROGRAMS = ("TH", "EP")
GRADES = range(1, 7)

# Machine-specific fields that never reach an API response but would make the
# snapshot non-portable between build machines.
_STRIP_KEYS = ("source_path", "active_content_source_path", "source_folder")


def _portable(payload: dict) -> dict:
    """Return the payload with absolute build-machine paths removed."""
    cleaned = {key: value for key, value in payload.items() if key not in _STRIP_KEYS}
    return cleaned


def _lesson_variants(grade: int, topic: str, program: str) -> list[dict]:
    """Approved lesson variants for a topic, in the legacy sort order."""
    rows = []
    for path, payload in lc.list_topic_lesson_variants(grade, topic, program, approved_only=True):
        rows.append(
            {
                "variant_id": str(payload.get("selected_variant_id") or payload.get("variant_id") or path.stem),
                "status": str(payload.get("variant_status") or payload.get("status") or ""),
                "source_filename": path.name,
                "source_path_hash": lc._source_path_hash(path),
                "payload": _portable(payload),
            }
        )
    return rows


def _quiz_variants(grade: int, topic: str, program: str) -> list[dict]:
    """Approved quiz variants for a topic, in the legacy sort order."""
    rows = []
    for path, payload in lc.list_topic_quiz_variants(grade, topic, program, approved_only=True):
        quiz_variant_id = str(payload.get("quiz_variant_id") or payload.get("variant_id") or path.stem)
        rows.append(
            {
                "quiz_variant_id": quiz_variant_id,
                "status": str(payload.get("variant_status") or payload.get("status") or ""),
                "source_filename": path.name,
                "source_path_hash": lc._source_path_hash(path),
                "questions": lc.topic_quiz_questions_from_variant(grade, topic, program, quiz_variant_id),
            }
        )
    return rows


def _catalog(grade: int, program: str) -> list[dict]:
    """The student-visible catalogue rows for one (grade, program)."""
    items = lc.list_topic_folder_lessons(grade, program, approved_only=True, include_empty=False)
    rows = []
    for item in items:
        rows.append(
            {
                "lesson_id": item["lesson_id"],
                "lesson_group_id": item.get("lesson_group_id"),
                "topic_folder": item.get("topic_folder"),
                "grade_level": item.get("grade_level"),
                "title": item.get("title"),
                "title_th": item.get("title_th"),
                "title_en": item.get("title_en"),
                "description": item.get("description"),
                "description_th": item.get("description_th"),
                "topic_code": item.get("topic_code"),
                "skill_code": item.get("skill_code"),
                "estimated_minutes": item.get("estimated_minutes"),
                "has_approved_test": bool(item.get("has_approved_test")),
                "test_available": bool(item.get("test_available")),
                "test_unavailable_reason": item.get("test_unavailable_reason"),
            }
        )
    return rows


def _diagnostics(grade: int, program: str) -> list[dict]:
    """The per-topic diagnostics rows ``topic_folder_diagnostics`` produces."""
    rows = []
    for topic in lc.discover_topic_folders(grade, "lessons", program):
        lesson_variants = lc.list_topic_lesson_variants(grade, topic, program, approved_only=False)
        approved_lessons = lc.list_topic_lesson_variants(grade, topic, program, approved_only=True)
        quiz_variants = lc.list_topic_quiz_variants(grade, topic, program, approved_only=False)
        approved_quizzes = lc.list_topic_quiz_variants(grade, topic, program, approved_only=True)
        statuses = [lc._topic_variant_status(payload) for _path, payload in lesson_variants]
        counts = {status: statuses.count(status) for status in sorted(set(statuses))}
        approved_count = counts.get("approved", 0) + counts.get("published", 0) + counts.get("active", 0)
        hidden_reason = None
        if not lesson_variants:
            hidden_reason = "no_lesson_variants"
        elif not approved_lessons:
            hidden_reason = "found_files_but_needs_review"
        rows.append(
            {
                "topic_folder": topic,
                "lesson_group_id": lc._topic_lesson_group_id(grade, topic),
                "variant_count": len(lesson_variants),
                "approved_variant_count": approved_count,
                "needs_review_variant_count": counts.get("needs_review", 0),
                "rejected_variant_count": counts.get("rejected", 0),
                "beta_visible_count": sum(1 for status in statuses if lc._topic_status_is_student_visible(status)),
                "quiz_variant_count": len(quiz_variants),
                "approved_quiz_count": len(approved_quizzes),
                "student_visible": bool(approved_lessons),
                "test_available": bool(approved_quizzes),
                "hidden_reason": hidden_reason,
            }
        )
    return rows


def build() -> dict:
    snapshot: dict = {
        "version": 1,
        "generated_at": None,
        "programs": {},
    }
    for program in PROGRAMS:
        grades: dict = {}
        for grade in GRADES:
            topics: dict = {}
            for topic in lc.discover_topic_folders(grade, "lessons", program):
                lesson_variants = _lesson_variants(grade, topic, program)
                quiz_variants = _quiz_variants(grade, topic, program)
                if not lesson_variants and not quiz_variants:
                    continue
                topics[topic] = {
                    "topic_folder": topic,
                    "lesson_group_id": lc._topic_lesson_group_id(grade, topic),
                    "lesson_variants": lesson_variants,
                    "quiz_variants": quiz_variants,
                }
            grades[str(grade)] = {
                "catalog": _catalog(grade, program),
                "diagnostics": _diagnostics(grade, program),
                "topics": topics,
            }
        snapshot["programs"][program] = {"grades": grades}
    return snapshot


def main() -> None:
    from datetime import datetime, timezone

    snapshot = build()
    snapshot["generated_at"] = datetime.now(timezone.utc).isoformat()

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1), encoding="utf-8")

    size_kb = OUTPUT.stat().st_size / 1024
    lesson_variants = sum(
        len(topic["lesson_variants"])
        for program in snapshot["programs"].values()
        for grade in program["grades"].values()
        for topic in grade["topics"].values()
    )
    quiz_variants = sum(
        len(topic["quiz_variants"])
        for program in snapshot["programs"].values()
        for grade in program["grades"].values()
        for topic in grade["topics"].values()
    )
    catalog_rows = sum(
        len(grade["catalog"])
        for program in snapshot["programs"].values()
        for grade in program["grades"].values()
    )
    print(f"wrote {OUTPUT} ({size_kb:.1f} KB)")
    print(f"  catalog rows       : {catalog_rows}")
    print(f"  approved lessons   : {lesson_variants}")
    print(f"  approved quizzes   : {quiz_variants}")


if __name__ == "__main__":
    main()
