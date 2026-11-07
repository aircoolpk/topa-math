from __future__ import annotations

import json
import os
import re
import shutil
import hashlib
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any


CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "math"
ACTIVE_GRADES = range(1, 7)
ACTIVE_CONTENT_KINDS = {"lessons", "quizzes"}

GRADE3_TOPIC_TITLES: dict[str, tuple[str, str]] = {
    "addition_subtraction": ("การบวกและการลบ", "Addition and Subtraction"),
    "data_charts": ("แผนภูมิและข้อมูล", "Data and Charts"),
    "division": ("การหารแบบแบ่งเท่า ๆ กัน", "Division"),
    "fractions": ("เศษส่วนในชีวิตประจำวัน", "Fractions in Daily Life"),
    "geometry": ("รูปทรงและเรขาคณิต", "Geometry"),
    "length": ("การวัดความยาว", "Length Measurement"),
    "money": ("เงินทอนในชีวิตประจำวัน", "Money and Change"),
    "multiplication": ("การคูณ", "Multiplication"),
    "numbers": ("จำนวนและค่าประจำหลัก", "Numbers and Place Value"),
    "time": ("เวลา", "Time"),
    "weight_capacity": ("น้ำหนักและความจุ", "Weight and Capacity"),
}

GRADE3_TOPIC_ORDER = list(GRADE3_TOPIC_TITLES)
GRADE3_GROUP_TO_TOPIC = {f"g3_{topic}": topic for topic in GRADE3_TOPIC_ORDER}
GRADE3_NO_TEST_REASON_TH = "ยังไม่มีแบบทดสอบที่อนุมัติสำหรับบทนี้"

GRADE1_TOPIC_TITLES: dict[str, tuple[str, str]] = {
    "counting_1_to_10": ("การนับ 1 ถึง 10", "Counting 1 to 10"),
    "add_within_10": ("การบวกไม่เกิน 10", "Addition Within 10"),
    "subtract_within_10": ("การลบไม่เกิน 10", "Subtraction Within 10"),
    "counting_11_to_20": ("การนับ 11 ถึง 20", "Counting 11 to 20"),
    "add_sub_within_20": ("การบวกและการลบไม่เกิน 20", "Addition and Subtraction Within 20"),
    "picture_graphs": ("แผนภูมิรูปภาพ", "Picture Graphs"),
    "weight_measurement": ("การชั่งน้ำหนัก", "Weight Measurement"),
    "position_order": ("ตำแหน่งและลำดับ", "Position and Order"),
    "geometry_shapes": ("รูปเรขาคณิต", "Geometry Shapes"),
    "counting_21_to_100": ("การนับ 21 ถึง 100", "Counting 21 to 100"),
    "length_measurement": ("การวัดความยาว", "Length Measurement"),
    "add_within_100": ("การบวกไม่เกิน 100", "Addition Within 100"),
    "subtract_within_100": ("การลบไม่เกิน 100", "Subtraction Within 100"),
    "addition_subtraction_word_problems": ("โจทย์ปัญหาการบวกและการลบ", "Addition and Subtraction Word Problems"),
}

GRADE_TOPIC_TITLES: dict[int, dict[str, tuple[str, str]]] = {
    1: GRADE1_TOPIC_TITLES,
    3: GRADE3_TOPIC_TITLES,
}
GRADE_TOPIC_ORDER: dict[int, list[str]] = {grade: list(titles) for grade, titles in GRADE_TOPIC_TITLES.items()}
GRADE_GROUP_TO_TOPIC: dict[int, dict[str, str]] = {
    grade: {f"g{grade}_{topic}": topic for topic in topics}
    for grade, topics in GRADE_TOPIC_ORDER.items()
}
NO_TEST_REASON_TH = GRADE3_NO_TEST_REASON_TH

ALLOWED_BLOCK_TYPES = {
    "story_intro",
    "think_story",
    "model_diagram",
    "number_sentence",
    "mini_quiz",
    "helper_tip",
}

MODEL_BLOCK_TYPES = {
    "area_model",
    "array_model",
    "bar_model",
    "number_bond",
    "part_whole_model",
    "place_value_chart",
    "ten_frame",
}

DEPRECATED_BLOCK_TYPES = {"step_cards", "worked_example", "common_mistakes"}


def _read_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return None
    return value if isinstance(value, dict) else None


def supported_topic_folder_grades() -> set[int]:
    return {grade for grade in ACTIVE_GRADES if any(discover_topic_folders(grade, "lessons", program) for program in ("TH", "EP"))}


def _fallback_topic_title(topic_folder: str) -> str:
    return topic_folder.replace("_", " ").strip().title()


def discover_topic_folders(grade: int, kind: str, program: str) -> list[str]:
    if grade not in ACTIVE_GRADES or kind not in ACTIVE_CONTENT_KINDS:
        return []
    root = CONTENT_ROOT / f"grade_{grade}" / kind / program_alias(program)
    if not root.exists() or not root.is_dir():
        return []
    try:
        root.resolve().relative_to((CONTENT_ROOT / f"grade_{grade}" / kind / program_alias(program)).resolve())
    except ValueError:
        return []
    folders = [
        path.name
        for path in root.iterdir()
        if path.is_dir()
        and not path.name.startswith("_")
        and not path.name.lower().startswith("backup")
        and path.name.lower() not in {"old", "question_banks", "legacy", "__pycache__"}
    ]
    preferred = GRADE_TOPIC_ORDER.get(grade, [])
    return sorted(folders, key=lambda topic: (preferred.index(topic) if topic in preferred else len(preferred), topic))


def _topic_order(grade: int, kind: str = "lessons", program: str = "TH") -> list[str]:
    discovered = discover_topic_folders(grade, kind, program)
    if discovered:
        return discovered
    return GRADE_TOPIC_ORDER.get(grade, [])


def _topic_grade_from_group(lesson_group_id: str) -> int | None:
    base_id = base_lesson_id(lesson_group_id)
    match = re.match(r"^g(\d+)_", base_id)
    if not match:
        return None
    grade = int(match.group(1))
    return grade if grade in ACTIVE_GRADES else None


def topic_from_lesson_group(lesson_group_id: str) -> str | None:
    grade = _topic_grade_from_group(lesson_group_id)
    if grade is None:
        return None
    base_id = base_lesson_id(lesson_group_id)
    prefix = f"g{grade}_"
    if not base_id.startswith(prefix):
        return None
    topic = base_id[len(prefix):]
    if topic in GRADE_GROUP_TO_TOPIC.get(grade, {}).values():
        return topic
    for program in ("TH", "EP"):
        if topic in discover_topic_folders(grade, "lessons", program) or topic in discover_topic_folders(grade, "quizzes", program):
            return topic
    return None


def grade_from_lesson_group(lesson_group_id: str) -> int | None:
    return _topic_grade_from_group(lesson_group_id) if topic_from_lesson_group(lesson_group_id) else None


def _topic_program_dir(grade: int, kind: str, program: str) -> Path:
    return CONTENT_ROOT / f"grade_{grade}" / kind / program_alias(program)


def _topic_dir(grade: int, kind: str, topic_folder: str, program: str) -> Path:
    return _topic_program_dir(grade, kind, program) / topic_folder


def _topic_lesson_group_id(grade: int, topic_folder: str) -> str:
    return f"g{grade}_{topic_folder}"


def _topic_variant_files(grade: int, kind: str, topic_folder: str, program: str) -> list[Path]:
    if grade not in ACTIVE_GRADES or kind not in ACTIVE_CONTENT_KINDS:
        return []
    folder = _topic_dir(grade, kind, topic_folder, program)
    if not folder.exists() or not folder.is_dir():
        return []
    try:
        folder.resolve().relative_to((CONTENT_ROOT / f"grade_{grade}" / kind / program_alias(program)).resolve())
    except ValueError:
        return []
    return sorted(path for path in folder.glob("*.json") if path.is_file())


def _topic_variant_status(payload: dict[str, Any]) -> str:
    return str(payload.get("status") or payload.get("review_status") or payload.get("publish_status") or "active").strip().lower()


def beta_topic_folder_visibility_enabled() -> bool:
    environment = str(os.getenv("ENVIRONMENT") or "").strip().lower()
    public_app_env = str(os.getenv("NEXT_PUBLIC_APP_ENV") or "").strip().lower()
    return environment in {"local", "beta"} or public_app_env == "beta"


def _topic_variant_status_key(grade: int, topic_folder: str, program: str, variant_id: str) -> str:
    safe_variant = re.sub(r"[^a-zA-Z0-9_\-]+", "_", str(variant_id or "").strip()).strip("_")
    return f"{_topic_lesson_group_id(grade, topic_folder)}__{program_alias(program)}__{safe_variant}"


def _topic_group_status_keys(grade: int, topic_folder: str, program: str) -> list[str]:
    group_id = _topic_lesson_group_id(grade, topic_folder)
    return [f"{group_id}_ep"] if program_alias(program) == "EP" else [group_id]


def _topic_sidecar_status(path: Path, grade: int, topic_folder: str, program: str, kind: str) -> str | None:
    if kind not in ACTIVE_CONTENT_KINDS:
        return None
    try:
        if kind == "lessons":
            from app.services.content_status import load_lessons_status

            statuses = load_lessons_status()
        else:
            from app.services.content_status import load_tests_status

            statuses = load_tests_status()
    except Exception:
        return None
    payload = _read_json(path) or {}
    variant_id = str(payload.get("variant_id") or payload.get("quiz_id") or path.stem)
    keys = [
        _topic_variant_status_key(grade, topic_folder, program, variant_id),
        _topic_variant_status_key(grade, topic_folder, program, path.stem),
        _source_path_hash(path),
        *_topic_group_status_keys(grade, topic_folder, program),
    ]
    for key in keys:
        status = statuses.get(key, {}).get("status") if isinstance(statuses.get(key), dict) else None
        if status:
            return str(status).strip().lower()
    return None


def _topic_effective_variant_status(path: Path, payload: dict[str, Any], grade: int, topic_folder: str, program: str, kind: str) -> str:
    return _topic_sidecar_status(path, grade, topic_folder, program, kind) or _topic_variant_status(payload)


def _topic_variant_is_active(payload: dict[str, Any], *, approved_only: bool = False) -> bool:
    status = _topic_variant_status(payload)
    if approved_only:
        return status in {"approved", "published", "active"}
    return status not in {"archived", "deleted", "disabled", "inactive", "rejected"}


def _topic_status_is_student_visible(status: str, *, beta_visible: bool | None = None) -> bool:
    normalized = str(status or "").strip().lower()
    if normalized in {"approved", "published", "active"}:
        return True
    # Beta mode allows needs_review active topic-folder content so testers can review student flow before formal approval.
    return normalized == "needs_review" and (beta_topic_folder_visibility_enabled() if beta_visible is None else beta_visible)


def _topic_status_is_strict_approved(status: str) -> bool:
    return str(status or "").strip().lower() in {"approved", "published", "active"}


def _topic_quiz_is_valid(payload: dict[str, Any], *, status: str | None = None, student_visible_only: bool = False) -> bool:
    effective_status = status or _topic_variant_status(payload)
    if student_visible_only:
        if not _topic_status_is_student_visible(effective_status):
            return False
    elif effective_status in {"archived", "deleted", "disabled", "inactive", "rejected"}:
        return False
    questions = payload.get("questions")
    if not isinstance(questions, list) or len(questions) < 10:
        return False
    valid_count = 0
    for question in questions:
        if not isinstance(question, dict):
            continue
        text = (
            question.get("question_text")
            or question.get("question_text_th")
            or question.get("question_text_en")
            or question.get("question")
            or question.get("question_th")
            or question.get("question_en")
        )
        choices = question.get("choices")
        answer = question.get("correct_answer") or question.get("answer")
        if text and isinstance(choices, list) and len(choices) >= 2 and answer:
            valid_count += 1
    return valid_count >= 10


def _read_topic_variant(path: Path, grade: int, topic_folder: str, program: str, kind: str) -> dict[str, Any] | None:
    payload = _read_json(path)
    if not isinstance(payload, dict):
        return None
    effective_status = _topic_effective_variant_status(path, payload, grade, topic_folder, program, kind)
    payload = dict(payload)
    group_id = _topic_lesson_group_id(grade, topic_folder)
    fallback_title = _fallback_topic_title(topic_folder)
    title_th, title_en = GRADE_TOPIC_TITLES.get(grade, {}).get(topic_folder, (fallback_title, fallback_title))
    payload["lesson_id"] = group_id
    payload["id"] = group_id
    payload["lesson_group_id"] = group_id
    payload["topic_folder"] = topic_folder
    payload["grade_level"] = grade
    payload["program_type"] = program_alias(program)
    payload["content_program_type"] = program_alias(program)
    payload["topic_code"] = group_id
    payload["skill_code"] = group_id
    payload["selected_variant_id"] = payload.get("variant_id") or path.stem
    payload["variant_id"] = payload.get("variant_id") or path.stem
    payload["variant_status"] = effective_status
    payload["status"] = effective_status
    payload["source_path"] = str(path)
    payload["active_content_source_path"] = str(path)
    payload["source_folder"] = str(path.parent)
    payload["file_structure"] = f"grade{grade}_topic_folder"
    payload["is_topic_folder_group"] = True
    payload["is_grade3_topic_folder_group"] = grade == 3
    payload["loaded_from_backup"] = False
    if kind == "lessons":
        quiz_available = has_topic_approved_quiz(grade, topic_folder, program)
        payload["has_approved_test"] = quiz_available
        payload["test_available"] = quiz_available
        payload["test_unavailable_reason"] = None if quiz_available else NO_TEST_REASON_TH
    payload["title_th"] = payload.get("title_th") or title_th
    payload["title_en"] = payload.get("title_en") or title_en
    payload.setdefault("estimated_minutes", 10)
    return payload


def _topic_content_cache_version(grade: int, kind: str, topic_folder: str, program_type: str) -> tuple[int, int]:
    folder = _topic_dir(grade, kind, topic_folder, program_type)
    folder_mtime = 0
    if folder.exists():
        folder_mtime = max((path.stat().st_mtime_ns for path in folder.glob("*.json") if path.is_file()), default=folder.stat().st_mtime_ns)
    sidecar = CONTENT_ROOT / "_content_status" / ("lessons.json" if kind == "lessons" else "tests.json")
    sidecar_mtime = sidecar.stat().st_mtime_ns if sidecar.exists() else 0
    return folder_mtime, sidecar_mtime


@lru_cache(maxsize=512)
def _cached_topic_lesson_variants(
    grade: int,
    topic_folder: str,
    program_type: str,
    approved_only: bool,
    _cache_version: tuple[int, int],
) -> tuple[tuple[Path, dict[str, Any]], ...]:
    candidates: list[tuple[Path, dict[str, Any]]] = []
    for path in _topic_variant_files(grade, "lessons", topic_folder, program_type):
        payload = _read_json(path)
        if not isinstance(payload, dict):
            continue
        effective_status = _topic_effective_variant_status(path, payload, grade, topic_folder, program_type, "lessons")
        if effective_status in {"archived", "deleted", "disabled", "inactive", "rejected"}:
            continue
        if approved_only and not _topic_status_is_student_visible(effective_status):
            continue
        if isinstance(payload, dict):
            wrapped = _read_topic_variant(path, grade, topic_folder, program_type, "lessons")
            if wrapped:
                wrapped["source_filename"] = path.name
                wrapped["source_path_hash"] = _source_path_hash(path)
                candidates.append((path, wrapped))
    return tuple(candidates)


def list_topic_lesson_variants(grade: int, topic_folder: str, program_type: str, approved_only: bool = True) -> list[tuple[Path, dict[str, Any]]]:
    program = program_alias(program_type)
    rows = _cached_topic_lesson_variants(
        grade,
        topic_folder,
        program,
        approved_only,
        _topic_content_cache_version(grade, "lessons", topic_folder, program),
    )
    return [(path, dict(payload)) for path, payload in rows]


@lru_cache(maxsize=512)
def _cached_topic_quiz_variants(
    grade: int,
    topic_folder: str,
    program_type: str,
    approved_only: bool,
    _cache_version: tuple[int, int],
) -> tuple[tuple[Path, dict[str, Any]], ...]:
    variants: list[tuple[Path, dict[str, Any]]] = []
    for path in _topic_variant_files(grade, "quizzes", topic_folder, program_type):
        payload = _read_json(path)
        if not isinstance(payload, dict):
            continue
        effective_status = _topic_effective_variant_status(path, payload, grade, topic_folder, program_type, "quizzes")
        if not _topic_quiz_is_valid(payload, status=effective_status, student_visible_only=approved_only):
            continue
        wrapped = _read_topic_variant(path, grade, topic_folder, program_type, "quizzes") or payload
        wrapped["quiz_variant_id"] = payload.get("quiz_id") or payload.get("variant_id") or path.stem
        wrapped["source_filename"] = path.name
        wrapped["source_path_hash"] = _source_path_hash(path)
        variants.append((path, wrapped))
    return tuple(variants)


def list_topic_quiz_variants(grade: int, topic_folder: str, program_type: str, approved_only: bool = True) -> list[tuple[Path, dict[str, Any]]]:
    program = program_alias(program_type)
    rows = _cached_topic_quiz_variants(
        grade,
        topic_folder,
        program,
        approved_only,
        _topic_content_cache_version(grade, "quizzes", topic_folder, program),
    )
    return [(path, dict(payload)) for path, payload in rows]


def has_topic_approved_quiz(grade: int, topic_folder: str, program_type: str) -> bool:
    return bool(list_topic_quiz_variants(grade, topic_folder, program_type, approved_only=True))


def update_topic_lesson_variant_status(
    lesson_group_id: str,
    status: str,
    *,
    program_type: str | None = None,
    reviewer_note: str = "",
    approved_by: str = "",
) -> list[str]:
    grade = grade_from_lesson_group(lesson_group_id)
    topic_folder = topic_from_lesson_group(lesson_group_id)
    if grade is None or not topic_folder:
        return []
    from app.services.content_status import update_lesson_status

    programs = [program_alias(program_type)] if program_type else ["TH", "EP"]
    updated_keys: list[str] = []
    for program in programs:
        if topic_folder not in discover_topic_folders(grade, "lessons", program):
            continue
        for group_key in _topic_group_status_keys(grade, topic_folder, program):
            updated = update_lesson_status(
                group_key,
                status,
                reviewer_note=reviewer_note,
                approved_by=approved_by,
                language=program,
                grade_level=grade,
                canonical_lesson_id=lesson_group_id,
                topic=lesson_group_id,
                topic_folder=topic_folder,
            )
            if updated:
                updated_keys.append(group_key)
        for path in _topic_variant_files(grade, "lessons", topic_folder, program):
            payload = _read_json(path)
            if not isinstance(payload, dict):
                continue
            variant_id = str(payload.get("variant_id") or path.stem)
            variant_key = _topic_variant_status_key(grade, topic_folder, program, variant_id)
            updated = update_lesson_status(
                variant_key,
                status,
                reviewer_note=reviewer_note,
                approved_by=approved_by,
                language=program,
                grade_level=grade,
                canonical_lesson_id=lesson_group_id,
                topic=lesson_group_id,
                topic_folder=topic_folder,
                variant_id=variant_id,
                source_filename=path.name,
                source_path_hash=_source_path_hash(path),
            )
            if updated:
                updated_keys.append(variant_key)
    return updated_keys


def update_topic_quiz_variant_status(
    lesson_group_id: str,
    status: str,
    *,
    program_type: str,
    reviewer_note: str = "",
    approved_by: str = "",
) -> list[str]:
    grade = grade_from_lesson_group(lesson_group_id)
    topic_folder = topic_from_lesson_group(lesson_group_id)
    if grade is None or not topic_folder:
        return []
    from app.services.content_status import update_test_status

    program = program_alias(program_type)
    updated_keys: list[str] = []
    for path in _topic_variant_files(grade, "quizzes", topic_folder, program):
        payload = _read_json(path)
        if not isinstance(payload, dict):
            continue
        variant_id = str(payload.get("quiz_id") or payload.get("variant_id") or path.stem)
        variant_key = _topic_variant_status_key(grade, topic_folder, program, variant_id)
        updated = update_test_status(
            variant_key,
            status,
            reviewer_note=reviewer_note,
            approved_by=approved_by,
            language=program,
            grade_level=grade,
            canonical_lesson_id=lesson_group_id,
            topic=lesson_group_id,
            topic_folder=topic_folder,
            quiz_variant_id=variant_id,
            source_filename=path.name,
            source_path_hash=_source_path_hash(path),
        )
        if updated:
            updated_keys.append(variant_key)
    return updated_keys


def select_topic_lesson_variant(grade: int, topic_folder: str, program_type: str) -> tuple[Path, dict[str, Any]] | None:
    candidates = list_topic_lesson_variants(grade, topic_folder, program_type, approved_only=True)
    return candidates[0] if candidates else None


def _grade3_program_dir(kind: str, program: str) -> Path:
    return CONTENT_ROOT / "grade_3" / kind / program_alias(program)


def _grade3_topic_dir(kind: str, topic_folder: str, program: str) -> Path:
    return _grade3_program_dir(kind, program) / topic_folder


def _grade3_lesson_group_id(topic_folder: str) -> str:
    return f"g3_{topic_folder}"


def _grade3_topic_from_group(lesson_group_id: str) -> str | None:
    return GRADE3_GROUP_TO_TOPIC.get(base_lesson_id(lesson_group_id))


def grade3_topic_from_lesson_group(lesson_group_id: str) -> str | None:
    return _grade3_topic_from_group(lesson_group_id)


def _grade3_variant_files(kind: str, topic_folder: str, program: str) -> list[Path]:
    folder = _grade3_topic_dir(kind, topic_folder, program)
    if not folder.exists() or not folder.is_dir():
        return []
    try:
        folder.resolve().relative_to((CONTENT_ROOT / "grade_3" / kind).resolve())
    except ValueError:
        return []
    return sorted(path for path in folder.glob("*.json") if path.is_file())


def _grade3_variant_status(payload: dict[str, Any]) -> str:
    return str(payload.get("status") or payload.get("review_status") or payload.get("publish_status") or "active").strip().lower()


def _grade3_variant_is_active(payload: dict[str, Any], *, approved_only: bool = False) -> bool:
    status = _grade3_variant_status(payload)
    if approved_only:
        return status in {"approved", "published", "active"}
    return status not in {"archived", "deleted", "disabled", "inactive", "rejected"}


def _grade3_quiz_is_valid(payload: dict[str, Any]) -> bool:
    if not _grade3_variant_is_active(payload):
        return False
    questions = payload.get("questions")
    if not isinstance(questions, list) or len(questions) < 10:
        return False
    valid_count = 0
    for question in questions:
        if not isinstance(question, dict):
            continue
        text = (
            question.get("question_text")
            or question.get("question_text_th")
            or question.get("question_text_en")
            or question.get("question")
            or question.get("question_th")
            or question.get("question_en")
        )
        choices = question.get("choices")
        answer = question.get("correct_answer") or question.get("answer")
        if text and isinstance(choices, list) and len(choices) >= 2 and answer:
            valid_count += 1
    return valid_count >= 10


def _read_grade3_variant(path: Path, topic_folder: str, program: str, kind: str) -> dict[str, Any] | None:
    payload = _read_json(path)
    if not isinstance(payload, dict):
        return None
    payload = dict(payload)
    group_id = _grade3_lesson_group_id(topic_folder)
    title_th, title_en = GRADE3_TOPIC_TITLES.get(topic_folder, (group_id, group_id))
    payload["lesson_id"] = group_id
    payload["id"] = group_id
    payload["lesson_group_id"] = group_id
    payload["topic_folder"] = topic_folder
    payload["grade_level"] = 3
    payload["program_type"] = program_alias(program)
    payload["content_program_type"] = program_alias(program)
    payload["topic_code"] = group_id
    payload["skill_code"] = group_id
    payload["selected_variant_id"] = payload.get("variant_id") or path.stem
    payload["variant_id"] = payload.get("variant_id") or path.stem
    payload["variant_status"] = _grade3_variant_status(payload)
    payload["source_path"] = str(path)
    payload["active_content_source_path"] = str(path)
    payload["source_folder"] = str(path.parent)
    payload["file_structure"] = "grade3_topic_folder"
    payload["is_grade3_topic_folder_group"] = True
    payload["loaded_from_backup"] = False
    payload["status"] = "approved" if kind == "lessons" else payload.get("status", "approved")
    if kind == "lessons":
        # Grade 3 topic-folder cards are groups; detail view selects this variant and maps its visual_blocks.
        quiz_available = has_grade3_approved_quiz(topic_folder, program)
        payload["has_approved_test"] = quiz_available
        payload["test_available"] = quiz_available
        payload["test_unavailable_reason"] = None if quiz_available else GRADE3_NO_TEST_REASON_TH
    payload["title_th"] = payload.get("title_th") or title_th
    payload["title_en"] = payload.get("title_en") or title_en
    payload.setdefault("estimated_minutes", 10)
    return payload


def select_grade3_lesson_variant(topic_folder: str, program_type: str, user_id: str | None = None) -> tuple[Path, dict[str, Any]] | None:
    """Select one active Grade 3 topic-folder lesson variant without touching content."""
    candidates = list_grade3_lesson_variants(topic_folder, program_type, approved_only=True)
    if not candidates:
        return None
    # Deterministic first-valid selection for callers that do not have child history.
    return candidates[0]


def _source_path_hash(path: Path) -> str:
    try:
        relative = path.resolve().relative_to(CONTENT_ROOT.resolve())
    except ValueError:
        relative = path.name
    return hashlib.sha256(str(relative).replace("\\", "/").encode("utf-8")).hexdigest()[:24]


def grade3_variant_source_hash(path: Path) -> str:
    return _source_path_hash(path)


def list_grade3_lesson_variants(topic_folder: str, program_type: str, approved_only: bool = True) -> list[tuple[Path, dict[str, Any]]]:
    return list_topic_lesson_variants(3, topic_folder, program_type, approved_only=approved_only)


def list_grade3_quiz_variants(topic_folder: str, program_type: str, approved_only: bool = True) -> list[tuple[Path, dict[str, Any]]]:
    return list_topic_quiz_variants(3, topic_folder, program_type, approved_only=approved_only)


def grade3_quiz_questions_from_variant(topic_folder: str, program_type: str, quiz_variant_id: str) -> list[dict[str, Any]]:
    return topic_quiz_questions_from_variant(3, topic_folder, program_type, quiz_variant_id)


def has_grade3_approved_quiz(topic_folder: str, program_type: str) -> bool:
    return has_topic_approved_quiz(3, topic_folder, program_type)


def grade3_lesson_section_completeness(payload: dict[str, Any]) -> dict[str, bool]:
    blocks = payload.get("visual_blocks")
    typed_blocks = {str(block.get("type") or block.get("block_type") or ""): block for block in blocks if isinstance(block, dict)} if isinstance(blocks, list) else {}
    model = typed_blocks.get("model_diagram") or {}
    number_sentence = typed_blocks.get("number_sentence") or {}
    practice = typed_blocks.get("mini_quiz") or {}
    practice_data = practice.get("data") if isinstance(practice.get("data"), dict) else {}
    return {
        "header": bool(payload.get("title_th") or payload.get("title_en")),
        "mascot_helper": bool(payload.get("helper_tip")),
        "story": bool(payload.get("story_theme_th") or typed_blocks.get("story_intro")),
        "think_story": bool(payload.get("think_story_th") or typed_blocks.get("think_story")),
        "model_diagram": bool(model),
        "number_sentence": bool(number_sentence),
        "practice": bool(practice and (practice.get("choices") or practice_data.get("choices"))),
    }


def topic_lesson_section_completeness(payload: dict[str, Any]) -> dict[str, bool]:
    return grade3_lesson_section_completeness(payload)


def get_topic_lesson_group(lesson_group_id: str, program_type: str) -> tuple[Path, dict[str, Any]] | None:
    grade = grade_from_lesson_group(lesson_group_id)
    topic_folder = topic_from_lesson_group(lesson_group_id)
    if grade is None or not topic_folder:
        return None
    return select_topic_lesson_variant(grade, topic_folder, program_type)


def topic_folder_diagnostics(grade: int, program_type: str) -> dict[str, Any]:
    requested_program = program_alias(program_type)
    topics = discover_topic_folders(grade, "lessons", requested_program)
    total_variants = approved_variants = needs_review_variants = rejected_variants = 0
    beta_visible_variants = 0
    total_quiz_variants = approved_quiz_variants = 0
    topic_rows: list[dict[str, Any]] = []
    for topic_folder in topics:
        lesson_variants = list_topic_lesson_variants(grade, topic_folder, requested_program, approved_only=False)
        approved_lesson_variants = list_topic_lesson_variants(grade, topic_folder, requested_program, approved_only=True)
        quiz_variants = list_topic_quiz_variants(grade, topic_folder, requested_program, approved_only=False)
        approved_quiz = list_topic_quiz_variants(grade, topic_folder, requested_program, approved_only=True)
        statuses = [_topic_variant_status(payload) for _path, payload in lesson_variants]
        status_counts = {status: statuses.count(status) for status in sorted(set(statuses))}
        total_variants += len(lesson_variants)
        approved_variants += status_counts.get("approved", 0) + status_counts.get("published", 0) + status_counts.get("active", 0)
        needs_review_variants += status_counts.get("needs_review", 0)
        rejected_variants += status_counts.get("rejected", 0)
        beta_visible = sum(1 for status in statuses if _topic_status_is_student_visible(status))
        beta_visible_variants += beta_visible
        total_quiz_variants += len(quiz_variants)
        approved_quiz_variants += len(approved_quiz)
        hidden_reason = None
        if not lesson_variants:
            hidden_reason = "no_lesson_variants"
        elif not approved_lesson_variants:
            hidden_reason = "found_files_but_needs_review"
        topic_rows.append(
            {
                "topic_folder": topic_folder,
                "lesson_group_id": _topic_lesson_group_id(grade, topic_folder),
                "variant_count": len(lesson_variants),
                "approved_variant_count": status_counts.get("approved", 0) + status_counts.get("published", 0) + status_counts.get("active", 0),
                "needs_review_variant_count": status_counts.get("needs_review", 0),
                "rejected_variant_count": status_counts.get("rejected", 0),
                "beta_visible_count": beta_visible,
                "quiz_variant_count": len(quiz_variants),
                "approved_quiz_count": len(approved_quiz),
                "student_visible": bool(approved_lesson_variants),
                "test_available": bool(approved_quiz),
                "hidden_reason": hidden_reason,
            }
        )
    return {
        "grade_level": grade,
        "program_type": requested_program,
        "topic_folders_found": len(topics),
        "lesson_variants_found": total_variants,
        "approved_variants": approved_variants,
        "needs_review_variants": needs_review_variants,
        "beta_visible_count": beta_visible_variants,
        "rejected_variants": rejected_variants,
        "student_visible_count": sum(1 for row in topic_rows if row["student_visible"]),
        "quiz_variants_found": total_quiz_variants,
        "approved_quiz_variants": approved_quiz_variants,
        "hidden_reason": "found_files_but_needs_review" if topics and total_variants and approved_variants == 0 and beta_visible_variants == 0 else None,
        "topics": topic_rows,
    }


def list_topic_folder_lessons(grade: int, program_type: str, *, approved_only: bool = True, include_empty: bool = False) -> list[dict[str, Any]]:
    requested_program = program_alias(program_type)
    items: list[dict[str, Any]] = []
    for order, topic_folder in enumerate(_topic_order(grade, "lessons", requested_program), start=1):
        folder = _topic_dir(grade, "lessons", topic_folder, requested_program)
        variants = list_topic_lesson_variants(grade, topic_folder, requested_program, approved_only=approved_only)
        if not variants:
            if not include_empty:
                continue
            all_variants = list_topic_lesson_variants(grade, topic_folder, requested_program, approved_only=False)
            fallback_title = _fallback_topic_title(topic_folder)
            quiz_variants = list_topic_quiz_variants(grade, topic_folder, requested_program, approved_only=True)
            items.append(
                {
                    "lesson_id": _topic_lesson_group_id(grade, topic_folder),
                    "id": _topic_lesson_group_id(grade, topic_folder),
                    "base_lesson_id": _topic_lesson_group_id(grade, topic_folder),
                    "lesson_group_id": _topic_lesson_group_id(grade, topic_folder),
                    "program": requested_program,
                    "program_type": requested_program,
                    "grade_level": grade,
                    "title": fallback_title,
                    "title_th": GRADE_TOPIC_TITLES.get(grade, {}).get(topic_folder, (fallback_title, fallback_title))[0],
                    "title_en": GRADE_TOPIC_TITLES.get(grade, {}).get(topic_folder, (fallback_title, fallback_title))[1],
                    "topic_code": _topic_lesson_group_id(grade, topic_folder),
                    "skill_code": _topic_lesson_group_id(grade, topic_folder),
                    "topic_folder": topic_folder,
                    "estimated_minutes": 10,
                    "student_visible": False,
                    "approved": False,
                    "status": "needs_review" if all_variants else "no_variants",
                    "has_approved_test": bool(quiz_variants),
                    "test_available": bool(quiz_variants),
                    "test_unavailable_reason": None if quiz_variants else NO_TEST_REASON_TH,
                    "source_folder": str(folder),
                    "file_structure": f"grade{grade}_topic_folder",
                    "is_topic_folder_group": True,
                    "is_grade3_topic_folder_group": grade == 3,
                    "selected_variant_id": None,
                    "variant_status": "needs_review" if all_variants else "no_variants",
                    "section_completeness": {},
                    "variant_count": len(all_variants),
                    "approved_variant_count": 0,
                    "variant_files": [path.name for path, _payload in all_variants],
                    "quiz_variant_count": len(list_topic_quiz_variants(grade, topic_folder, requested_program, approved_only=False)),
                    "approved_quiz_count": len(quiz_variants),
                    "loaded_from_backup": False,
                    "sort_order": order,
                    "hidden_reason": "found_files_but_needs_review" if all_variants else "no_lesson_variants",
                }
            )
            continue
        selected_path, selected_payload = variants[0]
        group_id = _topic_lesson_group_id(grade, topic_folder)
        fallback_title = _fallback_topic_title(topic_folder)
        fallback_th, fallback_en = GRADE_TOPIC_TITLES.get(grade, {}).get(topic_folder, (fallback_title, fallback_title))
        quiz_variants = list_topic_quiz_variants(grade, topic_folder, requested_program, approved_only=True)
        variant_status = str(selected_payload.get("variant_status") or selected_payload.get("status") or "needs_review").lower()
        strict_approved_variants = [
            payload
            for _path, payload in list_topic_lesson_variants(grade, topic_folder, requested_program, approved_only=False)
            if _topic_status_is_strict_approved(str(payload.get("variant_status") or payload.get("status") or ""))
        ]
        items.append(
            {
                "lesson_id": group_id,
                "id": group_id,
                "base_lesson_id": group_id,
                "lesson_group_id": group_id,
                "program": requested_program,
                "program_type": requested_program,
                "grade_level": grade,
                "title": selected_payload.get("title_th") if requested_program == "TH" else (selected_payload.get("title_en") or selected_payload.get("title_th")),
                "title_th": selected_payload.get("title_th") or fallback_th,
                "title_en": selected_payload.get("title_en") or fallback_en,
                "description": selected_payload.get("description_th")
                or selected_payload.get("objective_th")
                or selected_payload.get("story_intro_th")
                or "",
                "description_th": selected_payload.get("description_th")
                or selected_payload.get("objective_th")
                or selected_payload.get("story_intro_th")
                or "",
                "topic_code": group_id,
                "skill_code": group_id,
                "topic_folder": topic_folder,
                "estimated_minutes": int(selected_payload.get("estimated_minutes") or 10),
                "duration": int(selected_payload.get("estimated_minutes") or 10),
                "student_visible": _topic_status_is_student_visible(variant_status),
                "approved": _topic_status_is_strict_approved(variant_status),
                "status": variant_status,
                "has_approved_test": bool(quiz_variants),
                "test_available": bool(quiz_variants),
                "test_unavailable_reason": None if quiz_variants else NO_TEST_REASON_TH,
                "test_disabled_reason": None if quiz_variants else NO_TEST_REASON_TH,
                "test_bank_source": quiz_variants[0][1].get("source_path_hash") if quiz_variants else None,
                "source_path_hash": selected_payload.get("source_path_hash"),
                "source_folder": str(folder),
                "file_structure": f"grade{grade}_topic_folder",
                "is_topic_folder_group": True,
                "is_grade3_topic_folder_group": grade == 3,
                "selected_variant_id": selected_payload.get("selected_variant_id") or selected_path.stem,
                "variant_status": selected_payload.get("variant_status"),
                "section_completeness": topic_lesson_section_completeness(selected_payload),
                "variant_count": len(variants),
                "approved_variant_count": len(strict_approved_variants),
                "variant_files": [path.name for path, _payload in variants],
                "quiz_variant_count": len(list_topic_quiz_variants(grade, topic_folder, requested_program, approved_only=False)),
                "approved_quiz_count": len(quiz_variants),
                "loaded_from_backup": False,
                "sort_order": order,
            }
        )
    return items


def topic_quiz_questions_from_variant(grade: int, topic_folder: str, program_type: str, quiz_variant_id: str) -> list[dict[str, Any]]:
    requested_program = program_alias(program_type)
    for path, payload in list_topic_quiz_variants(grade, topic_folder, requested_program, approved_only=True):
        current_id = str(payload.get("quiz_variant_id") or payload.get("variant_id") or path.stem)
        if current_id != str(quiz_variant_id):
            continue
        questions = payload.get("questions")
        if not isinstance(questions, list):
            return []
        group_id = _topic_lesson_group_id(grade, topic_folder)
        rows: list[dict[str, Any]] = []
        seen: set[str] = set()
        for index, question in enumerate(questions):
            if not isinstance(question, dict):
                continue
            question_id = str(question.get("question_id") or question.get("id") or f"{path.stem}_q{index + 1:03d}")
            if question_id in seen:
                continue
            seen.add(question_id)
            row = dict(question)
            row["question_id"] = question_id
            row["lesson_id"] = group_id
            row["program"] = requested_program
            row["program_type"] = requested_program
            row["topic_folder"] = topic_folder
            row["quiz_variant_id"] = current_id
            row["source_path_hash"] = _source_path_hash(path)
            row["source_filename"] = path.name
            rows.append(row)
        return rows
    return []


def get_topic_test_bank(grade: int, topic_folder: str, program_type: str) -> list[dict[str, Any]]:
    requested_program = program_alias(program_type)
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for path, payload in list_topic_quiz_variants(grade, topic_folder, requested_program, approved_only=True):
        questions = payload.get("questions")
        if not isinstance(questions, list):
            continue
        group_id = _topic_lesson_group_id(grade, topic_folder)
        for index, question in enumerate(questions):
            if not isinstance(question, dict):
                continue
            question_id = str(question.get("question_id") or question.get("id") or f"{path.stem}_q{index + 1:03d}")
            if question_id in seen:
                continue
            seen.add(question_id)
            row = dict(question)
            row["question_id"] = question_id
            row["lesson_id"] = group_id
            row["program"] = requested_program
            row["program_type"] = requested_program
            row["source_path"] = str(path)
            row["topic_folder"] = topic_folder
            rows.append(row)
    return rows


def get_grade3_lesson_group(lesson_group_id: str, program_type: str) -> tuple[Path, dict[str, Any]] | None:
    return get_topic_lesson_group(lesson_group_id, program_type)


def list_grade3_topic_lessons(program_type: str) -> list[dict[str, Any]]:
    return list_topic_folder_lessons(3, program_type, approved_only=True)


def start_grade3_topic_test(lesson_group_id: str, program_type: str) -> list[dict[str, Any]]:
    grade = grade_from_lesson_group(lesson_group_id)
    topic_folder = topic_from_lesson_group(lesson_group_id)
    if grade != 3 or not topic_folder:
        return []
    return get_topic_test_bank(3, topic_folder, program_type)


def get_grade3_topic_test_bank(topic_folder: str, program_type: str) -> list[dict[str, Any]]:
    return get_topic_test_bank(3, topic_folder, program_type)


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _parse_json_like(value: Any) -> Any:
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        if stripped[0] in "[{":
            try:
                return json.loads(stripped)
            except Exception:
                return value
    return value


def program_alias(value: Any) -> str:
    raw = str(value or "TH").strip().upper()
    if raw in {"EP", "EN", "ENGLISH"}:
        return "EP"
    return "TH"


def lesson_program_alias(payload: dict) -> str:
    pt = (payload.get("program_type") or payload.get("content_program_type") or payload.get("track") or "").strip().upper()
    if pt in {"EP", "EN", "ENGLISH"}:
        return "EP"
    # THP is the Thai program — treat requests for "TH" as matching "THP" too
    if pt in {"TH", "THP"}:
        return "TH"
    return "TH"


def _normalize_nested(value: Any) -> Any:
    value = _parse_json_like(value)
    if isinstance(value, dict):
        return {str(key): _normalize_nested(nested) for key, nested in value.items()}
    if isinstance(value, list):
        return [_normalize_nested(item) for item in value]
    return value


def _block_data(block: dict[str, Any]) -> dict[str, Any]:
    raw_data = _parse_json_like(block.get("data"))
    if isinstance(raw_data, dict):
        data = dict(raw_data)
    else:
        data = {}
    for key, value in block.items():
        if key in {"type", "block_type", "data", "title", "title_th", "title_en"}:
            continue
        data.setdefault(str(key), value)
    if "content" in block and "text_th" not in data and "text" not in data:
        data["text_th"] = block["content"]
    return _normalize_nested(data)


def _letter_choice_index(value: Any) -> int | None:
    text = str(value or "").strip().upper()
    return {"A": 0, "B": 1, "C": 2, "D": 3}.get(text)


def _number_text(value: Any) -> str | None:
    number = _number_value(value)
    if number is None:
        return None
    return str(int(number)) if float(number).is_integer() else f"{number:g}"


def _normalize_mini_quiz_data(data: dict[str, Any]) -> dict[str, Any]:
    questions = data.get("questions")
    if isinstance(questions, list) and questions and isinstance(questions[0], dict):
        first_question = questions[0]
        data = {**data, **first_question}
    question = data.get("question_th") or data.get("question_en") or data.get("question") or ""
    if not question:
        question = data.get("text_th") or data.get("question_text") or data.get("question_text_th") or ""
    raw_choices = data.get("choices")
    if not isinstance(raw_choices, list):
        raw_choices = data.get("choices_th") if isinstance(data.get("choices_th"), list) else data.get("choices_en")
    choices = raw_choices if isinstance(raw_choices, list) else []
    choices = [str(choice).strip() for choice in choices]
    raw_answer = data.get("correct_answer")
    if raw_answer is None or str(raw_answer).strip() == "":
        raw_answer = data.get("correct_answer_th") or data.get("correct_answer_en") or data.get("answer")

    index = _letter_choice_index(raw_answer)
    if index is not None and index < len(choices):
        raw_answer = choices[index]

    explanation = data.get("explanation_th") or data.get("explanation_en") or data.get("explanation") or ""

    answer = str(raw_answer or "").strip()
    if answer not in choices:
        answer_number = _number_text(answer)
        for choice in choices:
            if answer_number is not None and _number_text(choice) == answer_number:
                answer = choice
                break

    return {
        **data,
        "question_th": str(question),
        "choices": choices,
        "correct_answer": answer,
        "answer": answer,
        "explanation_th": str(explanation),
    }


def _normalize_grouping_model_data(data: dict[str, Any]) -> dict[str, Any]:
    group_count = int(_number_value(data.get("groups")) or 0)
    items_per_group = int(_number_value(data.get("items_per_group")) or 0)
    groups = data.get("groups") if isinstance(data.get("groups"), list) else []
    if not groups and group_count > 0:
        groups = [
            {"group_index": index + 1, "item_count": items_per_group}
            for index in range(group_count)
        ]
    return {
        **data,
        "model_type": "sharing_groups",
        "groups": groups,
    }


def _normalize_block(block: Any) -> dict[str, Any] | None:
    block = _parse_json_like(block)
    if isinstance(block, list):
        nested = normalize_lesson_visual_blocks(block)
        return nested[0] if nested else None
    if not isinstance(block, dict):
        return None

    raw_type = str(block.get("type") or block.get("block_type") or "").strip()
    if raw_type in DEPRECATED_BLOCK_TYPES:
        return None
    block_type = raw_type
    data = _block_data(block)

    if block_type == "grouping_model":
        data = _normalize_grouping_model_data(data)
        block_type = "model_diagram"
    elif block_type in MODEL_BLOCK_TYPES:
        data.setdefault("model_type", block_type)
        block_type = "model_diagram"
    elif block_type in {"emoji_counter", "thinking_prompt", "visual_prompt"}:
        block_type = "visual_thinking"
    elif block_type in {"equation", "expression", "number_sentence"}:
        block_type = "number_sentence"
    elif block_type not in ALLOWED_BLOCK_TYPES:
        if data.get("question") or data.get("choices"):
            block_type = "mini_quiz"
        elif data.get("equation") or data.get("expression"):
            block_type = "number_sentence"
        else:
            block_type = "visual_thinking"

    if block_type == "mini_quiz":
        data = _normalize_mini_quiz_data(data)

    title = block.get("title_th") or block.get("title") or block.get("title_en") or ""
    return {"type": block_type, "title_th": str(title), "data": data}


def normalize_lesson_visual_blocks(value: Any) -> list[dict[str, Any]]:
    value = _parse_json_like(value)
    if value is None:
        return []
    if isinstance(value, dict):
        block = _normalize_block(value)
        return [block] if block else []
    if not isinstance(value, list):
        block = _normalize_block(value)
        return [block] if block else []

    normalized: list[dict[str, Any]] = []
    for item in value:
        parsed = _parse_json_like(item)
        if isinstance(parsed, list):
            normalized.extend(normalize_lesson_visual_blocks(parsed))
            continue
        block = _normalize_block(parsed)
        if block:
            normalized.append(block)
    return normalized


def active_content_roots(kind: str) -> list[Path]:
    if kind not in ACTIVE_CONTENT_KINDS:
        raise ValueError(f"Unsupported content kind: {kind}")
    return [CONTENT_ROOT / f"grade_{grade}" / kind for grade in ACTIVE_GRADES]


def _is_active_content_path(path: Path, kind: str) -> bool:
    if kind not in ACTIVE_CONTENT_KINDS:
        return False
    try:
        resolved = path.resolve()
    except OSError:
        resolved = path
    if resolved.suffix.lower() != ".json":
        return False
    for root in active_content_roots(kind):
        try:
            relative = resolved.relative_to(root.resolve())
        except ValueError:
            continue
        parts = relative.parts
        lowered = [part.lower() for part in parts]
        if any(part in {"old", "legacy", "question_banks", "__pycache__"} or part.startswith("backup") for part in lowered):
            return False
        if len(parts) == 3 and parts[0] in {"TH", "EP"}:
            return True
        return len(parts) == 1
    return False


def _active_json_files(kind: str) -> list[Path]:
    files: list[Path] = []
    for root in active_content_roots(kind):
        if not root.exists():
            continue
        subfolder_files = [path for path in root.glob("*/*/*.json") if _is_active_content_path(path, kind)]
        subfolder_names = {path.parent.name for path in subfolder_files}
        flat_files = [
            path
            for path in root.glob("*.json")
            if _is_active_content_path(path, kind) and path.stem not in subfolder_names
        ]
        files.extend(subfolder_files)
        files.extend(flat_files)
    return sorted(files)


def path_is_active_content(path: str | Path, kind: str) -> bool:
    return _is_active_content_path(Path(path), kind)


def _lesson_files() -> list[Path]:
    return _active_json_files("lessons")


def _base_lesson_id(payload: dict[str, Any], path: Path | None = None) -> str:
    lesson_id = str(payload.get("lesson_id") or payload.get("id") or (path.stem if path else "")).strip()
    topic_code = str(payload.get("topic_code") or "").strip()
    if topic_code:
        return topic_code
    for suffix in ("_thp", "_th", "_ep"):
        if lesson_id.endswith(suffix):
            return lesson_id[: -len(suffix)]
    return lesson_id


def base_lesson_id(value: str | dict[str, Any], path: Path | None = None) -> str:
    """Return the cross-program lesson id without TH/EP suffixes."""
    if isinstance(value, dict):
        return _base_lesson_id(value, path)
    lesson_id = str(value or "").strip()
    for suffix in ("_thp", "_th", "_ep"):
        if lesson_id.lower().endswith(suffix):
            return lesson_id[: -len(suffix)]
    return lesson_id


def _canonical_lesson_id(payload: dict[str, Any], path: Path) -> str:
    return str(payload.get("lesson_id") or payload.get("id") or path.stem).strip() or path.stem


def _status_is_student_visible(status: dict[str, Any]) -> bool:
    return str(status.get("status") or "").lower() == "approved"


def _question_id(path: Path, question: dict[str, Any], index: int) -> str:
    return str(question.get("question_id") or question.get("id") or f"{path.stem}_q{index + 1:03d}")


def _question_text(question: dict[str, Any], program: str) -> str:
    if program_alias(program) == "EP":
        return str(
            question.get("question_text_en")
            or question.get("question_en")
            or question.get("question_text")
            or question.get("question")
            or ""
        )
    return str(
        question.get("question_text_th")
        or question.get("question_th")
        or question.get("question_text")
        or question.get("question")
        or ""
    )


def _question_lesson_id(path: Path, question: dict[str, Any]) -> str:
    return str(question.get("lesson_id") or path.stem)


def _question_program(path: Path, question: dict[str, Any]) -> str:
    raw = question.get("program") or question.get("program_type") or question.get("content_program_type")
    if raw:
        return program_alias(raw)
    return program_alias("EP" if path.stem.lower().endswith("_ep") else "TH")


def _canonical_test_rows(
    *,
    program: str,
    grade: int | None = None,
    lesson_id: str | None = None,
    approved_only: bool = True,
) -> list[tuple[Path, int | None, dict[str, Any], int]]:
    from app.services.content_status import load_tests_status

    requested_program = program_alias(program)
    requested_base = base_lesson_id(lesson_id or "") if lesson_id else None
    statuses = load_tests_status()
    rows: list[tuple[Path, int | None, dict[str, Any], int]] = []
    seen_question_ids: set[str] = set()
    for path in _quiz_files():
        grade_match = re.search(r"grade_(\d+)", str(path))
        row_grade = int(grade_match.group(1)) if grade_match else None
        if grade is not None and row_grade != grade:
            continue
        if program_alias(_question_program(path, {})) != requested_program and path.stem.lower().endswith("_ep") != (requested_program == "EP"):
            continue
        for index, question in enumerate(_load_question_rows(path)):
            if not isinstance(question, dict):
                continue
            row_lesson_id = _question_lesson_id(path, question)
            if requested_base and base_lesson_id(row_lesson_id) != requested_base:
                continue
            if program_alias(_question_program(path, question)) != requested_program:
                continue
            question_id = _question_id(path, question, index)
            if question_id in seen_question_ids:
                continue
            if approved_only and not _status_is_student_visible(statuses.get(question_id, {})):
                continue
            seen_question_ids.add(question_id)
            rows.append((path, row_grade, question, index))
    return rows


def list_canonical_lessons(
    program: str,
    grade: int | None = None,
    include_admin_status: bool = False,
) -> list[dict[str, Any]]:
    """List file-backed lesson content by program using sidecar approval status.

    This is the shared source used by admin and student surfaces. It never
    cross-falls back between TH and EP.
    """
    from app.services.content_status import get_lesson_status

    requested_program = program_alias(program)
    if grade is not None and grade in supported_topic_folder_grades():
        return sorted(
            list_topic_folder_lessons(
                grade,
                requested_program,
                approved_only=not include_admin_status,
                include_empty=include_admin_status,
            ),
            key=lambda item: (item["grade_level"], item["base_lesson_id"], item["program"]),
        )
    items: list[dict[str, Any]] = []
    test_rows_by_lesson: dict[str, list[tuple[Path, int | None, dict[str, Any], int]]] = {}
    for row in _canonical_test_rows(program=requested_program, grade=grade, approved_only=True):
        path, _row_grade, question, _index = row
        row_lesson_id = _question_lesson_id(path, question)
        test_rows_by_lesson.setdefault(base_lesson_id(row_lesson_id), []).append(row)
    for path in _lesson_files():
        payload = _read_json(path)
        if not payload:
            continue
        lesson_id = _canonical_lesson_id(payload, path)
        lesson_grade = int(payload.get("grade_level") or 0)
        if lesson_grade in supported_topic_folder_grades():
            continue
        lesson_program = lesson_program_alias(payload)
        if lesson_program != requested_program:
            continue
        if grade is not None and lesson_grade != grade:
            continue
        status = get_lesson_status(lesson_id)
        approved = _status_is_student_visible(status)
        if not include_admin_status and not approved:
            continue
        test_rows = test_rows_by_lesson.get(base_lesson_id(lesson_id), [])
        title = payload.get("title_th") if requested_program == "TH" else (payload.get("title_en") or payload.get("title_th"))
        item = {
            "lesson_id": lesson_id,
            "id": lesson_id,
            "base_lesson_id": base_lesson_id(payload, path),
            "program": requested_program,
            "program_type": requested_program,
            "grade_level": lesson_grade,
            "title": title or lesson_id,
            "title_th": payload.get("title_th") or "",
            "title_en": payload.get("title_en") or "",
            "topic_code": payload.get("topic_code") or base_lesson_id(payload, path),
            "skill_code": payload.get("skill_code") or payload.get("topic_code") or lesson_id,
            "estimated_minutes": int(payload.get("estimated_minutes") or 5),
            "student_visible": approved,
            "approved": approved,
            "has_approved_test": bool(test_rows),
            "test_bank_source": str(test_rows[0][0]) if test_rows else None,
            "source_path": str(path),
            "active_content_source_path": str(path),
            "file_structure": "subfolder" if path.parent.name != "lessons" else "flat",
            "loaded_from_backup": not path_is_active_content(path, "lessons"),
        }
        if include_admin_status:
            reason = ""
            if not approved:
                reason = f"status={status.get('status', 'missing') or 'missing'}"
            item.update(
                {
                    "language": requested_program,
                "status": str(status.get("status") or "needs_review").lower(),
                "approved": approved,
                "student_visible": approved,
                "reviewer_note": status.get("reviewer_note", ""),
                    "approved_by": status.get("approved_by", ""),
                    "approved_at": status.get("approved_at", ""),
                    "qa_flags": status.get("qa_flags", 0),
                    "updated_at": status.get("updated_at", ""),
                    "student_hidden_reason": reason,
                }
            )
        items.append(item)
    topic_grades = supported_topic_folder_grades() if grade is None else ({grade} if grade in supported_topic_folder_grades() else set())
    for topic_grade in topic_grades:
        items.extend(
            list_topic_folder_lessons(
                topic_grade,
                requested_program,
                approved_only=not include_admin_status,
                include_empty=include_admin_status,
            )
        )
    return sorted(items, key=lambda item: (item["grade_level"], item["base_lesson_id"], item["program"]))


def get_canonical_lesson(lesson_id: str, program: str) -> tuple[Path, dict[str, Any]] | None:
    requested_program = program_alias(program)
    topic_group = get_topic_lesson_group(lesson_id, requested_program)
    if topic_group:
        return topic_group
    requested_base = base_lesson_id(lesson_id)
    for path in _lesson_files():
        payload = _read_json(path)
        if not payload or lesson_program_alias(payload) != requested_program:
            continue
        actual_id = _canonical_lesson_id(payload, path)
        if lesson_id in {actual_id, path.stem} or base_lesson_id(payload, path) == requested_base:
            payload.setdefault("lesson_id", actual_id)
            payload.setdefault("id", actual_id)
            return path, payload
    return None


def list_canonical_tests(
    program: str,
    grade: int | None = None,
    lesson_id: str | None = None,
    approved_only: bool = True,
) -> list[dict[str, Any]]:
    from app.services.content_status import get_test_status

    requested_program = program_alias(program)
    topic_group_grade = grade_from_lesson_group(lesson_id or "") if lesson_id else None
    if (grade in supported_topic_folder_grades()) or topic_group_grade:
        topic_grade = topic_group_grade or int(grade or 0)
        topic_filter = topic_from_lesson_group(lesson_id or "") if lesson_id else None
        grade_topic_items: list[dict[str, Any]] = []
        topics = [topic_filter] if topic_filter else discover_topic_folders(topic_grade, "quizzes", requested_program)
        for topic_folder in [topic for topic in topics if topic]:
            group_id = _topic_lesson_group_id(topic_grade, topic_folder)
            for path, payload in list_topic_quiz_variants(topic_grade, topic_folder, requested_program, approved_only=approved_only):
                questions = payload.get("questions")
                if not isinstance(questions, list):
                    continue
                for index, question in enumerate(questions):
                    if not isinstance(question, dict):
                        continue
                    question_id = str(question.get("question_id") or question.get("id") or f"{path.stem}_q{index + 1:03d}")
                    grade_topic_items.append(
                        {
                            "test_id": question_id,
                            "question_id": question_id,
                            "lesson_id": group_id,
                            "base_lesson_id": group_id,
                            "lesson_group_id": group_id,
                            "program": requested_program,
                            "language": requested_program,
                            "grade_level": topic_grade,
                            "question": _question_text(question, requested_program),
                            "choices": question.get("choices") or [],
                            "correct_answer": question.get("correct_answer") or question.get("answer"),
                            "explanation": question.get("explanation_en") if requested_program == "EP" else (question.get("explanation_th") or question.get("explanation")),
                            "difficulty": question.get("difficulty") or "medium",
                            "skill_tag": question.get("skill_tag") or question.get("skill_code") or group_id,
                            "status": _topic_variant_status(payload),
                            "quiz_variant_id": payload.get("quiz_variant_id") or path.stem,
                            "variant_id": payload.get("quiz_variant_id") or path.stem,
                            "source_filename": path.name,
                            "source_path_hash": payload.get("source_path_hash") or _source_path_hash(path),
                            "student_visible": bool(approved_only),
                            "used_by_student_loader": bool(approved_only),
                            "approved_quiz_count": len(list_topic_quiz_variants(topic_grade, topic_folder, requested_program, approved_only=True)),
                            "selected_active_source_root": str(_topic_dir(topic_grade, "quizzes", topic_folder, requested_program)),
                            "backup_loaded": False,
                            "legacy_loaded": False,
                            "source_path": str(path),
                            "active_content_source_path": str(path),
                            "source_folder": str(path.parent),
                            "topic_folder": topic_folder,
                            "file_structure": f"grade{topic_grade}_topic_folder",
                            "loaded_from_backup": False,
                        }
                    )
        if grade in supported_topic_folder_grades():
            return grade_topic_items
        if lesson_id and topic_group_grade:
            return grade_topic_items
    items: list[dict[str, Any]] = []
    for path, row_grade, question, index in _canonical_test_rows(program=requested_program, grade=grade, lesson_id=lesson_id, approved_only=approved_only):
        question_id = _question_id(path, question, index)
        status = get_test_status(question_id)
        row_lesson_id = _question_lesson_id(path, question)
        items.append(
            {
                "test_id": question_id,
                "question_id": question_id,
                "lesson_id": row_lesson_id,
                "base_lesson_id": base_lesson_id(row_lesson_id),
                "program": requested_program,
                "language": requested_program,
                "grade_level": row_grade,
                "question": _question_text(question, requested_program),
                "choices": question.get("choices") or [],
                "correct_answer": question.get("correct_answer") or question.get("answer"),
                "explanation": question.get("explanation_en") if requested_program == "EP" else (question.get("explanation_th") or question.get("explanation")),
                "difficulty": question.get("difficulty") or "medium",
                "skill_tag": question.get("skill_tag") or question.get("skill_code"),
                "status": str(status.get("status") or "needs_review").lower(),
                "source_path": str(path),
                "active_content_source_path": str(path),
                "file_structure": "subfolder" if path.parent.name != "quizzes" else "flat",
                "loaded_from_backup": not path_is_active_content(path, "quizzes"),
            }
        )
    if grade is None and not lesson_id:
        for topic_grade in supported_topic_folder_grades():
            for topic_folder in discover_topic_folders(topic_grade, "quizzes", requested_program):
                group_id = _topic_lesson_group_id(topic_grade, topic_folder)
                for path, payload in list_topic_quiz_variants(topic_grade, topic_folder, requested_program, approved_only=approved_only):
                    questions = payload.get("questions")
                    if not isinstance(questions, list):
                        continue
                    for index, question in enumerate(questions):
                        if not isinstance(question, dict):
                            continue
                        question_id = str(question.get("question_id") or question.get("id") or f"{path.stem}_q{index + 1:03d}")
                        items.append(
                            {
                                "test_id": question_id,
                                "question_id": question_id,
                                "lesson_id": group_id,
                                "base_lesson_id": group_id,
                                "lesson_group_id": group_id,
                                "program": requested_program,
                                "language": requested_program,
                                "grade_level": topic_grade,
                                "question": _question_text(question, requested_program),
                                "choices": question.get("choices") or [],
                                "correct_answer": question.get("correct_answer") or question.get("answer"),
                                "explanation": question.get("explanation_en") if requested_program == "EP" else (question.get("explanation_th") or question.get("explanation")),
                                "difficulty": question.get("difficulty") or "medium",
                                "skill_tag": question.get("skill_tag") or question.get("skill_code") or group_id,
                                "status": _topic_variant_status(payload),
                                "quiz_variant_id": payload.get("quiz_variant_id") or path.stem,
                                "variant_id": payload.get("quiz_variant_id") or path.stem,
                                "source_filename": path.name,
                                "source_path_hash": payload.get("source_path_hash") or _source_path_hash(path),
                                "student_visible": bool(approved_only),
                                "used_by_student_loader": bool(approved_only),
                                "approved_quiz_count": len(list_topic_quiz_variants(topic_grade, topic_folder, requested_program, approved_only=True)),
                                "selected_active_source_root": str(_topic_dir(topic_grade, "quizzes", topic_folder, requested_program)),
                                "backup_loaded": False,
                                "legacy_loaded": False,
                                "source_path": str(path),
                                "active_content_source_path": str(path),
                                "source_folder": str(path.parent),
                                "topic_folder": topic_folder,
                                "file_structure": f"grade{topic_grade}_topic_folder",
                                "loaded_from_backup": False,
                            }
                        )
        return items
    if False:
        for topic_folder in GRADE3_TOPIC_ORDER:
            group_id = _grade3_lesson_group_id(topic_folder)
            for path, payload in list_grade3_quiz_variants(topic_folder, requested_program, approved_only=approved_only):
                questions = payload.get("questions")
                if not isinstance(questions, list):
                    continue
                for index, question in enumerate(questions):
                    if not isinstance(question, dict):
                        continue
                    question_id = str(question.get("question_id") or question.get("id") or f"{path.stem}_q{index + 1:03d}")
                    items.append(
                        {
                            "test_id": question_id,
                            "question_id": question_id,
                            "lesson_id": group_id,
                            "base_lesson_id": group_id,
                            "lesson_group_id": group_id,
                            "program": requested_program,
                            "language": requested_program,
                            "grade_level": 3,
                            "question": _question_text(question, requested_program),
                            "choices": question.get("choices") or [],
                            "correct_answer": question.get("correct_answer") or question.get("answer"),
                            "explanation": question.get("explanation_en") if requested_program == "EP" else (question.get("explanation_th") or question.get("explanation")),
                            "difficulty": question.get("difficulty") or "medium",
                            "skill_tag": question.get("skill_tag") or question.get("skill_code") or group_id,
                            "status": _grade3_variant_status(payload),
                            "quiz_variant_id": payload.get("quiz_variant_id") or path.stem,
                            "variant_id": payload.get("quiz_variant_id") or path.stem,
                            "source_filename": path.name,
                            "source_path_hash": payload.get("source_path_hash") or _source_path_hash(path),
                            "student_visible": True,
                            "used_by_student_loader": True,
                            "approved_quiz_count": len(list_grade3_quiz_variants(topic_folder, requested_program, approved_only=True)),
                            "selected_active_source_root": str(_grade3_topic_dir("quizzes", topic_folder, requested_program)),
                            "backup_loaded": False,
                            "legacy_loaded": False,
                            "source_path": str(path),
                            "active_content_source_path": str(path),
                            "source_folder": str(path.parent),
                            "topic_folder": topic_folder,
                            "file_structure": "grade3_topic_folder",
                            "loaded_from_backup": False,
                        }
                    )
    return items


def get_canonical_test_bank(lesson_id: str, program: str) -> list[dict[str, Any]]:
    topic_grade = grade_from_lesson_group(lesson_id)
    topic_folder = topic_from_lesson_group(lesson_id)
    if topic_grade and topic_folder:
        return get_topic_test_bank(topic_grade, topic_folder, program)
    return list_canonical_tests(program=program, lesson_id=lesson_id, approved_only=True)


def has_approved_test(lesson_id: str, program: str) -> bool:
    topic_grade = grade_from_lesson_group(lesson_id)
    topic_folder = topic_from_lesson_group(lesson_id)
    if topic_grade and topic_folder:
        return has_topic_approved_quiz(topic_grade, topic_folder, program)
    return bool(get_canonical_test_bank(lesson_id, program))


def _lesson_identity_matches(payload: dict[str, Any], path: Path, lesson_id: str) -> bool:
    candidates = {
        path.stem,
        str(payload.get("lesson_id") or ""),
        str(payload.get("id") or ""),
        str(payload.get("topic_code") or ""),
        str(payload.get("skill_code") or ""),
        _base_lesson_id(payload, path),
    }
    return lesson_id in candidates


def find_lesson_file(lesson_id: str, program_type: str | None = None) -> tuple[Path, dict[str, Any], bool] | None:
    requested = program_alias(program_type) if program_type else None
    if requested:
        topic_group = get_topic_lesson_group(lesson_id, requested)
        if topic_group:
            return topic_group[0], topic_group[1], False
    matches: list[tuple[Path, dict[str, Any]]] = []
    for path in _lesson_files():
        payload = _read_json(path)
        if payload and _lesson_identity_matches(payload, path, lesson_id):
            matches.append((path, payload))
    if not matches:
        return None

    if requested:
        for path, payload in matches:
            if lesson_program_alias(payload) == requested:
                return path, payload, False
        if requested == "EP":
            for path, payload in matches:
                if lesson_program_alias(payload) == "TH":
                    return path, payload, True
        return None

    return matches[0][0], matches[0][1], False


def list_lessons(grade_level: int | None = None, program_type: str | None = None, search: str | None = None) -> list[dict[str, Any]]:
    requested = program_alias(program_type) if program_type else None
    query = (search or "").strip().lower()
    grouped: dict[str, dict[str, Any]] = {}
    if grade_level is None or grade_level in supported_topic_folder_grades():
        programs = [requested] if requested else ["TH", "EP"]
        topic_grades = supported_topic_folder_grades() if grade_level is None else {grade_level}
        for topic_grade in topic_grades:
            for program in programs:
                for item in list_topic_folder_lessons(topic_grade, program, approved_only=False, include_empty=True):
                    if query and query not in " ".join([item["lesson_id"], item.get("title_th", ""), item.get("title_en", ""), item.get("topic_folder", "")]).lower():
                        continue
                    grouped[item["lesson_id"] if requested else f"{item['lesson_id']}:{program}"] = {
                        "lesson_id": item["lesson_id"],
                        "grade_level": topic_grade,
                        "title_th": item["title_th"],
                        "title_en": item["title_en"],
                        "topic_code": item["topic_code"],
                        "skill_code": item["skill_code"],
                        "topic_folder": item["topic_folder"],
                        "source_path": item.get("source_path"),
                        "source_folder": item["source_folder"],
                        "file_structure": item.get("file_structure"),
                        "selected_variant_id": item.get("selected_variant_id"),
                        "variant_status": item.get("variant_status") or item.get("status"),
                        "section_completeness": item.get("section_completeness"),
                        "variant_count": item["variant_count"],
                        "approved_variant_count": item["approved_variant_count"],
                        "variant_files": item["variant_files"],
                        "approved_test_count": item.get("approved_quiz_count", 0),
                        "program_type": program,
                        "language": program,
                        "status": item.get("status", "needs_review"),
                        "has_th": program == "TH",
                        "has_ep": program == "EP",
                        "validation_status": "valid",
                        "issue_count": 0,
                    }
        if grade_level in supported_topic_folder_grades():
            return sorted(grouped.values(), key=lambda item: (item["grade_level"], item.get("program_type", ""), item["lesson_id"]))
    if False:
        for program in programs:
            for item in list_grade3_topic_lessons(program):
                if query and query not in " ".join([item["lesson_id"], item.get("title_th", ""), item.get("title_en", ""), item.get("topic_folder", "")]).lower():
                    continue
                grouped[item["lesson_id"] if requested else f"{item['lesson_id']}:{program}"] = {
                    "lesson_id": item["lesson_id"],
                    "grade_level": 3,
                    "title_th": item["title_th"],
                    "title_en": item["title_en"],
                    "topic_code": item["topic_code"],
                    "skill_code": item["skill_code"],
                    "topic_folder": item["topic_folder"],
                    "source_path": item.get("source_path"),
                    "source_folder": item["source_folder"],
                    "file_structure": item.get("file_structure"),
                    "selected_variant_id": item.get("selected_variant_id"),
                    "variant_status": item.get("variant_status") or item.get("status"),
                    "section_completeness": item.get("section_completeness"),
                    "variant_count": item["variant_count"],
                    "approved_variant_count": item["approved_variant_count"],
                    "variant_files": item["variant_files"],
                    "approved_test_count": item.get("approved_quiz_count", 0),
                    "program_type": program,
                    "language": program,
                    "status": item.get("status", "approved"),
                    "has_th": program == "TH",
                    "has_ep": program == "EP",
                    "validation_status": "valid",
                    "issue_count": 0,
                }
        if grade_level == 3:
            return sorted(grouped.values(), key=lambda item: (item["grade_level"], item.get("program_type", ""), item["lesson_id"]))
    for path in _lesson_files():
        payload = _read_json(path)
        if not payload:
            continue
        grade = int(payload.get("grade_level") or 0)
        if grade in supported_topic_folder_grades():
            continue
        if grade_level is not None and grade != grade_level:
            continue
        program = lesson_program_alias(payload)
        if requested and program != requested:
            continue
        lesson_id = _base_lesson_id(payload, path)
        title_th = str(payload.get("title_th") or "")
        title_en = str(payload.get("title_en") or "")
        if query and query not in " ".join([lesson_id, title_th, title_en]).lower():
            continue
        result = validate_lesson_content(payload)
        current = grouped.setdefault(
            lesson_id,
            {
                "lesson_id": lesson_id,
                "grade_level": grade,
                "title_th": title_th,
                "title_en": title_en,
                "topic_code": payload.get("topic_code") or lesson_id,
                "skill_code": payload.get("skill_code") or lesson_id,
                "has_th": False,
                "has_ep": False,
                "validation_status": "valid",
                "issue_count": 0,
            },
        )
        current["has_ep" if program == "EP" else "has_th"] = True
        current["title_th"] = current["title_th"] or title_th
        current["title_en"] = current["title_en"] or title_en
        issue_count = len(result["errors"]) + len(result["warnings"])
        current["issue_count"] += issue_count
        if result["errors"]:
            current["validation_status"] = "invalid"
        elif result["warnings"] and current["validation_status"] == "valid":
            current["validation_status"] = "warning"
    return sorted(grouped.values(), key=lambda item: (item["grade_level"], item["lesson_id"]))


def _mini_quiz_payload(block: dict[str, Any]) -> dict[str, Any]:
    data = block.get("data") if isinstance(block.get("data"), dict) else {}
    return {
        "question": block.get("question") or data.get("question") or data.get("question_th") or data.get("question_en"),
        "choices": block.get("choices") or data.get("choices"),
        "correct_answer": block.get("correct_answer") or data.get("correct_answer") or data.get("answer"),
        "explanation": block.get("explanation") or data.get("explanation") or data.get("explanation_th") or data.get("explanation_en"),
    }


def _number_value(value: Any) -> float | None:
    text = str(value or "").strip()
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def _arithmetic_expected(question: Any) -> float | None:
    text = str(question or "")
    text = text.replace("÷", "/").replace("Ã·", "/").replace("×", "*").replace("x", "*").replace("X", "*")
    match = re.search(r"(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)", text)
    if not match:
        return None
    left = float(match.group(1))
    op = match.group(2)
    right = float(match.group(3))
    if op == "+":
        return left + right
    if op == "-":
        return left - right
    if op == "*":
        return left * right
    if op == "/" and right != 0:
        return left / right
    return None


def _validate_quiz_payload(quiz: dict[str, Any], errors: list[str], prefix: str) -> None:
    question = quiz.get("question")
    choices = quiz.get("choices")
    correct_answer = quiz.get("correct_answer")
    explanation = quiz.get("explanation")
    if not question:
        errors.append(f"{prefix}: mini_quiz question is required")
    if not isinstance(choices, list) or len(choices) != 4:
        errors.append(f"{prefix}: mini_quiz choices must contain exactly 4 items")
        choices = choices if isinstance(choices, list) else []
    normalized_choices = [str(choice).strip() for choice in choices]
    if len(set(normalized_choices)) != len(normalized_choices):
        errors.append(f"{prefix}: mini_quiz choices must be unique")
    if correct_answer is None or str(correct_answer).strip() == "":
        errors.append(f"{prefix}: mini_quiz correct_answer is required")
    elif str(correct_answer).strip() not in normalized_choices:
        errors.append(f"{prefix}: mini_quiz correct_answer must be one of the choices")
    if not explanation:
        errors.append(f"{prefix}: mini_quiz explanation is required")

    expected = _arithmetic_expected(question)
    selected = _number_value(correct_answer)
    if expected is not None and selected is not None and abs(expected - selected) > 0.000001:
        errors.append(f"{prefix}: arithmetic answer should be {expected:g}")


def _validate_raw_arithmetic_answer(quiz: dict[str, Any], errors: list[str], prefix: str) -> None:
    question = quiz.get("question")
    explanation = quiz.get("explanation")
    expected = _arithmetic_expected(" ".join([str(question or ""), str(explanation or "")]))
    if expected is None:
        return
    choices = quiz.get("choices") if isinstance(quiz.get("choices"), list) else []
    raw_answer = quiz.get("correct_answer")
    index = _letter_choice_index(raw_answer)
    if index is not None and index < len(choices):
        raw_answer = choices[index]
    selected = _number_value(raw_answer)
    if selected is not None and abs(expected - selected) > 0.000001:
        errors.append(f"{prefix}: arithmetic answer should be {expected:g}")


def validate_lesson_content(lesson: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    lesson_id = str(lesson.get("lesson_id") or lesson.get("id") or "").strip()
    if not lesson_id:
        errors.append("lesson_id is required")
    try:
        grade = int(lesson.get("grade_level"))
    except Exception:
        grade = 0
    if grade < 1 or grade > 6:
        errors.append("grade_level must be between 1 and 6")

    raw_blocks = _parse_json_like(lesson.get("visual_blocks"))
    if not isinstance(raw_blocks, list):
        errors.append("visual_blocks must be a list")
        raw_blocks = []

    for index, raw_block in enumerate(raw_blocks):
        parsed = _parse_json_like(raw_block)
        if not isinstance(parsed, dict):
            errors.append(f"visual_blocks[{index}] must be an object")
            continue
        raw_type = str(parsed.get("type") or parsed.get("block_type") or "").strip()
        if raw_type in DEPRECATED_BLOCK_TYPES:
            errors.append(f"visual_blocks[{index}] uses deprecated block type {raw_type}")
        if raw_type == "mini_quiz":
            _validate_raw_arithmetic_answer(_mini_quiz_payload({"data": _block_data(parsed)}), errors, f"visual_blocks[{index}]")
        block = _normalize_block(parsed)
        if not block:
            errors.append(f"visual_blocks[{index}] is invalid")
            continue
        if block["type"] not in ALLOWED_BLOCK_TYPES:
            errors.append(f"visual_blocks[{index}] has unsupported block type {block['type']}")
        if block["type"] == "mini_quiz":
            _validate_quiz_payload(_mini_quiz_payload(block), errors, f"visual_blocks[{index}]")

    return {"valid": not errors, "errors": errors, "warnings": warnings}


def save_lesson(lesson_id: str, program_type: str | None, payload: dict[str, Any]) -> tuple[Path, Path | None]:
    found = find_lesson_file(lesson_id, program_type)
    path: Path
    if found:
        path = found[0]
    else:
        grade = int(payload.get("grade_level") or 1)
        suffix = "_ep" if program_alias(program_type) == "EP" else ""
        path = CONTENT_ROOT / f"grade_{grade}" / "lessons" / f"{lesson_id}{suffix}.json"
    backup_path = None
    if path.exists():
        backup_dir = CONTENT_ROOT / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
        backup_path = backup_dir / f"{timestamp}_{path.stem}.json"
        shutil.copy2(path, backup_path)
    _write_json(path, payload)
    return path, backup_path


def _quiz_files() -> list[Path]:
    return _active_json_files("quizzes")


def _load_question_rows(path: Path) -> list[dict[str, Any]]:
    payload = _read_json(path) or {}
    questions = payload.get("questions")
    return questions if isinstance(questions, list) else []


def validate_question_payload(question: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    choices = question.get("choices")
    quiz = {
        "question": (
            question.get("question")
            or question.get("question_text")
            or question.get("question_text_th")
            or question.get("question_text_en")
            or question.get("question_en")
        ),
        "choices": choices,
        "correct_answer": question.get("correct_answer") or question.get("answer"),
        "explanation": question.get("explanation") or question.get("explanation_th") or question.get("explanation_en"),
    }
    _validate_quiz_payload(quiz, errors, str(question.get("question_id") or question.get("id") or "question"))
    return {"valid": not errors, "errors": errors, "warnings": []}


def list_questions(grade_level: int | None = None, lesson_id: str | None = None, issue_only: bool = False) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for path in _quiz_files():
        grade_match = re.search(r"grade_(\d+)", str(path))
        grade = int(grade_match.group(1)) if grade_match else None
        if grade_level is not None and grade != grade_level:
            continue
        topic = path.stem
        if lesson_id and lesson_id not in {topic, path.stem}:
            continue
        for index, question in enumerate(_load_question_rows(path)):
            validation = validate_question_payload(question)
            if issue_only and validation["valid"]:
                continue
            question_id = str(question.get("question_id") or question.get("id") or f"{path.stem}_{index + 1}")
            explanation = question.get("explanation") or question.get("explanation_th") or question.get("explanation_en")
            items.append(
                {
                    "question_id": question_id,
                    "grade_level": grade,
                    "lesson_id": topic,
                    "question": (
                        question.get("question_text_th")
                        or question.get("question_text_en")
                        or question.get("question_text")
                        or question.get("question")
                        or question.get("question_en")
                    ),
                    "choices": question.get("choices") or [],
                    "correct_answer": question.get("correct_answer") or question.get("answer"),
                    "explanation": explanation,
                    "explanation_th": explanation,
                    "difficulty": question.get("difficulty"),
                    "skill_tag": question.get("skill_tag") or question.get("skill_code"),
                    "validation_status": "valid" if validation["valid"] else "invalid",
                    "errors": validation["errors"],
                }
            )
    return items


def validate_all_questions() -> dict[str, Any]:
    questions = list_questions()
    invalid = [question for question in questions if question["validation_status"] == "invalid"]
    return {"valid": not invalid, "questions_total": len(questions), "questions_invalid": len(invalid), "items": invalid}


def update_question_payload(question_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
    for path in _quiz_files():
        if path.suffix == ".jsonl":
            rows = _load_question_rows(path)
            changed = False
            for index, question in enumerate(rows):
                current_id = str(question.get("question_id") or question.get("id") or f"{path.stem}_{index + 1}")
                if current_id == question_id:
                    question.update(patch)
                    changed = True
                    updated = question
                    break
            if changed:
                path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")
                return updated
            continue

        payload = _read_json(path)
        if not payload:
            continue
        questions = payload.get("questions")
        if not isinstance(questions, list):
            continue
        for index, question in enumerate(questions):
            if not isinstance(question, dict):
                continue
            current_id = str(question.get("question_id") or question.get("id") or f"{path.stem}_{index + 1}")
            if current_id == question_id:
                question.update(patch)
                _write_json(path, payload)
                return question
    return None


def qa_summary() -> dict[str, Any]:
    lessons = list_lessons()
    questions = list_questions()
    invalid_lessons = [lesson for lesson in lessons if lesson["validation_status"] == "invalid"]
    invalid_questions = [question for question in questions if question["validation_status"] == "invalid"]
    common: dict[str, int] = {}
    for lesson in invalid_lessons:
        common["invalid_lesson"] = common.get("invalid_lesson", 0) + 1
    for question in invalid_questions:
        for error in question.get("errors", []):
            key = str(error).split(":")[-1].strip()
            common[key] = common.get(key, 0) + 1
    return {
        "lessons_total": len(lessons),
        "lessons_valid": len(lessons) - len(invalid_lessons),
        "lessons_invalid": len(invalid_lessons),
        "questions_total": len(questions),
        "questions_invalid": len(invalid_questions),
        "common_issues": [{"issue": key, "count": count} for key, count in sorted(common.items())],
    }
