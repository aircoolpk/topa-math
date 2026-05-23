"""Content status management via sidecar JSON files.

Sidecar files live alongside the content they describe:
  apps/api/app/content/math/_content_status/lessons.json
  apps/api/app/content/math/_content_status/tests.json

Each file maps a content ID to its review status metadata.
"""
from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "math"
_STATUS_DIR = _CONTENT_ROOT / "_content_status"
_BACKUP_DIR = _CONTENT_ROOT / "_content_backups"
_LESSONS_STATUS_FILE = _STATUS_DIR / "lessons.json"
_TESTS_STATUS_FILE = _STATUS_DIR / "tests.json"
_INDEX_FILE = _BACKUP_DIR / "index.json"

# ---------------------------------------------------------------------------
# Valid status values
# ---------------------------------------------------------------------------

VALID_LESSON_STATUSES = {"approved", "needs_review", "draft", "rejected", "archived"}
VALID_TEST_STATUSES = {"approved", "needs_review", "draft", "rejected", "archived"}

# ---------------------------------------------------------------------------
# Content backup
# ---------------------------------------------------------------------------


def backup_lesson(lesson_id: str, edited_by: str = "", note: str = "") -> Path | None:
    """Backup a lesson JSON file before it is overwritten.

    Creates a timestamped copy in _content_backups/YYYYMMDD/.
    Records the backup in _content_backups/index.json.

    Returns the backup path, or None if the lesson file does not exist.
    """
    safe_id = _safe_lesson_id(lesson_id)
    from app.services.lesson_content import _lesson_files

    for path in _lesson_files():
        if path.stem == safe_id or path.stem.startswith(f"{safe_id}_"):
            return _write_lesson_backup(path, safe_id, edited_by, note)
    return None


def backup_question(question_id: str, edited_by: str = "", note: str = "") -> Path | None:
    """Backup a question JSON file before it is overwritten.

    Searches only active grade_N/quizzes roots for the question file.
    """
    from app.services.lesson_content import _quiz_files, _load_question_rows

    safe_id = _safe_test_id(question_id)  # reuse same sanitization
    for path in _quiz_files():
        rows = _load_question_rows(path)
        for idx, row in enumerate(rows):
            row_id = str(row.get("question_id") or row.get("id") or f"{path.stem}:{idx}")
            if row_id == safe_id:
                return _write_question_backup(path, safe_id, edited_by, note)
    return None


def _write_lesson_backup(path: Path, lesson_id: str, edited_by: str, note: str) -> Path:
    now = datetime.now(UTC)
    date_str = now.strftime("%Y%m%d")
    time_str = now.strftime("%H%M%S")
    backup_name = f"{date_str}_{time_str}_{path.stem}.json"
    backup_dir = _BACKUP_DIR / date_str
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / backup_name
    import shutil
    shutil.copy2(path, backup_path)
    _record_backup(
        lesson_id=lesson_id,
        backup_path=backup_path,
        edited_by=edited_by,
        note=note,
        backed_up_at=now.isoformat(),
        backup_type="lesson",
    )
    return backup_path


def _write_question_backup(path: Path, question_id: str, edited_by: str, note: str) -> Path:
    now = datetime.now(UTC)
    date_str = now.strftime("%Y%m%d")
    time_str = now.strftime("%H%M%S")
    backup_name = f"{date_str}_{time_str}_{path.stem}_{question_id}.json"
    backup_dir = _BACKUP_DIR / date_str
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / backup_name
    import shutil
    shutil.copy2(path, backup_path)
    _record_backup(
        lesson_id=question_id,
        backup_path=backup_path,
        edited_by=edited_by,
        note=note,
        backed_up_at=now.isoformat(),
        backup_type="question",
    )
    return backup_path


def _record_backup(lesson_id: str, backup_path: Path, edited_by: str, note: str, backed_up_at: str, backup_type: str) -> None:
    index = _load_backup_index()
    entry = {
        "lesson_id": lesson_id,
        "backup_path": str(backup_path),
        "edited_by": edited_by,
        "note": note,
        "backed_up_at": backed_up_at,
        "backup_type": backup_type,
    }
    index.append(entry)
    _BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    _write_json(_INDEX_FILE, index)


def _load_backup_index() -> list[dict[str, Any]]:
    try:
        data = _read_json(_INDEX_FILE)
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def list_backups(lesson_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    """List recent backups, optionally filtered by lesson_id."""
    index = _load_backup_index()
    if lesson_id:
        index = [e for e in index if e.get("lesson_id") == lesson_id]
    return sorted(index, key=lambda e: e.get("backed_up_at", ""), reverse=True)[:limit]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _read_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return None


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _safe_lesson_id(lesson_id: str) -> str:
    """Normalize lesson_id so it can't escape the content directory."""
    # Remove any path traversal attempts
    safe = lesson_id.strip().replace("..", "").replace("/", "").replace("\\", "")
    # Only allow reasonable filename characters
    if not re.match(r"^[a-zA-Z0-9_\-]+$", safe):
        raise ValueError(f"Invalid lesson_id: {lesson_id!r}")
    return safe


def _safe_test_id(test_id: str) -> str:
    safe = test_id.strip().replace("..", "").replace("/", "").replace("\\", "")
    if not re.match(r"^[a-zA-Z0-9_\-]+$", safe):
        raise ValueError(f"Invalid test_id: {test_id!r}")
    return safe


# ---------------------------------------------------------------------------
# Lesson status file I/O
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def load_lessons_status() -> dict[str, dict[str, Any]]:
    """Load the entire lessons sidecar status file.

    Returns {} if the file does not exist yet.
    """
    if not _LESSONS_STATUS_FILE.exists():
        return {}
    data = _read_json(_LESSONS_STATUS_FILE)
    return data if isinstance(data, dict) else {}


def save_lessons_status(status_dict: dict[str, dict[str, Any]]) -> None:
    """Write the entire lessons sidecar status file."""
    _write_json(_LESSONS_STATUS_FILE, status_dict)
    load_lessons_status.cache_clear()


# ---------------------------------------------------------------------------
# Test status file I/O
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def load_tests_status() -> dict[str, dict[str, Any]]:
    """Load the entire tests sidecar status file.

    Returns {} if the file does not exist yet.
    """
    if not _TESTS_STATUS_FILE.exists():
        return {}
    data = _read_json(_TESTS_STATUS_FILE)
    return data if isinstance(data, dict) else {}


def save_tests_status(status_dict: dict[str, dict[str, Any]]) -> None:
    """Write the entire tests sidecar status file."""
    _write_json(_TESTS_STATUS_FILE, status_dict)
    load_tests_status.cache_clear()


# ---------------------------------------------------------------------------
# Per-lesson status accessors
# ---------------------------------------------------------------------------


def get_lesson_status(lesson_id: str) -> dict[str, Any]:
    """Return the status metadata for a single lesson.

    Returns a default "needs_review" entry if the lesson_id is not yet tracked.
    """
    all_status = load_lessons_status()
    safe_id = _safe_lesson_id(lesson_id)
    return dict(all_status.get(safe_id, {}))


def is_lesson_approved(lesson_id: str) -> bool:
    """Return True when a lesson has status 'approved'."""
    status = get_lesson_status(lesson_id)
    return str(status.get("status", "")).lower() == "approved"


def _set_lesson_status(
    lesson_id: str,
    status: str,
    reviewer_note: str = "",
    approved_by: str = "",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Internal writer used by update_lesson_status and the approve/reject helpers."""
    if status not in VALID_LESSON_STATUSES:
        raise ValueError(f"Invalid lesson status: {status!r}")

    all_status = load_lessons_status()
    safe_id = _safe_lesson_id(lesson_id)

    now = datetime.now(UTC).isoformat()
    entry = all_status.setdefault(safe_id, {})

    entry["status"] = status
    if reviewer_note:
        entry["reviewer_note"] = reviewer_note
    if approved_by:
        entry["approved_by"] = approved_by
    if status == "approved":
        entry["approved_at"] = now
    entry["updated_at"] = now

    if extra:
        entry.update(extra)

    all_status[safe_id] = entry
    save_lessons_status(all_status)
    return dict(entry)


def update_lesson_status(
    lesson_id: str,
    status: str,
    reviewer_note: str = "",
    approved_by: str = "",
    **extra: Any,
) -> dict[str, Any]:
    """Update or create the status record for a lesson."""
    return _set_lesson_status(lesson_id, status, reviewer_note, approved_by, extra)


# ---------------------------------------------------------------------------
# Per-test status accessors
# ---------------------------------------------------------------------------


def get_test_status(test_id: str) -> dict[str, Any]:
    """Return the status metadata for a single test/quiz.

    Returns a default "needs_review" entry if not tracked.
    """
    all_status = load_tests_status()
    safe_id = _safe_test_id(test_id)
    return dict(all_status.get(safe_id, {}))


def is_test_approved(test_id: str) -> bool:
    """Return True when a test has status 'approved'."""
    status = get_test_status(test_id)
    return str(status.get("status", "")).lower() == "approved"


def _set_test_status(
    test_id: str,
    status: str,
    reviewer_note: str = "",
    approved_by: str = "",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Internal writer for test status updates."""
    if status not in VALID_TEST_STATUSES:
        raise ValueError(f"Invalid test status: {status!r}")

    all_status = load_tests_status()
    safe_id = _safe_test_id(test_id)

    now = datetime.now(UTC).isoformat()
    entry = all_status.setdefault(safe_id, {})

    entry["status"] = status
    if reviewer_note:
        entry["reviewer_note"] = reviewer_note
    if approved_by:
        entry["approved_by"] = approved_by
    if status == "approved":
        entry["approved_at"] = now
    entry["updated_at"] = now

    if extra:
        entry.update(extra)

    all_status[safe_id] = entry
    save_tests_status(all_status)
    return dict(entry)


def update_test_status(
    test_id: str,
    status: str,
    reviewer_note: str = "",
    approved_by: str = "",
    **extra: Any,
) -> dict[str, Any]:
    """Update or create the status record for a test."""
    return _set_test_status(test_id, status, reviewer_note, approved_by, extra)


# ---------------------------------------------------------------------------
# Content initialization
# ---------------------------------------------------------------------------


def _detect_language(lesson_id: str) -> str:
    """Detect language from lesson_id suffix.

    _ep / _EP suffix → EP
    Otherwise → TH (THP Thai program)
    """
    if lesson_id.lower().endswith("_ep"):
        return "EP"
    return "TH"


def _lesson_files() -> list[Path]:
    from app.services.lesson_content import active_content_roots, path_is_active_content

    files: list[Path] = []
    for root in active_content_roots("lessons"):
        if not root.exists():
            continue
        files.extend(path for path in root.glob("*/*.json") if path_is_active_content(path, "lessons"))
        subfolders = {path.parent.name for path in files if path.parent.parent == root}
        files.extend(
            path
            for path in root.glob("*.json")
            if path_is_active_content(path, "lessons") and path.stem not in subfolders
        )
    return sorted(files)


def _question_files() -> list[Path]:
    from app.services.lesson_content import active_content_roots, path_is_active_content

    files: list[Path] = []
    for root in active_content_roots("quizzes"):
        if not root.exists():
            continue
        files.extend(path for path in root.glob("*/*.json") if path_is_active_content(path, "quizzes"))
        subfolders = {path.parent.name for path in files if path.parent.parent == root}
        files.extend(
            path
            for path in root.glob("*.json")
            if path_is_active_content(path, "quizzes") and path.stem not in subfolders
        )
    return sorted(files)


def _read_question_rows(path: Path) -> list[dict[str, Any]]:
    payload = _read_json(path) or {}
    questions = payload.get("questions")
    return questions if isinstance(questions, list) else []


def _grade_from_path(path: Path) -> int | None:
    match = re.search(r"grade_(\d+)", str(path))
    return int(match.group(1)) if match else None


def _question_id(path: Path, question: dict[str, Any], index: int) -> str:
    return str(question.get("question_id") or question.get("id") or f"{path.stem}_{index + 1}")


def _lesson_has_blocking_errors(payload: dict[str, Any]) -> tuple[bool, list[str]]:
    errors: list[str] = []
    title = payload.get("title_th") or payload.get("title_en") or payload.get("title")
    grade = payload.get("grade_level")
    if not title:
        errors.append("title is required")
    try:
        grade_int = int(grade)
    except (TypeError, ValueError):
        grade_int = 0
    if grade_int < 1 or grade_int > 6:
        errors.append("grade_level must be 1-6")

    teaching_fields = [
        payload.get("story_intro_th"),
        payload.get("story_intro"),
        payload.get("lesson_intro_th"),
        payload.get("concept_explanation_th"),
        payload.get("singapore_math_model"),
        payload.get("visual_model_prompt_th"),
        payload.get("diagram_data"),
        payload.get("explanation_steps"),
        payload.get("step_by_step_th"),
        payload.get("blocks"),
        payload.get("visual_blocks"),
    ]
    if not any(bool(value) for value in teaching_fields):
        errors.append("lesson has no displayable teaching content")

    questions = payload.get("questions") or payload.get("quiz_th") or payload.get("mini_quiz")
    if questions is not None and not isinstance(questions, (list, dict)):
        errors.append("quiz/question content has unsupported shape")

    text_blob = json.dumps(payload, ensure_ascii=False).lower()
    placeholders = ["todo", "placeholder", "coming soon", "lorem", "�", "ð", "yy¦"]
    for marker in placeholders:
        if marker in text_blob:
            errors.append(f"placeholder or corrupted marker found: {marker}")

    diagram = payload.get("diagram_data")
    if isinstance(diagram, dict):
        rows = diagram.get("rows") or diagram.get("height")
        cols = diagram.get("cols") or diagram.get("columns") or diagram.get("width")
        total = diagram.get("total")
        try:
            rows_i = int(rows) if rows is not None else None
            cols_i = int(cols) if cols is not None else None
            total_i = int(total) if total is not None else None
        except (TypeError, ValueError):
            rows_i = cols_i = total_i = None
        if rows_i is not None and cols_i is not None and total_i is not None and rows_i * cols_i != total_i:
            errors.append("diagram rows x columns does not match total")

    return bool(errors), errors


def _question_has_blocking_errors(question: dict[str, Any]) -> tuple[bool, list[str]]:
    from app.services.lesson_content import validate_question_payload

    result = validate_question_payload(question)
    errors = [str(error) for error in result.get("errors", [])]
    return bool(errors), errors


def _empty_seed_report(dry_run: bool, force: bool) -> dict[str, Any]:
    return {
        "dry_run": dry_run,
        "force": force,
        "total_lessons_found": 0,
        "approved_lessons": 0,
        "needs_review_lessons": 0,
        "draft_lessons": 0,
        "skipped_existing_lessons": 0,
        "total_tests_found": 0,
        "approved_tests": 0,
        "tests_needing_review": 0,
        "skipped_existing_tests": 0,
        "ep_coverage": {"real_ep_lessons": 0, "approved_ep_lessons": 0, "needs_review_ep_lessons": 0},
        "warnings_by_grade": {},
        "changes": [],
    }


def seed_initial_content_status(*, dry_run: bool = False, force: bool = False) -> dict[str, Any]:
    """Seed review statuses for real lesson files and test/question files.

    Existing decisions are preserved unless force=True. Dry-run returns the
    same report without writing sidecar status files.
    """
    lessons_status = load_lessons_status()
    tests_status = load_tests_status()
    next_lessons = dict(lessons_status)
    next_tests = dict(tests_status)
    report = _empty_seed_report(dry_run, force)
    now = datetime.now(UTC).isoformat()
    seen_lessons: set[str] = set()
    seen_tests: set[str] = set()

    for path in _lesson_files():
        payload = _read_json(path)
        if not isinstance(payload, dict):
            continue
        lesson_id = _safe_lesson_id(path.stem)
        seen_lessons.add(lesson_id)
        grade = int(payload.get("grade_level") or _grade_from_path(path) or 0)
        language = _detect_language(lesson_id)
        report["total_lessons_found"] += 1
        if language == "EP":
            report["ep_coverage"]["real_ep_lessons"] += 1
        if lesson_id in lessons_status and not force:
            report["skipped_existing_lessons"] += 1
            continue

        has_errors, errors = _lesson_has_blocking_errors(payload)
        if has_errors:
            status = "needs_review"
            report["needs_review_lessons"] += 1
            grade_key = str(grade or "unknown")
            report["warnings_by_grade"][grade_key] = report["warnings_by_grade"].get(grade_key, 0) + len(errors)
        elif language == "EP":
            status = "approved"
            report["approved_lessons"] += 1
            report["ep_coverage"]["approved_ep_lessons"] += 1
        else:
            status = "approved"
            report["approved_lessons"] += 1

        if language == "EP" and status == "needs_review":
            report["ep_coverage"]["needs_review_ep_lessons"] += 1

        entry = {
            "status": status,
            "language": language,
            "grade_level": grade,
            "lesson_id": lesson_id,
            "topic": payload.get("topic_code") or payload.get("skill_code") or lesson_id,
            "version": str(payload.get("version") or "1"),
            "approved_at": now if status == "approved" else "",
            "approved_by": "seed_content_status" if status == "approved" else "",
            "reviewer_note": "" if status == "approved" else "; ".join(errors[:5]),
            "qa_flags": len(errors),
            "updated_at": now,
        }
        next_lessons[lesson_id] = entry
        report["changes"].append({"type": "lesson", "id": lesson_id, "status": status, "language": language, "grade_level": grade})

    for path in _question_files():
        grade = _grade_from_path(path)
        language = _detect_language(path.stem)
        for index, question in enumerate(_read_question_rows(path)):
            test_id = _safe_test_id(_question_id(path, question, index))
            seen_tests.add(test_id)
            report["total_tests_found"] += 1
            if test_id in tests_status and not force:
                report["skipped_existing_tests"] += 1
                continue
            lesson_for_question = str(question.get("lesson_id") or path.stem)
            if lesson_for_question not in seen_lessons:
                status = "archived"
                errors = ["question row is not tied to an active lesson file"]
                report["tests_needing_review"] += 1
                grade_key = str(grade or "unknown")
                report["warnings_by_grade"][grade_key] = report["warnings_by_grade"].get(grade_key, 0) + len(errors)
                next_tests[test_id] = {
                    "status": status,
                    "lesson_id": lesson_for_question,
                    "grade_level": grade,
                    "language": language,
                    "version": "1",
                    "question_count": 1,
                    "approved_question_count": 0,
                    "approved_at": "",
                    "approved_by": "",
                    "reviewer_note": "; ".join(errors[:5]),
                    "qa_flags": len(errors),
                    "updated_at": now,
                }
                report["changes"].append({"type": "test", "id": test_id, "status": status, "lesson_id": lesson_for_question, "grade_level": grade})
                continue
            has_errors, errors = _question_has_blocking_errors(question)
            status = "needs_review" if has_errors else "approved"
            if status == "approved":
                report["approved_tests"] += 1
            else:
                report["tests_needing_review"] += 1
                grade_key = str(grade or "unknown")
                report["warnings_by_grade"][grade_key] = report["warnings_by_grade"].get(grade_key, 0) + len(errors)
            next_tests[test_id] = {
                "status": status,
                "lesson_id": lesson_for_question,
                "grade_level": grade,
                "language": language,
                "version": "1",
                "question_count": 1,
                "approved_question_count": 1 if status == "approved" else 0,
                "approved_at": now if status == "approved" else "",
                "approved_by": "seed_content_status" if status == "approved" else "",
                "reviewer_note": "" if status == "approved" else "; ".join(errors[:5]),
                "qa_flags": len(errors),
                "updated_at": now,
            }
            report["changes"].append({"type": "test", "id": test_id, "status": status, "lesson_id": path.stem, "grade_level": grade})

    if force:
        for lesson_id, entry in list(next_lessons.items()):
            if lesson_id in seen_lessons or str(entry.get("status") or "").lower() == "archived":
                continue
            archived = dict(entry)
            archived.update(
                {
                    "status": "archived",
                    "reviewer_note": "Archived by seed_content_status because no active lesson file exists.",
                    "updated_at": now,
                }
            )
            next_lessons[lesson_id] = archived
            report["changes"].append({"type": "lesson", "id": lesson_id, "status": "archived"})
        for test_id, entry in list(next_tests.items()):
            if test_id in seen_tests or str(entry.get("status") or "").lower() == "archived":
                continue
            archived = dict(entry)
            archived.update(
                {
                    "status": "archived",
                    "approved_question_count": 0,
                    "reviewer_note": "Archived by seed_content_status because no active question row exists.",
                    "updated_at": now,
                }
            )
            next_tests[test_id] = archived
            report["changes"].append({"type": "test", "id": test_id, "status": "archived", "lesson_id": entry.get("lesson_id")})

    if not dry_run:
        save_lessons_status(next_lessons)
        save_tests_status(next_tests)

    return report


def _detect_grade_from_path(lesson_id: str) -> int | None:
    """Guess grade level from the lesson file path if available."""
    # Walk content root to find the file
    for grade in range(1, 7):
        grade_dir = _CONTENT_ROOT / f"grade_{grade}" / "lessons"
        for path in grade_dir.glob("*.json"):
            if path.stem == _safe_lesson_id(lesson_id):
                return grade
    return None


def initialize_all_lesson_status() -> dict[str, Any]:
    """Scan all JSON lesson files and create sidecar entries for any that
    don't yet have a status record.

    Existing records are left untouched.
    Returns a summary dict.
    """
    report = seed_initial_content_status(dry_run=False, force=False)
    return {
        "initialized": len(report["changes"]),
        "skipped": report["skipped_existing_lessons"] + report["skipped_existing_tests"],
        "total_tracked": len(load_lessons_status()),
        "report": report,
    }


# ---------------------------------------------------------------------------
# Summary for admin endpoints
# ---------------------------------------------------------------------------


def content_summary() -> dict[str, Any]:
    """Return counts of lessons and tests by status, grade, and language."""
    lesson_status = load_lessons_status()
    test_status = load_tests_status()

    lesson_counts: dict[str, int] = {}
    grade_counts: dict[int, int] = {}
    language_counts: dict[str, int] = {}

    for entry in lesson_status.values():
        s = str(entry.get("status", "")).lower()
        lesson_counts[s] = lesson_counts.get(s, 0) + 1

        grade = entry.get("grade_level")
        if isinstance(grade, int):
            grade_counts[grade] = grade_counts.get(grade, 0) + 1

        lang = entry.get("language", "TH")
        language_counts[lang] = language_counts.get(lang, 0) + 1

    test_counts: dict[str, int] = {}
    for entry in test_status.values():
        s = str(entry.get("status", "")).lower()
        test_counts[s] = test_counts.get(s, 0) + 1

    total_lessons = sum(lesson_counts.values()) or 0
    total_tests = sum(test_counts.values()) or 0

    return {
        "total_lessons": total_lessons,
        "approved_lessons": lesson_counts.get("approved", 0),
        "needs_review_lessons": lesson_counts.get("needs_review", 0),
        "draft_lessons": lesson_counts.get("draft", 0),
        "rejected_lessons": lesson_counts.get("rejected", 0),
        "archived_lessons": lesson_counts.get("archived", 0),
        "th_lessons": language_counts.get("TH", 0),
        "ep_lessons": language_counts.get("EP", 0),
        "approved": lesson_counts.get("approved", 0),
        "needs_review": lesson_counts.get("needs_review", 0),
        "draft": lesson_counts.get("draft", 0),
        "rejected": lesson_counts.get("rejected", 0),
        "by_grade": dict(sorted(grade_counts.items())),
        "by_language": dict(sorted(language_counts.items())),
        "total_tests": total_tests,
        "approved_tests": test_counts.get("approved", 0),
        "needs_review_tests": test_counts.get("needs_review", 0),
        "draft_tests": test_counts.get("draft", 0),
        "rejected_tests": test_counts.get("rejected", 0),
    }
