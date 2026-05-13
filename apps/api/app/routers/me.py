import json
import logging
import random
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import (
    ChildProfile,
    ChildQuest,
    CheckInEvent,
    LearningQuest,
    LessonActivity,
    LessonVariantView,
    Lesson,
    QuestionAttemptHistory,
    Question,
    QuizAnswer,
    QuizSession,
    SkillMastery,
    Skill,
    StudentStats,
    Subject,
    TestResult,
    TestSession,
    User,
)
from app.routers.children import child_to_out
from app.routers.deps import current_user
from app.schemas.api import (
    ChildOut,
    ChildUpdate,
    LessonOut,
    MeTestStartIn,
    MeQuestionSubmitIn,
    QuestActionOut,
    QuestOut,
    TestResultOut,
    TestStartOut,
    TestSubmitIn,
)
from app.services.answers import answer_match_details, is_answer_correct
from app.services.content_quality import lesson_is_student_visible, lesson_program_type, validate_lesson_payload
from app.services.foundation import can_access_program, is_paid, recommended_foundation_grade, remaining_free_tests
from app.services.lesson_content import (
    find_lesson_file,
    lesson_program_alias,
    normalize_lesson_visual_blocks,
    program_alias,
)
from app.services.mastery import AnswerResult, calculate_mastery_score, infer_mistake_type, mastery_level
from app.services.rank_titles import rank_title_for_score
from app.services.student_progress import (
    apply_quest_progress,
    award_progress,
    complete_child_quest,
    get_or_create_child_quest,
    get_or_create_stats,
    quest_target,
    refresh_rank,
)

router = APIRouter(prefix="/me", tags=["me"])

CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "math"
THAILAND_TZ = ZoneInfo("Asia/Bangkok")
RATIO_POLICY = "80_core_20_challenge"
logger = logging.getLogger(__name__)


def _profile(db: Session, user: User) -> ChildProfile:
    child = db.scalar(select(ChildProfile).where(ChildProfile.parent_user_id == user.id))
    if not child:
        raise HTTPException(status_code=404, detail="ไม่พบโปรไฟล์นักเรียน")
    return child


def _question_payload(question: Question) -> dict:
    metadata = question.metadata_json or {}
    return {
        "id": question.id,
        "question_id": question.id,
        "skill_id": question.skill_id,
        "grade_level": question.grade_level,
        "difficulty": question.difficulty,
        "question_text": question.question_text,
        "question_text_th": question.question_text,
        "choices": question.choices or [],
        "hint": question.hint,
        "skill_code": metadata.get("skill_code", ""),
        "topic_code": metadata.get("topic_code", ""),
    }


def _lesson_public_id(lesson: Lesson) -> str:
    content = lesson.content or {}
    return str(content.get("content_id") or content.get("lesson_id") or lesson.id)


def _lesson_by_public_id(db: Session, lesson_id: str) -> Lesson | None:
    lesson = db.get(Lesson, lesson_id)
    if lesson:
        return lesson
    return db.scalar(
        select(Lesson).where(
            or_(
                Lesson.content["content_id"].as_string() == lesson_id,
                Lesson.content["lesson_id"].as_string() == lesson_id,
            )
        )
    )


def _lesson_content_is_real(content: dict | None) -> bool:
    if not content:
        return False
    placeholder_markers = (
        "เนื้อหาบทเรียนจะแสดงที่นี่",
        "backend พร้อมให้บริการ",
        "placeholder",
        "mock",
    )
    text_values = [str(value) for value in content.values() if isinstance(value, str)]
    if any(marker in value for marker in placeholder_markers for value in text_values):
        return False
    return bool(
        content.get("title_th")
        and (
            content.get("objective_th")
            or content.get("story_intro_th")
            or content.get("explanation_steps")
            or content.get("worked_examples")
        )
    )


def _json_lesson_dirs() -> list[Path]:
    return [CONTENT_ROOT / f"grade_{grade}" / "lessons" for grade in range(1, 7)]


def _json_lesson_file(lesson_id: str) -> Path | None:
    for directory in _json_lesson_dirs():
        path = directory / f"{lesson_id}.json"
        if path.exists() and path.is_file():
            return path
    return None


def _load_json_lesson(lesson_id: str) -> dict | None:
    path = _json_lesson_file(lesson_id)
    if not path:
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    payload.setdefault("lesson_id", lesson_id)
    payload.setdefault("id", lesson_id)
    if not payload.get("grade_level"):
        for grade in range(1, 7):
            if path.parent.parent.name == f"grade_{grade}":
                payload["grade_level"] = grade
                break
    payload.setdefault("topic_code", payload.get("lesson_id") or lesson_id)
    payload.setdefault("skill_code", payload.get("topic_code") or lesson_id)
    return payload


def _quiz_payload_for_lesson(payload: dict) -> dict | None:
    lesson_id = str(payload.get("lesson_id") or payload.get("id") or "")
    quiz_id = str(payload.get("quiz_id") or lesson_id)
    grade_level = int(payload.get("grade_level") or 0)
    if not quiz_id or not grade_level:
        return None
    path = CONTENT_ROOT / f"grade_{grade_level}" / "quizzes" / f"{quiz_id}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _child_lesson_track(child: ChildProfile) -> str:
    return "EP" if (child.program_type or "THP").upper() == "EP" else "THP"


def _lesson_track_matches_child(payload: dict, child: ChildProfile) -> bool:
    return lesson_program_type(payload) == _child_lesson_track(child)


def _json_lesson_visible_for_child(payload: dict, child: ChildProfile) -> bool:
    return _lesson_track_matches_child(payload, child) and lesson_is_student_visible(payload, _quiz_payload_for_lesson(payload))


def _db_lesson_visible_for_child(lesson: Lesson, child: ChildProfile) -> bool:
    content = lesson.content or {}
    if not _lesson_track_matches_child(content, child):
        return False
    if content.get("quality_required") is True or content.get("content_schema_version") == "2.0":
        return validate_lesson_payload(content)["publishable"]
    return True


def _parse_json_like(value):
    if not isinstance(value, str):
        return value
    text = value.strip()
    if not text:
        return value
    if not ((text.startswith("{") and text.endswith("}")) or (text.startswith("[") and text.endswith("]"))):
        return value
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return value


def _normalize_nested_visual_value(value):
    value = _parse_json_like(value)
    if isinstance(value, dict):
        return {str(key): _normalize_nested_visual_value(nested) for key, nested in value.items()}
    if isinstance(value, list):
        return [_normalize_nested_visual_value(item) for item in value]
    return value


def _normalize_visual_block(block) -> dict | None:
    block = _parse_json_like(block)
    if isinstance(block, list):
        nested = normalize_visual_blocks(block)
        return nested[0] if nested else None
    if not isinstance(block, dict):
        if isinstance(block, str) and block.strip():
            return {"type": "text", "data": {"text": block.strip()}}
        return None

    block_type = str(block.get("type") or block.get("block_type") or "content")
    raw_data = block.get("data")
    if raw_data is None:
        data = {str(key): value for key, value in block.items() if key not in {"type", "block_type", "data"}}
    else:
        parsed_data = _parse_json_like(raw_data)
        data = parsed_data if isinstance(parsed_data, dict) else {"value": parsed_data}
    return {"type": block_type, "data": _normalize_nested_visual_value(data)}


def normalize_visual_blocks(value) -> list[dict]:
    value = _parse_json_like(value)
    if value is None:
        return []
    if isinstance(value, dict):
        block = _normalize_visual_block(value)
        return [block] if block else []
    if not isinstance(value, list):
        block = _normalize_visual_block(value)
        return [block] if block else []

    normalized = []
    for item in value:
        parsed = _parse_json_like(item)
        if isinstance(parsed, list):
            normalized.extend(normalize_visual_blocks(parsed))
            continue
        block = _normalize_visual_block(parsed)
        if block:
            normalized.append(block)
    return normalized


def _lesson_variants(payload: dict) -> list[dict]:
    variants = payload.get("lesson_variants") or []
    if not isinstance(variants, list) or not variants:
        return [
            {
                "variant_id": "default",
                "variant_title_th": payload.get("title_th") or payload.get("lesson_id") or payload.get("id") or "",
                "story_theme_th": payload.get("story_theme_th") or "",
                "visual_blocks": normalize_visual_blocks(payload.get("visual_blocks")),
            }
        ]
    normalized = []
    for index, variant in enumerate(variants, start=1):
        if not isinstance(variant, dict):
            continue
        variant_id = str(variant.get("variant_id") or f"v{index:02d}")
        normalized.append(
            {
                "variant_id": variant_id,
                "variant_title_th": variant.get("variant_title_th") or payload.get("title_th") or "",
                "story_theme_th": variant.get("story_theme_th") or "",
                "visual_blocks": normalize_visual_blocks(variant.get("visual_blocks")),
            }
        )
    return normalized or _lesson_variants({**payload, "lesson_variants": []})


def _select_lesson_variant(db: Session, child: ChildProfile, lesson_id: str, payload: dict, *, record_view: bool = True) -> dict:
    variants = _lesson_variants(payload)
    variant_by_id = {variant["variant_id"]: variant for variant in variants}
    variant_ids = list(variant_by_id)
    views = db.scalars(
        select(LessonVariantView)
        .where(LessonVariantView.child_id == child.id, LessonVariantView.lesson_id == lesson_id)
        .order_by(LessonVariantView.viewed_at, LessonVariantView.id)
    ).all()
    current_cycle = max((view.cycle_number or 1 for view in views), default=1)
    current_seen = {view.variant_id for view in views if (view.cycle_number or 1) == current_cycle}
    last_variant_id = views[-1].variant_id if views else None

    if current_seen >= set(variant_ids):
        current_cycle += 1
        current_seen = set()

    candidates = [variant_id for variant_id in variant_ids if variant_id not in current_seen]
    if len(candidates) > 1 and last_variant_id in candidates:
        candidates = [variant_id for variant_id in candidates if variant_id != last_variant_id]
    selected_id = candidates[0] if candidates else variant_ids[0]
    if selected_id == last_variant_id and len(variant_ids) > 1:
        selected_id = next((variant_id for variant_id in variant_ids if variant_id != last_variant_id), selected_id)
    variant = dict(variant_by_id[selected_id])
    variant["selected_variant_id"] = selected_id
    variant["variant_cycle_number"] = current_cycle
    if record_view:
        db.add(
            LessonVariantView(
                child_id=child.id,
                lesson_id=lesson_id,
                variant_id=selected_id,
                cycle_number=current_cycle,
                viewed_at=datetime.now(UTC),
            )
        )
    return variant


def _all_json_lessons() -> list[dict]:
    lessons: list[dict] = []
    seen: set[str] = set()
    for directory in _json_lesson_dirs():
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*.json")):
            lesson_id = path.stem
            if lesson_id in seen:
                continue
            payload = _load_json_lesson(lesson_id)
            if payload:
                lessons.append(payload)
                seen.add(lesson_id)
    return lessons


def _json_lesson_item(payload: dict, child: ChildProfile, current_index: int | None) -> dict:
    grade_level = int(payload.get("grade_level") or 1)
    paid = can_access_program(child, payload.get("program_type") or payload.get("content_program_type") or "TH")
    is_review = grade_level < child.grade_level
    is_free = is_review or current_index == 0
    is_locked = not paid and not is_free
    lesson_id = str(payload.get("lesson_id") or payload.get("id"))
    description = payload.get("description_th") or payload.get("objective_th") or payload.get("story_intro_th") or ""
    return {
        "lesson_id": lesson_id,
        "id": lesson_id,
        "title_th": payload.get("title_th") or lesson_id,
        "title_en": payload.get("title_en"),
        "program_type": lesson_program_alias(payload),
        "description_th": description,
        "title": payload.get("title_th") or lesson_id,
        "grade_level": grade_level,
        "topic_code": payload.get("topic_code") or lesson_id,
        "skill_code": payload.get("skill_code") or payload.get("topic_code") or lesson_id,
        "estimated_minutes": int(payload.get("estimated_minutes") or 5),
        "is_free": is_free,
        "is_locked": is_locked,
        "lock_reason": "สมาชิกฟรีเรียนได้เฉพาะบทเรียนแรก" if is_locked else None,
        "has_test": bool(payload.get("has_test", True)),
        "is_review": is_review,
        "access_type": "review" if is_review else "current",
        "status": "locked" if is_locked else "available",
        "content_preview": description,
        "linked_quiz_id": payload.get("quiz_id"),
    }


def _json_lesson_sections(child: ChildProfile) -> dict | None:
    rows = [
        payload
        for payload in _all_json_lessons()
        if _json_lesson_visible_for_child(payload, child)
    ]
    if not rows:
        return None
    rows.sort(key=lambda payload: (int(payload.get("grade_level") or 0), str(payload.get("lesson_id") or payload.get("id"))))
    current_count = 0
    items = []
    for payload in rows:
        grade_level = int(payload.get("grade_level") or 0)
        current_index = None
        if grade_level == child.grade_level:
            current_index = current_count
            current_count += 1
        items.append(_json_lesson_item(payload, child, current_index))
    return {
        "all_lessons": items,
        "free_lessons": [item for item in items if item["is_free"]],
        "locked_lessons": [item for item in items if item["is_locked"]],
        "current_grade_lessons": [item for item in items if item["grade_level"] == child.grade_level],
        "review_lessons": [item for item in items if item["grade_level"] < child.grade_level],
        "future_lessons": [item for item in items if item["grade_level"] > child.grade_level],
    }


def _with_variant_payload(base: dict, variant: dict | None) -> dict:
    variant = variant or {}
    base.update(
        {
            "selected_variant_id": variant.get("selected_variant_id") or variant.get("variant_id"),
            "variant_title_th": variant.get("variant_title_th") or "",
            "story_theme_th": variant.get("story_theme_th") or "",
            "visual_blocks": normalize_visual_blocks(variant.get("visual_blocks")),
        }
    )
    if variant.get("variant_cycle_number") is not None:
        base["variant_cycle_number"] = variant["variant_cycle_number"]
    return base


def _json_lesson_content_payload(payload: dict, item: dict, variant: dict | None = None) -> dict:
    lesson_id = str(payload.get("lesson_id") or payload.get("id"))
    return _with_variant_payload({
        "lesson_id": lesson_id,
        "id": lesson_id,
        "grade_level": int(payload.get("grade_level") or item["grade_level"]),
        "program_type": lesson_program_alias(payload),
        "title_th": payload.get("title_th") or item["title_th"],
        "title_en": payload.get("title_en") or "",
        "objective_th": payload.get("objective_th") or "",
        "objective_en": payload.get("objective_en") or "",
        "thai_support": payload.get("thai_support") or "",
        "vocabulary": payload.get("vocabulary") or [],
        "explanation_en": payload.get("explanation_en") or "",
        "explanation_th": payload.get("explanation_th") or "",
        "story_intro_th": payload.get("story_intro_th") or "",
        "explanation_steps": payload.get("explanation_steps") or [],
        "worked_examples": payload.get("worked_examples") or [],
        "common_mistakes": payload.get("common_mistakes") or [],
        "hints": payload.get("hints") or [],
        "estimated_minutes": int(payload.get("estimated_minutes") or item["estimated_minutes"] or 5),
        "has_test": bool(payload.get("has_test", item["has_test"])),
        "topic_code": payload.get("topic_code") or item["topic_code"],
        "skill_code": payload.get("skill_code") or item["skill_code"],
        "is_locked": item["is_locked"],
        "lock_reason": item["lock_reason"],
    }, variant)


def _json_lesson_detail_item(payload: dict, child: ChildProfile) -> dict:
    grade_level = int(payload.get("grade_level") or 1)
    current_index = 0 if grade_level == child.grade_level else None
    item = _json_lesson_item(payload, child, current_index)
    # Detail views should be able to render real content once the route is reachable.
    item["is_locked"] = False
    item["lock_reason"] = None
    item["status"] = "available"
    return item


def _ensure_json_lesson_in_db(db: Session, payload: dict) -> Lesson:
    subject = _subject(db)
    lesson_id = str(payload.get("lesson_id") or payload.get("id"))
    grade_level = int(payload.get("grade_level") or 1)
    skill_code = str(payload.get("skill_code") or payload.get("topic_code") or lesson_id)
    skill = db.scalar(select(Skill).where(Skill.code == skill_code))
    if not skill:
        skill = Skill(
            subject_id=subject.id,
            grade_level=grade_level,
            code=skill_code,
            name=str(payload.get("title_th") or skill_code),
            description=payload.get("objective_th"),
            difficulty_order=grade_level * 100,
        )
        db.add(skill)
        db.flush()
    skill.subject_id = subject.id
    skill.grade_level = grade_level
    skill.name = str(payload.get("title_th") or skill.name)
    skill.description = payload.get("objective_th") or skill.description
    lesson = _lesson_by_public_id(db, lesson_id)
    content = dict(payload)
    content["content_id"] = lesson_id
    content["lesson_id"] = lesson_id
    content["grade_level"] = grade_level
    content["skill_code"] = skill_code
    content["topic_code"] = str(payload.get("topic_code") or skill_code)
    if not lesson:
        lesson = Lesson(skill_id=skill.id, title=str(payload.get("title_th") or lesson_id), content=content)
        db.add(lesson)
    lesson.skill_id = skill.id
    lesson.title = str(payload.get("title_th") or lesson_id)
    lesson.content = content
    lesson.source = "json"
    lesson.status = "approved"
    db.flush()
    return lesson


def _test_title(grade_level: int) -> str:
    return f"เทสพื้นฐาน ป.{grade_level}"


def _subject(db: Session) -> Subject:
    subject = db.scalar(select(Subject).where(Subject.code == "math"))
    if not subject:
        subject = Subject(code="math", name="คณิตศาสตร์")
        db.add(subject)
        db.flush()
    return subject


FALLBACK_TOPICS = {
    1: [
        ("counting", "นับเลข 1-100", "ฝึกอ่านและนับจำนวน"),
        ("compare", "เปรียบเทียบจำนวน", "ฝึกดูจำนวนมากกว่า น้อยกว่า และเท่ากัน"),
        ("add-sub-20", "บวกและลบไม่เกิน 20", "ฝึกคิดบวกและลบจากโจทย์ใกล้ตัว"),
    ],
    2: [
        ("add-two-digit", "บวกเลขสองหลัก", "ฝึกบวกเลขสองหลักแบบเป็นขั้นตอน"),
        ("subtract-two-digit", "ลบเลขสองหลัก", "ฝึกลบเลขสองหลักและตรวจคำตอบ"),
        ("multiplication-intro", "คูณเบื้องต้น", "เข้าใจการคูณจากการบวกซ้ำ"),
        ("time-calendar", "เวลาและปฏิทิน", "อ่านเวลา วัน เดือน และปฏิทิน"),
        ("money-change", "เงินและการทอนเงิน", "นับเงินและคิดเงินทอนง่าย ๆ"),
    ],
    3: [
        ("multi-digit-multiply", "คูณหลายหลัก", "ฝึกคูณเลขหลายหลักทีละขั้น"),
        ("division-intro", "หารเบื้องต้น", "เข้าใจการแบ่งเท่า ๆ กัน"),
        ("fraction-intro", "เศษส่วนเบื้องต้น", "อ่านและเปรียบเทียบเศษส่วนง่าย ๆ"),
        ("word-problems", "โจทย์ปัญหา", "วิเคราะห์โจทย์และเลือกวิธีคิด"),
        ("measurement-area", "การวัดและพื้นที่", "ฝึกวัดความยาว น้ำหนัก และพื้นที่"),
    ],
    4: [
        ("long-multiply-divide", "คูณหารหลายหลัก", "ฝึกคำนวณหลายขั้นตอน"),
        ("fraction-decimal", "เศษส่วนและทศนิยม", "เชื่อมโยงเศษส่วนกับทศนิยม"),
        ("geometry-data", "เรขาคณิตและข้อมูล", "อ่านรูป มุม และแผนภูมิง่าย ๆ"),
    ],
    5: [
        ("fractions", "เศษส่วน", "คำนวณและแก้โจทย์เศษส่วน"),
        ("decimals-percent", "ทศนิยมและร้อยละ", "ฝึกคิดทศนิยมและเปอร์เซ็นต์"),
        ("volume-data", "ปริมาตรและข้อมูล", "อ่านข้อมูลและหาปริมาตร"),
    ],
    6: [
        ("ratio-percent", "อัตราส่วนและร้อยละ", "ใช้สัดส่วนและร้อยละในโจทย์"),
        ("pre-algebra", "สมการเบื้องต้น", "เริ่มแก้สมการง่าย ๆ"),
        ("geometry-stat", "เรขาคณิตและสถิติ", "อ่านกราฟ วงกลม และข้อมูล"),
    ],
}


def _fallback_topic_question(grade_level: int, topic_code: str, topic_title: str, index: int) -> tuple[str, list[str], str, str, str]:
    base = grade_level * 10 + index
    if "subtract" in topic_code or "ลบ" in topic_title:
        answer = str(base - grade_level)
        return (
            f"{base} - {grade_level} = ?",
            [str(base - grade_level - 1), answer, str(base - grade_level + 1), str(base - grade_level + 2)],
            answer,
            f"{base} - {grade_level} = {answer}",
            f"ลองนับถอยหลัง {grade_level} ครั้ง",
        )
    if "multiplication" in topic_code or "multiply" in topic_code or "คูณ" in topic_title:
        answer = str(grade_level * index)
        return (
            f"{grade_level} x {index} = ?",
            [str(grade_level + index), answer, str(grade_level * index + 1), str(grade_level * index + 2)],
            answer,
            f"{grade_level} x {index} คือบวก {grade_level} ซ้ำ {index} ครั้ง",
            "ลองบวกซ้ำทีละกลุ่ม",
        )
    if "division" in topic_code or "หาร" in topic_title:
        answer = str(index)
        dividend = grade_level * index
        return (
            f"{dividend} ÷ {grade_level} = ?",
            [str(index - 1), answer, str(index + 1), str(index + 2)],
            answer,
            f"{dividend} แบ่งเป็นกลุ่มละ {grade_level} ได้ {index} กลุ่ม",
            "ลองแบ่งเป็นกลุ่มเท่า ๆ กัน",
        )
    if "time" in topic_code:
        answer = f"{index}:00"
        return (
            f"ถ้านาฬิกาเข็มสั้นชี้เลข {index} และเข็มยาวชี้เลข 12 คือเวลาใด?",
            [f"{index}:00", f"{index}:30", f"{index + 1}:00", f"{index}:15"],
            answer,
            "เข็มยาวชี้เลข 12 หมายถึงนาทีที่ 00",
            "ดูเข็มยาวก่อน",
        )
    if "money" in topic_code:
        answer = str(base - index)
        return (
            f"มีเงิน {base} บาท ซื้อของ {index} บาท เหลือเงินกี่บาท?",
            [str(base - index - 1), answer, str(base), str(index)],
            answer,
            f"เงินที่เหลือคือ {base} - {index} = {answer}",
            "ใช้การลบเพื่อหาเงินที่เหลือ",
        )
    answer = str(base + grade_level)
    return (
        f"{base} + {grade_level} = ?",
        [str(base + grade_level - 1), answer, str(base + grade_level + 1), str(base + grade_level + 2)],
        answer,
        f"{base} + {grade_level} = {answer}",
        "ลองนับเพิ่มทีละหนึ่ง",
    )


def _fallback_skill(db: Session, grade_level: int) -> Skill:
    subject = _subject(db)
    code = f"g{grade_level}-fallback-foundation"
    skill = db.scalar(select(Skill).where(Skill.code == code))
    if not skill:
        skill = Skill(
            subject_id=subject.id,
            grade_level=grade_level,
            code=code,
            name=f"พื้นฐานคณิตศาสตร์ ป.{grade_level}",
            description="คำถามสำรองสำหรับเทสพื้นฐาน",
            difficulty_order=999,
        )
        db.add(skill)
        db.flush()
    return skill


def _fallback_topic_skill(db: Session, grade_level: int, topic_code: str, title: str, description: str, order: int) -> Skill:
    subject = _subject(db)
    code = f"g{grade_level}-fallback-{topic_code}"
    skill = db.scalar(select(Skill).where(Skill.code == code))
    if not skill:
        skill = Skill(subject_id=subject.id, grade_level=grade_level, code=code, name=title, description=description, difficulty_order=800 + order)
        db.add(skill)
        db.flush()
    skill.grade_level = grade_level
    skill.name = title
    skill.description = description
    skill.difficulty_order = min(skill.difficulty_order or 999, 800 + order)
    return skill


def _ensure_fallback_lessons(db: Session, grade_level: int) -> None:
    for index, (topic_code, title, description) in enumerate(FALLBACK_TOPICS[grade_level], start=1):
        skill = _fallback_topic_skill(db, grade_level, topic_code, title, description, index)
        content_id = f"fallback-g{grade_level}-{topic_code}"
        lesson = db.scalar(select(Lesson).where(Lesson.content["content_id"].as_string() == content_id))
        if not lesson:
            lesson = Lesson(skill_id=skill.id, title=f"{title} ป.{grade_level}", content={})
            db.add(lesson)
        lesson.skill_id = skill.id
        lesson.title = f"{title} ป.{grade_level}"
        lesson.source = "fallback"
        lesson.status = "approved"
        lesson.content = {
            "content_id": content_id,
            "title_th": lesson.title,
            "description_th": description,
            "objective_th": f"เข้าใจเรื่อง{title}และลองทำโจทย์ได้ด้วยตัวเอง",
            "story_intro_th": f"วันนี้เราจะฝึกเรื่อง{title} ผ่านโจทย์สั้น ๆ ที่ค่อย ๆ ยากขึ้น",
            "explanation_steps": [f"ดูว่าโจทย์ถามเรื่อง{title}", "แยกข้อมูลสำคัญออกมา", "คิดทีละขั้นแล้วตรวจคำตอบ"],
            "worked_examples": [{"question_th": _fallback_topic_question(grade_level, topic_code, title, index)[0], "answer_th": _fallback_topic_question(grade_level, topic_code, title, index)[2]}],
            "common_mistakes": ["ลืมตรวจหน่วยหรืออ่านโจทย์ไม่ครบ", "รีบเลือกคำตอบก่อนคิดครบทุกขั้น"],
            "hints": [f"นึกถึงหลักของเรื่อง{title}", "ถ้าไม่แน่ใจ ลองเขียนข้อมูลออกมาเป็นข้อ ๆ"],
            "estimated_minutes": 5,
            "grade_level": grade_level,
            "topic_code": f"g{grade_level}_{topic_code}",
            "skill_code": skill.code,
            "quiz_id": f"fallback-g{grade_level}-{topic_code}-quiz",
        }
    db.flush()


def _ensure_topic_questions(db: Session, skill: Skill, topic_code: str, topic_title: str, count: int = 10) -> list[Question]:
    existing = db.scalars(
        select(Question).where(
            Question.skill_id == skill.id,
            Question.grade_level == skill.grade_level,
            Question.status == "approved",
            Question.source == "fallback",
        )
    ).all()
    if len(existing) >= count:
        return existing[:count]
    existing_markers = {(question.metadata_json or {}).get("fallback_id") for question in existing}
    for index in range(1, count + 1):
        marker = f"fallback-g{skill.grade_level}-{topic_code}-q{index}"
        if marker in existing_markers:
            continue
        text, choices, answer, explanation, hint = _fallback_topic_question(skill.grade_level, topic_code, topic_title, index)
        is_challenge = index % 5 == 0
        db.add(
            Question(
                skill_id=skill.id,
                grade_level=skill.grade_level,
                question_type="multiple_choice",
                difficulty="easy",
                question_text=text,
                choices=choices,
                correct_answer=answer,
                explanation=explanation,
                hint=hint,
                source="fallback",
                status="approved",
                metadata_json={
                    "fallback_id": marker,
                    "skill_code": skill.code,
                    "topic_code": f"g{skill.grade_level}_{topic_code}",
                    "question_type": "challenge" if is_challenge else "core",
                    "routine_level": "non_routine" if is_challenge else "routine",
                    "confidence_role": "stretch_thinking" if is_challenge else "build_confidence",
                },
            )
        )
    db.flush()
    return db.scalars(
        select(Question).where(
            Question.skill_id == skill.id,
            Question.grade_level == skill.grade_level,
            Question.status == "approved",
            Question.source == "fallback",
        )
    ).all()[:count]


def _ensure_fallback_grade_content(db: Session, grade_level: int) -> None:
    _ensure_fallback_lessons(db, grade_level)
    for index, (topic_code, title, description) in enumerate(FALLBACK_TOPICS[grade_level], start=1):
        skill = _fallback_topic_skill(db, grade_level, topic_code, title, description, index)
        _ensure_topic_questions(db, skill, topic_code, title, 10)


def _ensure_fallback_questions(db: Session, grade_level: int) -> list[Question]:
    _ensure_fallback_grade_content(db, grade_level)
    return db.scalars(
        select(Question).where(
            Question.grade_level == grade_level,
            Question.status == "approved",
            Question.source == "fallback",
        )
    ).all()


def _balanced_questions(questions: list[Question], limit: int) -> list[Question]:
    by_topic: dict[str, list[Question]] = {}
    for question in questions:
        metadata = question.metadata_json or {}
        topic = metadata.get("topic_code") or metadata.get("skill_code") or question.skill_id
        by_topic.setdefault(topic, []).append(question)
    for topic_questions in by_topic.values():
        random.shuffle(topic_questions)
    selected: list[Question] = []
    while len(selected) < limit and any(by_topic.values()):
        for topic in list(by_topic):
            if by_topic[topic] and len(selected) < limit:
                selected.append(by_topic[topic].pop())
    return selected


def _question_challenge_role(question: Question) -> str:
    metadata = question.metadata_json or {}
    question_type = str(metadata.get("question_type") or "").lower()
    routine_level = str(metadata.get("routine_level") or "").lower()
    confidence_role = str(metadata.get("confidence_role") or "").lower()
    if question_type == "challenge" or routine_level == "non_routine" or confidence_role == "stretch_thinking":
        return "challenge"
    return "core"


def _question_has_ratio_metadata(question: Question) -> bool:
    metadata = question.metadata_json or {}
    return any(metadata.get(key) for key in ("question_type", "routine_level", "confidence_role"))


def _ratio_counts(limit: int, *, challenge_requested: bool = False) -> tuple[int, int]:
    if limit < 5 and not challenge_requested:
        return limit, 0
    challenge_count = int((limit * 0.20) + 0.5)
    return limit - challenge_count, challenge_count


def _dedupe_questions(*groups: list[Question]) -> list[Question]:
    rows: dict[str, Question] = {}
    for group in groups:
        for question in group:
            rows.setdefault(question.id, question)
    return list(rows.values())


def _select_ratio_questions(
    primary: list[Question],
    limit: int,
    *,
    challenge_fallbacks: list[list[Question]] | None = None,
    fill_fallbacks: list[list[Question]] | None = None,
    context: str,
) -> list[Question]:
    core_target, challenge_target = _ratio_counts(limit)
    challenge_fallbacks = challenge_fallbacks or []
    fill_fallbacks = fill_fallbacks or []
    missing_metadata = sum(1 for question in _dedupe_questions(primary, *challenge_fallbacks, *fill_fallbacks) if not _question_has_ratio_metadata(question))
    if missing_metadata:
        logger.warning("%s question selection found %s questions missing ratio metadata; treating them as core", context, missing_metadata)

    selected: list[Question] = []
    selected_ids: set[str] = set()

    def append_unique(rows: list[Question], count: int) -> None:
        for question in rows:
            if len(selected) >= limit or count <= 0:
                return
            if question.id in selected_ids:
                continue
            selected.append(question)
            selected_ids.add(question.id)
            count -= 1

    primary_core = [question for question in primary if _question_challenge_role(question) == "core"]
    primary_challenge = [question for question in primary if _question_challenge_role(question) == "challenge"]

    challenge_pool = primary_challenge
    for fallback in challenge_fallbacks:
        challenge_pool = _dedupe_questions(challenge_pool, [question for question in fallback if _question_challenge_role(question) == "challenge"])
    challenge_selected = _balanced_questions(challenge_pool, challenge_target)
    append_unique(challenge_selected, challenge_target)
    if challenge_target and len([question for question in selected if _question_challenge_role(question) == "challenge"]) < challenge_target:
        logger.warning("%s question selection did not have enough challenge questions; filling remaining slots with core questions", context)

    core_selected = _balanced_questions(primary_core, core_target)
    append_unique(core_selected, core_target)

    fill_pool = _dedupe_questions(primary_core, primary_challenge, *fill_fallbacks, *challenge_fallbacks)
    append_unique(_balanced_questions(fill_pool, limit), limit - len(selected))
    random.shuffle(selected)
    return selected[:limit]


def _session_ratio_metadata(questions: list[Question]) -> dict:
    core_total = sum(1 for question in questions if _question_challenge_role(question) == "core")
    challenge_total = sum(1 for question in questions if _question_challenge_role(question) == "challenge")
    return {
        "core_question_count": core_total,
        "challenge_question_count": challenge_total,
        "ratio_policy": RATIO_POLICY,
    }


def _question_topic_code(question: Question) -> str | None:
    return (question.metadata_json or {}).get("topic_code")


def _question_skill_code(question: Question) -> str | None:
    return (question.metadata_json or {}).get("skill_code")


def _select_from_rotation_pool(
    db: Session,
    child: ChildProfile,
    pool: list[Question],
    count: int,
    *,
    role: str,
    rotation_key: str,
) -> tuple[list[Question], dict[str, int]]:
    if count <= 0 or not pool:
        return [], {}
    pool = _dedupe_questions(pool)
    pool_ids = {question.id for question in pool}
    histories = db.scalars(
        select(QuestionAttemptHistory).where(
            QuestionAttemptHistory.child_id == child.id,
            QuestionAttemptHistory.rotation_key == rotation_key,
            QuestionAttemptHistory.question_type == role,
        )
    ).all()
    current_cycle = max((history.cycle_number or 1 for history in histories), default=1)
    seen_current = {history.question_id for history in histories if (history.cycle_number or 1) == current_cycle and history.question_id in pool_ids}
    unseen = [question for question in pool if question.id not in seen_current]
    selected: list[Question] = []
    cycle_by_id: dict[str, int] = {}

    for question in _balanced_questions(unseen, min(count, len(unseen))):
        selected.append(question)
        cycle_by_id[question.id] = current_cycle
    remaining = count - len(selected)
    if remaining <= 0:
        return selected, cycle_by_id

    selected_ids = {question.id for question in selected}
    if seen_current | selected_ids >= pool_ids:
        next_cycle = current_cycle + 1
        next_pool = [question for question in pool if question.id not in selected_ids] or pool
        for question in _balanced_questions(next_pool, remaining):
            if question.id in selected_ids and len(pool) > len(selected_ids):
                continue
            selected.append(question)
            selected_ids.add(question.id)
            cycle_by_id[question.id] = next_cycle
            if len(selected) >= count:
                break
    if len(selected) < count:
        for question in _balanced_questions(pool, count):
            if len(selected) >= count:
                break
            selected.append(question)
            cycle_by_id.setdefault(question.id, current_cycle)
    return selected[:count], cycle_by_id


def _select_rotating_ratio_questions(
    db: Session,
    child: ChildProfile,
    primary: list[Question],
    limit: int,
    *,
    rotation_scope: str,
    rotation_key: str,
    lesson_id: str | None = None,
    challenge_fallbacks: list[list[Question]] | None = None,
    fill_fallbacks: list[list[Question]] | None = None,
    context: str,
) -> tuple[list[Question], dict]:
    core_target, challenge_target = _ratio_counts(limit)
    challenge_fallbacks = challenge_fallbacks or []
    fill_fallbacks = fill_fallbacks or []
    all_known = _dedupe_questions(primary, *challenge_fallbacks, *fill_fallbacks)
    missing_metadata = sum(1 for question in all_known if not _question_has_ratio_metadata(question))
    if missing_metadata:
        logger.warning("%s question selection found %s questions missing ratio metadata; treating them as core", context, missing_metadata)

    primary_core = [question for question in primary if _question_challenge_role(question) == "core"]
    primary_challenge = [question for question in primary if _question_challenge_role(question) == "challenge"]
    challenge_pool = primary_challenge
    for fallback in challenge_fallbacks:
        challenge_pool = _dedupe_questions(challenge_pool, [question for question in fallback if _question_challenge_role(question) == "challenge"])

    selected: list[Question] = []
    selected_ids: set[str] = set()
    cycle_by_id: dict[str, int] = {}

    challenge_selected, challenge_cycles = _select_from_rotation_pool(db, child, challenge_pool, challenge_target, role="challenge", rotation_key=rotation_key)
    for question in challenge_selected:
        if question.id not in selected_ids and len(selected) < limit:
            selected.append(question)
            selected_ids.add(question.id)
            cycle_by_id[question.id] = challenge_cycles.get(question.id, 1)
    if challenge_target and len(challenge_selected) < challenge_target:
        logger.warning("%s question selection did not have enough challenge questions; filling remaining slots with core questions", context)

    core_needed = core_target + max(0, challenge_target - len(challenge_selected))
    core_selected, core_cycles = _select_from_rotation_pool(db, child, primary_core, core_needed, role="core", rotation_key=rotation_key)
    for question in core_selected:
        if question.id not in selected_ids and len(selected) < limit:
            selected.append(question)
            selected_ids.add(question.id)
            cycle_by_id[question.id] = core_cycles.get(question.id, 1)

    if len(selected) < limit:
        fill_pool = _dedupe_questions(primary_core, primary_challenge, *fill_fallbacks, *challenge_fallbacks)
        for question in _balanced_questions(fill_pool, limit):
            if len(selected) >= limit:
                break
            if question.id in selected_ids:
                continue
            selected.append(question)
            selected_ids.add(question.id)
            cycle_by_id.setdefault(question.id, 1)

    random.shuffle(selected)
    metadata = _session_ratio_metadata(selected)
    metadata.update(
        {
            "rotation_scope": rotation_scope,
            "rotation_key": rotation_key,
            "rotation_cycle": min(cycle_by_id.values(), default=1),
            "rotation_cycles": cycle_by_id,
            "lesson_public_id": lesson_id,
        }
    )
    return selected[:limit], metadata


def _record_question_attempts(db: Session, child: ChildProfile, session: TestSession, questions: list[Question], answer_map: dict[str, str]) -> None:
    metadata = session.metadata_json or {}
    rotation_scope = metadata.get("rotation_scope") or "review"
    rotation_key = metadata.get("rotation_key") or session.quiz_id or session.id
    rotation_cycles = metadata.get("rotation_cycles") or {}
    lesson_public_id = metadata.get("lesson_public_id")
    now = datetime.utcnow()
    for question in questions:
        role = _question_challenge_role(question)
        cycle_number = int(rotation_cycles.get(question.id) or metadata.get("rotation_cycle") or 1)
        selected = str(answer_map.get(question.id, ""))
        is_correct = is_answer_correct(question, selected)
        row = db.scalar(
            select(QuestionAttemptHistory).where(
                QuestionAttemptHistory.child_id == child.id,
                QuestionAttemptHistory.question_id == question.id,
                QuestionAttemptHistory.rotation_key == rotation_key,
                QuestionAttemptHistory.question_type == role,
                QuestionAttemptHistory.cycle_number == cycle_number,
            )
        )
        if not row:
            row = QuestionAttemptHistory(
                child_id=child.id,
                question_id=question.id,
                lesson_id=lesson_public_id or session.lesson_id,
                grade_level=question.grade_level,
                topic_code=_question_topic_code(question),
                skill_code=_question_skill_code(question),
                question_type=role,
                rotation_scope=rotation_scope,
                rotation_key=rotation_key,
                cycle_number=cycle_number,
                first_seen_at=now,
                attempt_count=0,
            )
            db.add(row)
        row.last_attempted_at = now
        row.attempt_count = (row.attempt_count or 0) + 1
        row.last_is_correct = is_correct


def _select_foundation_questions(db: Session, grade_level: int, *, limit: int = 10) -> list[Question]:
    questions = db.scalars(select(Question).where(Question.grade_level == grade_level, Question.status == "approved")).all()
    if len(questions) < limit:
        questions = list({question.id: question for question in questions + _ensure_fallback_questions(db, grade_level)}.values())
    metadata_questions = [question for question in questions if (question.metadata_json or {}).get("topic_code") or (question.metadata_json or {}).get("skill_code")]
    return _select_ratio_questions(metadata_questions or questions, limit, fill_fallbacks=[questions], context=f"foundation-g{grade_level}")


def _ensure_lesson_questions(db: Session, lesson: Lesson, skill: Skill, count: int = 10) -> list[Question]:
    content = lesson.content or {}
    topic_code = str(content.get("topic_code") or skill.code)
    topic_title = str(content.get("title_th") or lesson.title or skill.name)
    existing = db.scalars(select(Question).where(Question.skill_id == skill.id, Question.grade_level == skill.grade_level, Question.status == "approved")).all()
    if len(existing) >= count:
        return existing
    fallback_topic = topic_code.removeprefix(f"g{skill.grade_level}_").replace("_", "-")
    return list({question.id: question for question in existing + _ensure_topic_questions(db, skill, fallback_topic, topic_title, count)}.values())


def _topic_matches(question: Question, topic_code: str | None, skill_code: str | None) -> bool:
    metadata = question.metadata_json or {}
    return bool(
        (topic_code and metadata.get("topic_code") == topic_code)
        or (skill_code and metadata.get("skill_code") == skill_code)
    )


def _select_lesson_test_questions(db: Session, lesson: Lesson, skill: Skill, limit: int = 10) -> list[Question]:
    content = lesson.content or {}
    topic_code = str(content.get("topic_code") or "")
    skill_code = str(content.get("skill_code") or skill.code)
    topic_title = str(content.get("title_th") or lesson.title or skill.name)
    grade_level = skill.grade_level

    grade_questions = db.scalars(select(Question).where(Question.grade_level == grade_level, Question.status == "approved")).all()
    exact = [question for question in grade_questions if question.skill_id == skill.id and _topic_matches(question, topic_code, skill_code)]
    if len(exact) >= limit:
        return _select_ratio_questions(exact, limit, challenge_fallbacks=[grade_questions], fill_fallbacks=[grade_questions], context=f"lesson-{topic_code or skill_code}")

    same_skill = [question for question in grade_questions if question.skill_id == skill.id]
    if len(same_skill) >= limit:
        return _select_ratio_questions(same_skill, limit, challenge_fallbacks=[grade_questions], fill_fallbacks=[grade_questions], context=f"lesson-{topic_code or skill_code}")

    same_topic = [question for question in grade_questions if _topic_matches(question, topic_code, skill_code)]
    if len(same_topic) >= limit:
        return _select_ratio_questions(same_topic, limit, challenge_fallbacks=[grade_questions], fill_fallbacks=[grade_questions], context=f"lesson-{topic_code or skill_code}")

    fallback_topic = (topic_code or skill_code).removeprefix(f"g{grade_level}_").replace("_", "-")
    fallback = _ensure_topic_questions(db, skill, fallback_topic, topic_title, limit)
    merged = list({question.id: question for question in exact + same_skill + same_topic + fallback}.values())
    if len(merged) >= limit:
        return _select_ratio_questions(merged, limit, challenge_fallbacks=[same_topic, grade_questions], fill_fallbacks=[grade_questions], context=f"lesson-{topic_code or skill_code}")

    grade_fallback = list({question.id: question for question in grade_questions + _ensure_fallback_questions(db, grade_level)}.values())
    return _select_ratio_questions(grade_fallback, limit, fill_fallbacks=[grade_fallback], context=f"lesson-{topic_code or skill_code}")


def _select_lesson_test_questions_rotating(db: Session, child: ChildProfile, lesson: Lesson, skill: Skill, limit: int = 10) -> tuple[list[Question], dict]:
    content = lesson.content or {}
    topic_code = str(content.get("topic_code") or "")
    skill_code = str(content.get("skill_code") or skill.code)
    topic_title = str(content.get("title_th") or lesson.title or skill.name)
    grade_level = skill.grade_level
    public_id = _lesson_public_id(lesson)
    rotation_key = f"lesson:{public_id}"

    grade_questions = db.scalars(select(Question).where(Question.grade_level == grade_level, Question.status == "approved")).all()
    exact = [question for question in grade_questions if question.skill_id == skill.id and _topic_matches(question, topic_code, skill_code)]
    if len(exact) >= limit:
        return _select_rotating_ratio_questions(
            db,
            child,
            exact,
            limit,
            rotation_scope="lesson",
            rotation_key=rotation_key,
            lesson_id=public_id,
            challenge_fallbacks=[grade_questions],
            fill_fallbacks=[grade_questions],
            context=f"lesson-{topic_code or skill_code}",
        )

    same_skill = [question for question in grade_questions if question.skill_id == skill.id]
    if len(same_skill) >= limit:
        return _select_rotating_ratio_questions(
            db,
            child,
            same_skill,
            limit,
            rotation_scope="lesson",
            rotation_key=rotation_key,
            lesson_id=public_id,
            challenge_fallbacks=[grade_questions],
            fill_fallbacks=[grade_questions],
            context=f"lesson-{topic_code or skill_code}",
        )

    same_topic = [question for question in grade_questions if _topic_matches(question, topic_code, skill_code)]
    if len(same_topic) >= limit:
        return _select_rotating_ratio_questions(
            db,
            child,
            same_topic,
            limit,
            rotation_scope="lesson",
            rotation_key=rotation_key,
            lesson_id=public_id,
            challenge_fallbacks=[grade_questions],
            fill_fallbacks=[grade_questions],
            context=f"lesson-{topic_code or skill_code}",
        )

    fallback_topic = (topic_code or skill_code).removeprefix(f"g{grade_level}_").replace("_", "-")
    fallback = _ensure_topic_questions(db, skill, fallback_topic, topic_title, limit)
    merged = list({question.id: question for question in exact + same_skill + same_topic + fallback}.values())
    if len(merged) >= limit:
        return _select_rotating_ratio_questions(
            db,
            child,
            merged,
            limit,
            rotation_scope="lesson",
            rotation_key=rotation_key,
            lesson_id=public_id,
            challenge_fallbacks=[same_topic, grade_questions],
            fill_fallbacks=[grade_questions],
            context=f"lesson-{topic_code or skill_code}",
        )

    grade_fallback = list({question.id: question for question in grade_questions + _ensure_fallback_questions(db, grade_level)}.values())
    return _select_rotating_ratio_questions(
        db,
        child,
        grade_fallback,
        limit,
        rotation_scope="lesson",
        rotation_key=rotation_key,
        lesson_id=public_id,
        fill_fallbacks=[grade_fallback],
        context=f"lesson-{topic_code or skill_code}",
    )


def _mark_lesson_question_metadata(questions: list[Question], lesson: Lesson, skill: Skill) -> None:
    content = lesson.content or {}
    topic_code = str(content.get("topic_code") or skill.code)
    for question in questions:
        if question.skill_id != skill.id:
            continue
        metadata = dict(question.metadata_json or {})
        metadata["skill_code"] = skill.code
        metadata["topic_code"] = topic_code
        question.metadata_json = metadata


def _select_questions(db: Session, grade_level: int, *, skill_id: str | None = None, limit: int = 10) -> list[Question]:
    query = select(Question).where(Question.grade_level == grade_level, Question.status == "approved")
    if skill_id:
        query = query.where(Question.skill_id == skill_id)
    questions = db.scalars(query).all()
    if len(questions) < limit and not skill_id:
        questions = list({question.id: question for question in questions + _ensure_fallback_questions(db, grade_level)}.values())
    return _select_ratio_questions(questions, limit, fill_fallbacks=[questions], context=f"grade-g{grade_level}")


def _session_questions(db: Session, session: TestSession) -> list[Question]:
    questions = db.scalars(select(Question).where(Question.id.in_(session.question_ids))).all()
    by_id = {question.id: question for question in questions}
    return [by_id[question_id] for question_id in session.question_ids if question_id in by_id]


def _foundation_test(child: ChildProfile) -> dict:
    grade = recommended_foundation_grade(child.grade_level)
    locked = not is_paid(child) and remaining_free_tests(child) <= 0
    return {
        "recommended_grade": grade,
        "recommended_grade_level": grade,
        "title_th": f"เทสพื้นฐาน ป.{grade}",
        "description_th": f"แนะนำให้ทำเทสพื้นฐาน ป.{grade} เพื่อดูว่ามีจุดไหนที่ควรทบทวน",
        "is_required": True,
        "is_locked": locked,
        "reason_th": "ใช้สิทธิ์เทสฟรีครบแล้ว กรุณาอัปเกรดเพื่อทำเทสเพิ่มเติม" if locked else "ใช้ฟรีได้ 5 ครั้งสำหรับเทสที่ระบบแนะนำ",
    }


def _test_level_items(child: ChildProfile) -> list[dict]:
    recommended = recommended_foundation_grade(child.grade_level)
    paid = is_paid(child)
    no_free_tests = not paid and remaining_free_tests(child) <= 0
    items = []
    for grade in range(1, 7):
        locked = not paid and (grade != recommended or no_free_tests)
        lock_reason = None
        if locked:
            lock_reason = "ใช้สิทธิ์เทสฟรีครบแล้ว กรุณาอัปเกรดเพื่อทำเทสเพิ่มเติม" if no_free_tests else "สมาชิกฟรีทำได้เฉพาะเทสที่ระบบแนะนำ"
        items.append(
            {
                "grade": grade,
                "grade_level": grade,
                "title_th": f"แบบทดสอบ ป.{grade}",
                "title": f"คณิตศาสตร์ ป.{grade}",
                "status": "locked" if locked else "unlocked",
                "is_locked": locked,
                "lock_reason": lock_reason,
                "questions_count": 10,
                "estimated_minutes": 15,
            }
        )
    return items


def _lesson_item(lesson: Lesson, skill: Skill, child: ChildProfile, current_index: int | None) -> dict:
    content = lesson.content or {}
    public_id = _lesson_public_id(lesson)
    paid = can_access_program(child, content.get("program_type") or content.get("content_program_type") or "TH")
    is_review = skill.grade_level < child.grade_level
    is_free = is_review or current_index == 0
    is_locked = not paid and not is_free
    return {
        "lesson_id": public_id,
        "id": public_id,
        "db_lesson_id": lesson.id,
        "title_th": content.get("title_th") or lesson.title,
        "title_en": content.get("title_en"),
        "program_type": lesson_program_alias(content),
        "description_th": content.get("description_th") or content.get("summary") or content.get("intro") or skill.description,
        "title": lesson.title,
        "grade_level": skill.grade_level,
        "topic_code": content.get("topic_code") or skill.code,
        "skill_code": skill.code,
        "estimated_minutes": content.get("estimated_minutes", 5),
        "is_free": is_free,
        "is_locked": is_locked,
        "lock_reason": "สมาชิกฟรีเรียนได้เฉพาะบทเรียนแรก" if is_locked else None,
        "has_test": True,
        "is_review": is_review,
        "access_type": "review" if is_review else "current",
        "status": "locked" if is_locked else "available",
        "content_preview": content.get("summary") or content.get("intro"),
        "linked_quiz_id": content.get("quiz_id"),
    }


def _dashboard_lessons(db: Session, child: ChildProfile) -> dict:
    json_sections = _json_lesson_sections(child)
    if json_sections:
        return json_sections

    for grade in range(max(1, child.grade_level - 1), child.grade_level + 1):
        has_grade_lessons = db.scalar(
            select(Lesson)
            .join(Skill, Lesson.skill_id == Skill.id)
            .where(Lesson.status == "approved", Skill.grade_level == grade)
            .limit(1)
        )
        if not has_grade_lessons:
            _ensure_fallback_lessons(db, grade)
    rows = db.execute(
        select(Lesson, Skill)
        .join(Skill, Lesson.skill_id == Skill.id)
        .where(Lesson.status == "approved", Skill.grade_level <= child.grade_level)
        .order_by(Skill.grade_level, Skill.difficulty_order, Lesson.title)
    ).all()
    current_count = 0
    items = []
    for lesson, skill in rows:
        if not _db_lesson_visible_for_child(lesson, child):
            continue
        current_index = None
        if skill.grade_level == child.grade_level:
            current_index = current_count
            current_count += 1
        items.append(_lesson_item(lesson, skill, child, current_index))
    return {
        "free_lessons": [item for item in items if item["is_free"]],
        "locked_lessons": [item for item in items if item["is_locked"]],
        "current_grade_lessons": [item for item in items if item["grade_level"] == child.grade_level],
        "review_lessons": [item for item in items if item["grade_level"] < child.grade_level],
    }


def _lesson_access_item(db: Session, child: ChildProfile, lesson_id: str) -> dict:
    sections = _dashboard_lessons(db, child)
    lesson_items = sections["review_lessons"] + sections["current_grade_lessons"] + sections["locked_lessons"]
    item = next((row for row in lesson_items if row["lesson_id"] == lesson_id or row.get("db_lesson_id") == lesson_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return item


def _lesson_content_payload(lesson: Lesson, item: dict, variant: dict | None = None) -> dict:
    content = lesson.content or {}
    public_id = _lesson_public_id(lesson)
    return _with_variant_payload({
        "lesson_id": public_id,
        "id": public_id,
        "db_lesson_id": lesson.id,
        "program_type": lesson_program_type(content),
        "title_th": content.get("title_th") or lesson.title,
        "title_en": content.get("title_en") or "",
        "objective_th": content.get("objective_th") or content.get("objective") or content.get("summary") or "",
        "objective_en": content.get("objective_en") or "",
        "thai_support": content.get("thai_support") or "",
        "vocabulary": content.get("vocabulary") or [],
        "explanation_en": content.get("explanation_en") or "",
        "explanation_th": content.get("explanation_th") or "",
        "story_intro_th": content.get("story_intro_th") or content.get("intro") or content.get("description_th") or "",
        "explanation_steps": content.get("explanation_steps") or content.get("steps") or [],
        "worked_examples": content.get("worked_examples") or content.get("examples") or [],
        "common_mistakes": content.get("common_mistakes") or [],
        "hints": content.get("hints") or ([content["hint"]] if content.get("hint") else []),
        "estimated_minutes": item["estimated_minutes"],
        "has_test": item["has_test"],
        "is_locked": item["is_locked"],
        "lock_reason": item["lock_reason"],
        "topic_code": item["topic_code"],
        "skill_code": item["skill_code"],
        "grade_level": item["grade_level"],
    }, variant)


def _db_lesson_detail_item(db: Session, lesson: Lesson, child: ChildProfile, lesson_id: str) -> dict:
    try:
        item = _lesson_access_item(db, child, lesson_id)
    except HTTPException:
        skill = db.get(Skill, lesson.skill_id)
        content = lesson.content or {}
        public_id = _lesson_public_id(lesson)
        item = {
            "lesson_id": public_id,
            "id": public_id,
            "title_th": content.get("title_th") or lesson.title,
            "estimated_minutes": content.get("estimated_minutes", 5),
            "has_test": True,
            "is_locked": False,
            "lock_reason": None,
            "topic_code": content.get("topic_code") or (skill.code if skill else public_id),
            "skill_code": content.get("skill_code") or (skill.code if skill else public_id),
            "grade_level": int(content.get("grade_level") or (skill.grade_level if skill else child.grade_level)),
        }
    item["is_locked"] = False
    item["lock_reason"] = None
    return item


def _recommendations(db: Session, child: ChildProfile) -> list[dict]:
    rows = db.execute(
        select(SkillMastery, Skill)
        .join(Skill, SkillMastery.skill_id == Skill.id)
        .where(SkillMastery.child_profile_id == child.id, SkillMastery.mastery_score < 60)
        .order_by(SkillMastery.mastery_score)
    ).all()
    return [
        {
            "skill_id": skill.id,
            "skill_code": skill.code,
            "title_th": f"ทบทวน {skill.name}",
            "reason_th": "พบจุดที่ควรฝึกเพิ่มจากผลทดสอบ",
            "mastery_score": float(mastery.mastery_score or 0),
        }
        for mastery, skill in rows[:5]
    ]


FALLBACK_QUESTS = {
    "daily": [
        ("check-in", "เช็กชื่อในระบบ", "เช็กชื่อในระบบ 0/1", "check_in", 1, 50, 10),
        ("lesson", "เข้าเรียนเนื้อหา", "เข้าเรียนเนื้อหา 0/1 เรื่อง", "lesson_complete", 1, 50, 10),
        ("test-50", "ทำเทส ตอบถูกเกิน 50%", "ทำเทส ตอบถูกเกิน 50% 0/1 เทส", "test_50", 1, 50, 10),
    ],
    "weekly": [
        ("check-in-2", "เช็กชื่อ", "เช็กชื่อ 0/2", "check_in", 2, 50, 10),
        ("check-in-4", "เช็กชื่อ", "เช็กชื่อ 0/4", "check_in", 4, 50, 10),
        ("check-in-6", "เช็กชื่อ", "เช็กชื่อ 0/6", "check_in", 6, 50, 10),
        ("lesson-3", "เรียนบทเรียน", "เรียนบทเรียน 0/3", "lesson_complete", 3, 50, 10),
        ("lesson-4", "เรียนบทเรียน", "เรียนบทเรียน 0/4", "lesson_complete", 4, 50, 10),
        ("lesson-5", "เรียนบทเรียน", "เรียนบทเรียน 0/5", "lesson_complete", 5, 50, 10),
        ("friend-3", "เพิ่มเพื่อน", "เพิ่มเพื่อน 0/3", "friend_add", 3, 50, 10),
        ("test-50-5", "ทำเทส ตอบถูกเกิน 50%", "ทำเทส ตอบถูกเกิน 50% 0/5 เทส", "test_50", 5, 50, 10),
        ("test-50-10", "ทำเทส ตอบถูกเกิน 50%", "ทำเทส ตอบถูกเกิน 50% 0/10 เทส", "test_50", 10, 50, 10),
        ("test-100-1", "ทำเทส ตอบถูก 100%", "ทำเทส ตอบถูก 100% 0/1 เทส", "test_100", 1, 50, 10),
        ("test-100-3", "ทำเทส ตอบถูก 100%", "ทำเทส ตอบถูก 100% 0/3 เทส", "test_100", 3, 50, 10),
    ],
    "monthly": [
        ("check-in-10", "เช็กชื่อ", "เช็กชื่อ 0/10", "check_in", 10, 50, 10),
        ("check-in-20", "เช็กชื่อ", "เช็กชื่อ 0/20", "check_in", 20, 50, 10),
        ("check-in-28", "เช็กชื่อ", "เช็กชื่อ 0/28", "check_in", 28, 50, 10),
        ("lesson-10", "เรียนบทเรียน", "เรียนบทเรียน 0/10", "lesson_complete", 10, 50, 10),
        ("friend-10", "เพิ่มเพื่อน", "เพิ่มเพื่อน 0/10", "friend_add", 10, 50, 10),
        ("test-50-10", "ทำเทส ตอบถูกเกิน 50%", "ทำเทส ตอบถูกเกิน 50% 0/10 เทส", "test_50", 10, 50, 10),
        ("test-50-20", "ทำเทส ตอบถูกเกิน 50%", "ทำเทส ตอบถูกเกิน 50% 0/20 เทส", "test_50", 20, 50, 10),
        ("test-100-5", "ทำเทส ตอบถูก 100%", "ทำเทส ตอบถูก 100% 0/5 เทส", "test_100", 5, 50, 10),
        ("test-100-10", "ทำเทส ตอบถูก 100%", "ทำเทส ตอบถูก 100% 0/10 เทส", "test_100", 10, 50, 10),
    ],
}


FIXED_QUESTS = {
    "daily": [
        ("check-in", "เช็กชื่อในระบบ", "เข้าใช้งานระบบวันนี้", "check_in", 1, 1),
        ("lesson", "เข้าเรียนเนื้อหา", "เข้าเรียนเนื้อหา 1 เรื่อง", "lesson", 1, 1),
        ("test-50", "ทำเทส ตอบถูกเกิน 50%", "ทำเทสและตอบถูกอย่างน้อย 50%", "test_50", 1, 1),
    ],
    "weekly": [
        ("check-in-2", "เช็กชื่อ", "เช็กชื่อให้ครบ 2 ครั้ง", "check_in", 2, 3),
        ("check-in-4", "เช็กชื่อ", "เช็กชื่อให้ครบ 4 ครั้ง", "check_in", 4, 3),
        ("check-in-6", "เช็กชื่อ", "เช็กชื่อให้ครบ 6 ครั้ง", "check_in", 6, 3),
        ("lesson-3", "เรียนบทเรียน", "เรียนบทเรียนให้ครบ 3 เรื่อง", "lesson", 3, 3),
        ("lesson-4", "เรียนบทเรียน", "เรียนบทเรียนให้ครบ 4 เรื่อง", "lesson", 4, 3),
        ("lesson-5", "เรียนบทเรียน", "เรียนบทเรียนให้ครบ 5 เรื่อง", "lesson", 5, 3),
        ("friend-3", "เพิ่มเพื่อน", "เพิ่มเพื่อนเพื่อทำภารกิจนี้", "friend", 3, 3),
        ("test-50-5", "ทำเทส ตอบถูกเกิน 50%", "ทำเทสตอบถูกเกิน 50% ให้ครบ 5 เทส", "test_50", 5, 3),
        ("test-50-10", "ทำเทส ตอบถูกเกิน 50%", "ทำเทสตอบถูกเกิน 50% ให้ครบ 10 เทส", "test_50", 10, 3),
        ("test-100-1", "ทำเทส ตอบถูก 100%", "ทำเทสตอบถูก 100% ให้ครบ 1 เทส", "test_100", 1, 3),
        ("test-100-3", "ทำเทส ตอบถูก 100%", "ทำเทสตอบถูก 100% ให้ครบ 3 เทส", "test_100", 3, 3),
    ],
    "monthly": [
        ("check-in-10", "เช็กชื่อ", "เช็กชื่อให้ครบ 10 ครั้ง", "check_in", 10, 7),
        ("check-in-20", "เช็กชื่อ", "เช็กชื่อให้ครบ 20 ครั้ง", "check_in", 20, 7),
        ("check-in-28", "เช็กชื่อ", "เช็กชื่อให้ครบ 28 ครั้ง", "check_in", 28, 7),
        ("lesson-10", "เรียนบทเรียน", "เรียนบทเรียนให้ครบ 10 เรื่อง", "lesson", 10, 7),
        ("friend-10", "เพิ่มเพื่อน", "เพิ่มเพื่อนเพื่อทำภารกิจนี้", "friend", 10, 7),
        ("test-50-10", "ทำเทส ตอบถูกเกิน 50%", "ทำเทสตอบถูกเกิน 50% ให้ครบ 10 เทส", "test_50", 10, 7),
        ("test-50-20", "ทำเทส ตอบถูกเกิน 50%", "ทำเทสตอบถูกเกิน 50% ให้ครบ 20 เทส", "test_50", 20, 7),
        ("test-100-5", "ทำเทส ตอบถูก 100%", "ทำเทสตอบถูก 100% ให้ครบ 5 เทส", "test_100", 5, 7),
        ("test-100-10", "ทำเทส ตอบถูก 100%", "ทำเทสตอบถูก 100% ให้ครบ 10 เทส", "test_100", 10, 7),
    ],
}


def _thai_now() -> datetime:
    return datetime.now(THAILAND_TZ)


def _period_window(period: str, now: datetime | None = None) -> tuple[str, datetime, datetime, datetime]:
    now = now or _thai_now()
    today = now.date()
    if period == "daily":
        start_date = today
        end_date = today + timedelta(days=1)
        key = start_date.isoformat()
    elif period == "weekly":
        start_date = today - timedelta(days=today.weekday())
        end_date = start_date + timedelta(days=7)
        iso_year, iso_week, _ = today.isocalendar()
        key = f"{iso_year}-W{iso_week:02d}"
    else:
        start_date = today.replace(day=1)
        end_date = date(today.year + (1 if today.month == 12 else 0), 1 if today.month == 12 else today.month + 1, 1)
        key = start_date.strftime("%Y-%m")
    start = datetime.combine(start_date, time.min, tzinfo=THAILAND_TZ)
    end = datetime.combine(end_date, time.min, tzinfo=THAILAND_TZ)
    reset_at = end if period != "weekly" else end - timedelta(minutes=1)
    start_utc = start.astimezone(UTC).replace(tzinfo=None)
    end_utc = end.astimezone(UTC).replace(tzinfo=None)
    return key, start_utc, end_utc, reset_at


def _fixed_quest_id(period: str, slug: str) -> str:
    return f"{period}-{slug}"


def _fixed_quest_template(db: Session, child: ChildProfile, period: str, slug: str, title: str, description: str, metric: str, target: int, reward: int) -> LearningQuest:
    quest_id = _fixed_quest_id(period, slug)
    quest = db.scalar(select(LearningQuest).where(LearningQuest.quest_id == quest_id))
    if not quest:
        quest = LearningQuest(
            quest_id=quest_id,
            grade_level=child.grade_level,
            title=title,
            recurrence_type=period,
            xp_reward=reward,
            coin_reward=0,
            status="active",
        )
        db.add(quest)
        db.flush()
    quest.grade_level = child.grade_level
    quest.skill_code = None
    quest.title = title
    quest.description = description
    quest.quest_type = metric
    quest.recurrence_type = period
    quest.xp_reward = reward
    quest.coin_reward = 0
    quest.estimated_minutes = None
    quest.status = "active"
    quest.lesson_id = None
    quest.quiz_id = None
    quest.metadata_json = {"metric_type": metric, "target_count": target, "score_reward": 0, "fixed": True}
    return quest


def _claim_row(db: Session, child: ChildProfile, quest: LearningQuest, period_key: str, target: int) -> ChildQuest | None:
    return db.scalar(
        select(ChildQuest).where(
            ChildQuest.child_profile_id == child.id,
            ChildQuest.quest_id == quest.id,
            ChildQuest.period_key == period_key,
        )
    )


def _count_check_ins(db: Session, child: ChildProfile, start: datetime, end: datetime) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(CheckInEvent)
            .where(
                CheckInEvent.child_profile_id == child.id,
                CheckInEvent.created_at >= start,
                CheckInEvent.created_at < end,
            )
        )
        or 0
    )


def _count_lessons(db: Session, child: ChildProfile, start: datetime, end: datetime) -> int:
    return int(
        db.scalar(
            select(func.count(func.distinct(LessonActivity.lesson_id)))
            .where(
                LessonActivity.child_profile_id == child.id,
                LessonActivity.created_at >= start,
                LessonActivity.created_at < end,
            )
        )
        or 0
    )


def _count_tests(db: Session, child: ChildProfile, start: datetime, end: datetime, *, perfect: bool = False) -> int:
    query = select(func.count()).select_from(TestResult).where(
        TestResult.child_profile_id == child.id,
        TestResult.created_at >= start,
        TestResult.created_at < end,
    )
    query = query.where(TestResult.accuracy >= 100 if perfect else TestResult.accuracy >= 50)
    return int(db.scalar(query) or 0)


def _metric_progress(db: Session, child: ChildProfile, metric: str, start: datetime, end: datetime) -> int:
    if metric == "check_in":
        return _count_check_ins(db, child, start, end)
    if metric == "lesson":
        return _count_lessons(db, child, start, end)
    if metric == "test_50":
        return _count_tests(db, child, start, end)
    if metric == "test_100":
        return _count_tests(db, child, start, end, perfect=True)
    return 0


def _fixed_quest_payload(db: Session, child: ChildProfile, period: str, spec: tuple[str, str, str, str, int, int]) -> dict:
    slug, title, description, metric, target, reward = spec
    period_key, start, end, reset_at = _period_window(period)
    quest = _fixed_quest_template(db, child, period, slug, title, description, metric, target, reward)
    claim = _claim_row(db, child, quest, period_key, target)
    progress_current = min(_metric_progress(db, child, metric, start, end), target)
    progress_percent = round((progress_current / target) * 100, 2) if target else 0
    claimed = bool(claim and claim.status == "completed")
    status = "claimed" if claimed else ("claimable" if progress_current >= target else "active")
    return {
        "quest_id": quest.quest_id,
        "id": quest.quest_id,
        "title": title,
        "title_th": title,
        "description": description,
        "description_th": description,
        "quest_period": period,
        "recurrence_type": period,
        "quest_type": metric,
        "metric_type": metric,
        "grade_level": child.grade_level,
        "skill_code": None,
        "progress_current": progress_current,
        "progress_total": target,
        "progress_target": target,
        "progress_percent": progress_percent,
        "exp_reward": reward,
        "xp_reward": reward,
        "coin_reward": 0,
        "score_reward": 0,
        "status": status,
        "child_status": status,
        "can_claim_reward": status == "claimable",
        "claimed_at": claim.completed_at.isoformat() if claimed and claim.completed_at else None,
        "reset_at": reset_at.isoformat(),
        "estimated_minutes": None,
        "lesson_id": None,
        "quiz_id": None,
    }


def _fixed_quests(db: Session, child: ChildProfile, period: str) -> list[dict]:
    items = [_fixed_quest_payload(db, child, period, spec) for spec in FIXED_QUESTS[period]]
    db.commit()
    return items


def _ensure_fallback_quests(db: Session, grade_level: int, recurrence_type: str) -> None:
    if db.scalar(
        select(LearningQuest)
        .where(
            LearningQuest.grade_level == grade_level,
            LearningQuest.recurrence_type == recurrence_type,
            LearningQuest.status == "active",
        )
        .limit(1)
    ):
        return
    for slug, title, description, action_type, target, xp_reward, coin_reward in FALLBACK_QUESTS[recurrence_type]:
        quest = LearningQuest(
            quest_id=f"{recurrence_type}-g{grade_level}-{slug}",
            grade_level=grade_level,
            skill_code=None,
            title=title,
            description=description,
            quest_type=action_type,
            recurrence_type=recurrence_type,
            xp_reward=xp_reward,
            coin_reward=coin_reward,
            estimated_minutes=3,
            status="active",
            lesson_id=None,
            quiz_id=None,
            metadata_json={"action_type": action_type, "target_count": target, "score_reward": xp_reward},
        )
        db.add(quest)
    db.flush()


def _quest_out(quest: LearningQuest, child_quest: ChildQuest | None = None) -> QuestOut:
    progress_current = child_quest.progress_current if child_quest else 0
    progress_total = child_quest.progress_target if child_quest else quest_target(quest)
    progress_percent = round((progress_current / progress_total) * 100, 2) if progress_total else 0
    child_status = child_quest.status if child_quest else "not_started"
    return QuestOut(
        id=quest.id,
        quest_id=quest.quest_id,
        grade_level=quest.grade_level,
        skill_code=quest.skill_code,
        title=quest.title,
        title_th=quest.title,
        description=quest.description,
        description_th=quest.description,
        quest_type=quest.quest_type,
        recurrence_type=quest.recurrence_type,
        xp_reward=quest.xp_reward,
        coin_reward=quest.coin_reward,
        estimated_minutes=quest.estimated_minutes,
        status="completed" if child_status == "completed" else "available",
        lesson_id=quest.lesson_id,
        quiz_id=quest.quiz_id,
        child_status=child_status,
        progress_current=progress_current,
        progress_target=progress_total,
        progress_total=progress_total,
        progress_percent=progress_percent,
        score_reward=int((quest.metadata_json or {}).get("score_reward", quest.xp_reward)),
        can_claim_reward=progress_current >= progress_total and child_status != "completed",
    )


def _quests(db: Session, child: ChildProfile, recurrence_type: str) -> list[QuestOut]:
    _ensure_fallback_quests(db, child.grade_level, recurrence_type)
    quests = db.scalars(
        select(LearningQuest).where(
            LearningQuest.grade_level == child.grade_level,
            LearningQuest.recurrence_type == recurrence_type,
            LearningQuest.status == "active",
        )
    ).all()
    output = []
    for quest in quests:
        output.append(_quest_out(quest, get_or_create_child_quest(db, child, quest)))
    db.commit()
    return output


def _lesson_out(lesson: Lesson, child: ChildProfile) -> LessonOut:
    content = lesson.content or {}
    return LessonOut(
        id=lesson.id,
        title=lesson.title,
        grade_level=int(content.get("grade_level", 0)),
        skill_code=str(content.get("skill_code", "")),
        is_review=bool(content.get("is_review", False)),
        is_locked=bool(content.get("is_locked", False)),
        access_type=str(content.get("access_type", "locked")),
        content_preview=content.get("summary") or content.get("intro"),
        linked_quiz_id=content.get("quiz_id"),
    )


def _lessons(db: Session, child: ChildProfile, *, review_only: bool = False, recommended_only: bool = False) -> list[LessonOut]:
    rows = db.execute(select(Lesson, Skill).join(Skill, Lesson.skill_id == Skill.id).where(Lesson.status == "approved")).all()
    lessons: list[LessonOut] = []
    for lesson, skill in rows:
        if not _db_lesson_visible_for_child(lesson, child):
            continue
        is_review = skill.grade_level < child.grade_level
        is_current = skill.grade_level == child.grade_level
        if not (is_review or is_current):
            continue
        if review_only and not is_review:
            continue
        is_locked = child.membership_status != "paid" and not is_review
        content = dict(lesson.content or {})
        content.update(
            {
                "grade_level": skill.grade_level,
                "skill_code": skill.code,
                "is_review": is_review,
                "is_locked": is_locked,
                "access_type": "review" if is_review else "current",
                "quiz_id": content.get("quiz_id"),
            }
        )
        shadow = Lesson(id=lesson.id, skill_id=lesson.skill_id, title=lesson.title, content=content, source=lesson.source, status=lesson.status)
        lessons.append(_lesson_out(shadow, child))
    if recommended_only:
        lessons = [lesson for lesson in lessons if not lesson.is_locked][:3]
    return lessons


@router.get("/profile", response_model=ChildOut)
def profile(db: Session = Depends(get_db), user: User = Depends(current_user)) -> ChildOut:
    child = _profile(db, user)
    refresh_rank(child)
    return child_to_out(child)


@router.patch("/profile", response_model=ChildOut)
def update_profile(payload: ChildUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)) -> ChildOut:
    child = _profile(db, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(child, field, value)
    refresh_rank(child)
    db.commit()
    db.refresh(child)
    return child_to_out(child)


@router.get("/avatar")
def avatar(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    return {"avatar_gender": child.avatar_gender, "avatar_config": child.avatar_config or {}}


@router.patch("/avatar")
def update_avatar(payload: ChildUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    if payload.avatar_gender is not None:
        child.avatar_gender = payload.avatar_gender
    if payload.avatar_config is not None:
        child.avatar_config = payload.avatar_config
    db.commit()
    return {"avatar_gender": child.avatar_gender, "avatar_config": child.avatar_config or {}}


@router.get("/quests/daily")
def daily_quests(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[dict]:
    return _fixed_quests(db, _profile(db, user), "daily")


@router.get("/quests/weekly")
def weekly_quests(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[dict]:
    return _fixed_quests(db, _profile(db, user), "weekly")


@router.get("/quests/monthly")
def monthly_quests(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[dict]:
    return _fixed_quests(db, _profile(db, user), "monthly")


@router.post("/quests/{quest_id}/start", response_model=QuestActionOut)
def start_quest(quest_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> QuestActionOut:
    child = _profile(db, user)
    quest = db.scalar(select(LearningQuest).where(LearningQuest.quest_id == quest_id, LearningQuest.grade_level == child.grade_level))
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    child_quest = get_or_create_child_quest(db, child, quest)
    if child_quest.status == "not_started":
        child_quest.status = "in_progress"
        child_quest.started_at = datetime.utcnow()
    db.commit()
    return QuestActionOut(quest=_quest_out(quest, child_quest), total_xp=child.total_xp, total_score=child.total_score, coins=child.coins, current_level=child.current_level)


@router.post("/quests/{quest_id}/complete", response_model=QuestActionOut)
def complete_quest(quest_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> QuestActionOut:
    child = _profile(db, user)
    quest = db.scalar(select(LearningQuest).where(LearningQuest.quest_id == quest_id, LearningQuest.grade_level == child.grade_level))
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    child_quest = complete_child_quest(db, child, quest)
    db.commit()
    db.refresh(child)
    return QuestActionOut(quest=_quest_out(quest, child_quest), total_xp=child.total_xp, total_score=child.total_score, coins=child.coins, current_level=child.current_level)


@router.post("/quests/{quest_id}/claim")
def claim_quest(quest_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    match: tuple[str, tuple[str, str, str, str, int, int]] | None = None
    for period, specs in FIXED_QUESTS.items():
        for spec in specs:
            if _fixed_quest_id(period, spec[0]) == quest_id:
                match = (period, spec)
                break
        if match:
            break
    if not match:
        raise HTTPException(status_code=404, detail="ไม่พบเควสนี้")
    period, spec = match
    payload = _fixed_quest_payload(db, child, period, spec)
    if payload["status"] == "claimed":
        raise HTTPException(status_code=409, detail="รับรางวัลเควสนี้แล้ว")
    if payload["status"] != "claimable":
        raise HTTPException(status_code=400, detail="ยังทำเควสไม่สำเร็จ")

    slug, title, description, metric, target, reward = spec
    period_key, _, _, _ = _period_window(period)
    quest = _fixed_quest_template(db, child, period, slug, title, description, metric, target, reward)
    claim = _claim_row(db, child, quest, period_key, target)
    if not claim:
        claim = ChildQuest(
            child_profile_id=child.id,
            quest_id=quest.id,
            recurrence_type=period,
            period_key=period_key,
            progress_target=target,
        )
        db.add(claim)
    claim.status = "completed"
    claim.progress_current = target
    claim.progress_target = target
    claim.completed_at = datetime.utcnow()
    claim.xp_awarded = reward
    claim.coin_awarded = 0
    claim.score_awarded = 0
    award_progress(db, child, source_type="quest_claim", source_id=quest.quest_id, xp=reward, score=0, description=title)
    db.commit()
    db.refresh(child)
    return {
        "quest_id": quest.quest_id,
        "status": "claimed",
        "exp_awarded": reward,
        "xp_awarded": reward,
        "updated_status": {
            "total_xp": child.total_xp,
            "level": child.current_level,
            "rank_title": child.current_rank_title,
            "coins": child.coins,
            "total_score": child.total_score,
        },
    }


@router.post("/check-in")
def check_in(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    stats = get_or_create_stats(db, child)
    today = _thai_now().date()
    period_day = today.isoformat()
    already = db.scalar(
        select(CheckInEvent).where(
            CheckInEvent.child_profile_id == child.id,
            CheckInEvent.event_date == today,
        )
    )
    if child.last_active_date != today:
        child.days_active += 1
        child.streak_count += 1
        stats.checkins += 1
        child.last_active_date = today
    if not already:
        db.add(CheckInEvent(child_profile_id=child.id, event_date=today, period_day=period_day))
    db.commit()
    daily_check_in = next(quest for quest in _fixed_quests(db, child, "daily") if quest["metric_type"] == "check_in")
    return {
        "checked_in": True,
        "already_checked_in": already is not None,
        "days_active": child.days_active,
        "streak_count": child.streak_count,
        "quest": daily_check_in,
    }


@router.get("/lessons")
def lessons(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    sections = _dashboard_lessons(db, child)
    remaining = remaining_free_tests(child) if not is_paid(child) else 999999
    return {
        "current_grade": child.grade_level,
        "membership_status": child.membership_status or "free",
        "remaining_free_tests": remaining,
        "current_grade_lessons": sections["current_grade_lessons"],
        "review_lessons": sections["review_lessons"],
        "locked_lessons": sections["locked_lessons"],
        "future_lessons": sections.get("future_lessons", []),
        "lessons": sections.get("all_lessons") or sections["review_lessons"] + sections["current_grade_lessons"],
    }


@router.get("/lessons/{lesson_id}")
def lesson_detail(
    lesson_id: str,
    program_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    child = _profile(db, user)
    if program_type is not None:
        raw_program = str(program_type).strip().upper()
        if raw_program not in {"TH", "THP", "EP"}:
            raise HTTPException(status_code=400, detail="program_type must be TH or EP")
        requested_program = program_alias(raw_program)
        found = find_lesson_file(lesson_id, requested_program)
        if found:
            _path, json_payload, ep_fallback = found
            if str(json_payload.get("status") or "approved").lower() not in {"approved", "published"}:
                raise HTTPException(status_code=404, detail="Lesson not found")
            item = _json_lesson_detail_item(json_payload, child)
            public_id = str(json_payload.get("lesson_id") or json_payload.get("id") or lesson_id)
            variant = _select_lesson_variant(db, child, f"{requested_program}:{public_id}", json_payload, record_view=True)
            db.commit()
            response = _json_lesson_content_payload(json_payload, item, variant)
            response["program_type"] = requested_program
            response["visual_blocks"] = normalize_lesson_visual_blocks(response.get("visual_blocks"))
            if ep_fallback:
                response["ep_fallback"] = True
            return response

    lesson = _lesson_by_public_id(db, lesson_id)
    if lesson and _lesson_content_is_real(lesson.content):
        if not _db_lesson_visible_for_child(lesson, child):
            raise HTTPException(status_code=404, detail="Lesson not found")
        item = _db_lesson_detail_item(db, lesson, child, lesson_id)
        public_id = _lesson_public_id(lesson)
        variant = _select_lesson_variant(db, child, public_id, lesson.content or {}, record_view=True)
        db.commit()
        return _lesson_content_payload(lesson, item, variant)

    json_payload = _load_json_lesson(lesson_id)
    if json_payload:
        if not _json_lesson_visible_for_child(json_payload, child):
            raise HTTPException(status_code=404, detail="Lesson not found")
        item = _json_lesson_detail_item(json_payload, child)
        public_id = str(json_payload.get("lesson_id") or json_payload.get("id") or lesson_id)
        variant = _select_lesson_variant(db, child, public_id, json_payload, record_view=True)
        db.commit()
        return _json_lesson_content_payload(json_payload, item, variant)

    if not lesson:
        raise HTTPException(status_code=404, detail="ไม่พบบทเรียนนี้")
    if not _db_lesson_visible_for_child(lesson, child):
        raise HTTPException(status_code=404, detail="Lesson not found")
    item = _db_lesson_detail_item(db, lesson, child, lesson_id)
    public_id = _lesson_public_id(lesson)
    variant = _select_lesson_variant(db, child, public_id, lesson.content or {}, record_view=True)
    db.commit()
    return _lesson_content_payload(lesson, item, variant)


@router.get("/review-lessons", response_model=list[LessonOut])
def review_lessons(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[LessonOut]:
    return _lessons(db, _profile(db, user), review_only=True)


@router.get("/recommended-lessons", response_model=list[LessonOut])
def recommended_lessons(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[LessonOut]:
    return _lessons(db, _profile(db, user), recommended_only=True)


@router.get("/test-levels")
def test_levels(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    return {
        "levels": _test_level_items(child),
        "remaining_free_tests": remaining_free_tests(child) if not is_paid(child) else 999999,
    }


@router.post("/tests/start")
def start_me_test(payload: MeTestStartIn, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    mode = payload.mode or "foundation"
    session_type = payload.session_type or payload.mode or "foundation"
    if not is_paid(child):
        recommended_grade = recommended_foundation_grade(child.grade_level)
        if payload.grade_level != recommended_grade:
            raise HTTPException(status_code=403, detail="สมาชิกฟรีทำได้เฉพาะเทสที่ระบบแนะนำ")
        if remaining_free_tests(child) <= 0:
            raise HTTPException(status_code=403, detail="ใช้สิทธิ์เทสฟรีครบแล้ว กรุณาอัปเกรดเพื่อทำเทสเพิ่มเติม")
    question_pool = db.scalars(select(Question).where(Question.grade_level == payload.grade_level, Question.status == "approved")).all()
    if len(question_pool) < 10:
        question_pool = list({question.id: question for question in question_pool + _ensure_fallback_questions(db, payload.grade_level)}.values())
    metadata_questions = [question for question in question_pool if (question.metadata_json or {}).get("topic_code") or (question.metadata_json or {}).get("skill_code")]
    questions, rotation_metadata = _select_rotating_ratio_questions(
        db,
        child,
        metadata_questions or question_pool,
        10,
        rotation_scope="foundation",
        rotation_key=f"foundation:g{payload.grade_level}",
        fill_fallbacks=[question_pool],
        context=f"foundation-g{payload.grade_level}",
    )
    if not questions:
        raise HTTPException(status_code=404, detail="No questions available")
    session = TestSession(
        child_profile_id=child.id,
        quiz_id=f"{mode}-g{payload.grade_level}",
        question_ids=[question.id for question in questions],
        timer_seconds=900,
        metadata_json=rotation_metadata,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {
        "session_id": session.id,
        "test_session_id": session.id,
        "grade_level": payload.grade_level,
        "mode": mode,
        "session_type": session_type,
        "title_th": _test_title(payload.grade_level),
        "time_limit_seconds": session.timer_seconds,
        "timer_seconds": session.timer_seconds,
        "core_question_count": session.metadata_json.get("core_question_count", 0),
        "challenge_question_count": session.metadata_json.get("challenge_question_count", 0),
        "ratio_policy": session.metadata_json.get("ratio_policy", RATIO_POLICY),
        "rotation_cycle": session.metadata_json.get("rotation_cycle", 1),
        "questions": [_question_payload(question) for question in questions],
    }


@router.get("/tests/{test_id}/questions")
def get_test_questions(test_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    session = db.get(TestSession, test_id)
    if not session or session.child_profile_id != child.id:
        raise HTTPException(status_code=404, detail="Test session not found")
    questions = _session_questions(db, session)
    grade_level = questions[0].grade_level if questions else child.grade_level
    return {
        "session_id": session.id,
        "grade_level": grade_level,
        "title_th": _test_title(grade_level),
        "time_limit_seconds": session.timer_seconds,
        "core_question_count": (session.metadata_json or {}).get("core_question_count", 0),
        "challenge_question_count": (session.metadata_json or {}).get("challenge_question_count", 0),
        "ratio_policy": (session.metadata_json or {}).get("ratio_policy", RATIO_POLICY),
        "rotation_cycle": (session.metadata_json or {}).get("rotation_cycle", 1),
        "questions": [_question_payload(question) for question in questions],
    }


@router.post("/lessons/{lesson_id}/start")
def start_lesson(lesson_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    json_payload = _load_json_lesson(lesson_id)
    if json_payload and not _json_lesson_visible_for_child(json_payload, child):
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson = _ensure_json_lesson_in_db(db, json_payload) if json_payload else _lesson_by_public_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if not _db_lesson_visible_for_child(lesson, child):
        raise HTTPException(status_code=404, detail="Lesson not found")
    try:
        item = _lesson_access_item(db, child, lesson_id)
    except HTTPException:
        if not is_paid(child):
            raise
        item = _db_lesson_detail_item(db, lesson, child, lesson_id)
    if item["is_locked"]:
        raise HTTPException(status_code=403, detail="Lesson is locked")
    today = _thai_now().date()
    period_day = today.isoformat()
    activity_lesson_id = _lesson_public_id(lesson)
    existing_activity = db.scalar(
        select(LessonActivity).where(
            LessonActivity.child_profile_id == child.id,
            LessonActivity.lesson_id == activity_lesson_id,
            LessonActivity.period_day == period_day,
        )
    )
    if not existing_activity:
        db.add(
            LessonActivity(
                child_profile_id=child.id,
                lesson_id=activity_lesson_id,
                activity_type="started",
                period_day=period_day,
            )
        )
    apply_quest_progress(db, child, "lesson_start")
    variant = _select_lesson_variant(db, child, activity_lesson_id, lesson.content or json_payload or {}, record_view=True)
    db.commit()
    return {"lesson": item, "content": _with_variant_payload(dict(lesson.content or {}), variant)}


@router.post("/lessons/{lesson_id}/test/start")
def start_lesson_test(lesson_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    if not is_paid(child) and remaining_free_tests(child) <= 0:
        raise HTTPException(status_code=403, detail="ใช้สิทธิ์เทสฟรีครบแล้ว กรุณาอัปเกรดเพื่อทำเทสเพิ่มเติม")
    json_payload = _load_json_lesson(lesson_id)
    if json_payload and not _json_lesson_visible_for_child(json_payload, child):
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson = _ensure_json_lesson_in_db(db, json_payload) if json_payload else _lesson_by_public_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if not _db_lesson_visible_for_child(lesson, child):
        raise HTTPException(status_code=404, detail="Lesson not found")
    try:
        item = _lesson_access_item(db, child, lesson_id)
    except HTTPException:
        if not is_paid(child):
            raise
        item = _db_lesson_detail_item(db, lesson, child, lesson_id)
    if item["is_locked"]:
        raise HTTPException(status_code=403, detail="Lesson is locked")
    skill = db.get(Skill, lesson.skill_id)
    grade_level = skill.grade_level if skill else child.grade_level
    if skill:
        questions, rotation_metadata = _select_lesson_test_questions_rotating(db, child, lesson, skill, 10)
        _mark_lesson_question_metadata(questions, lesson, skill)
    else:
        question_pool = db.scalars(select(Question).where(Question.grade_level == grade_level, Question.status == "approved")).all()
        questions, rotation_metadata = _select_rotating_ratio_questions(
            db,
            child,
            question_pool,
            10,
            rotation_scope="lesson",
            rotation_key=f"lesson:{lesson_id}",
            lesson_id=lesson_id,
            fill_fallbacks=[question_pool],
            context=f"lesson-{lesson_id}",
        )
    if len(questions) < 5:
        questions = _select_questions(db, grade_level, limit=10)
        rotation_metadata = _session_ratio_metadata(questions)
        rotation_metadata.update({"rotation_scope": "lesson", "rotation_key": f"lesson:{lesson_id}", "rotation_cycle": 1})
    session = TestSession(
        child_profile_id=child.id,
        lesson_id=lesson.id,
        quiz_id=(lesson.content or {}).get("quiz_id") or lesson.id,
        question_ids=[question.id for question in questions],
        timer_seconds=900,
        metadata_json=rotation_metadata,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {
        "session_id": session.id,
        "test_session_id": session.id,
        "grade_level": grade_level,
        "mode": "lesson",
        "session_type": "quiz",
        "title_th": f"แบบทดสอบ: {item['title_th']}",
        "time_limit_seconds": session.timer_seconds,
        "timer_seconds": session.timer_seconds,
        "core_question_count": session.metadata_json.get("core_question_count", 0),
        "challenge_question_count": session.metadata_json.get("challenge_question_count", 0),
        "ratio_policy": session.metadata_json.get("ratio_policy", RATIO_POLICY),
        "rotation_cycle": session.metadata_json.get("rotation_cycle", 1),
        "questions": [_question_payload(question) for question in questions],
    }


@router.post("/tests/{test_id}/start", response_model=TestStartOut)
def start_test(test_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> TestStartOut:
    child = _profile(db, user)
    json_payload = _load_json_lesson(test_id)
    lesson = _ensure_json_lesson_in_db(db, json_payload) if json_payload else _lesson_by_public_id(db, test_id)
    quiz_id = test_id
    skill_id = lesson.skill_id if lesson else None
    question_grade = child.grade_level
    if lesson:
        lesson_items = lessons(db, user)["lessons"]
        public_id = _lesson_public_id(lesson)
        item = next((row for row in lesson_items if row["lesson_id"] in {public_id, lesson.id, test_id}), None)
        if item and item["is_locked"]:
            raise HTTPException(status_code=403, detail="Lesson is locked")
        if not is_paid(child) and remaining_free_tests(child) <= 0:
            raise HTTPException(status_code=403, detail="ใช้สิทธิ์เทสฟรีครบแล้ว กรุณาอัปเกรดเพื่อทำเทสเพิ่มเติม")
        skill = db.get(Skill, lesson.skill_id)
        if skill:
            question_grade = skill.grade_level
        quiz_id = (lesson.content or {}).get("quiz_id") or test_id
    skill = db.get(Skill, skill_id) if skill_id else None
    if json_payload and lesson and skill:
        questions, rotation_metadata = _select_lesson_test_questions_rotating(db, child, lesson, skill, 5)
        _mark_lesson_question_metadata(questions, lesson, skill)
    else:
        query = select(Question).where(Question.grade_level == question_grade, Question.status == "approved")
        if skill_id:
            query = query.where(Question.skill_id == skill_id)
        question_pool = db.scalars(query).all()
        if len(question_pool) < 5 and not skill_id:
            question_pool = list({question.id: question for question in question_pool + _ensure_fallback_questions(db, question_grade)}.values())
        questions, rotation_metadata = _select_rotating_ratio_questions(
            db,
            child,
            question_pool,
            5,
            rotation_scope="review",
            rotation_key=f"review:{test_id}",
            lesson_id=_lesson_public_id(lesson) if lesson else None,
            fill_fallbacks=[question_pool],
            context=f"review-{test_id}",
        )
    if not questions:
        raise HTTPException(status_code=404, detail="No questions available")
    session = TestSession(
        child_profile_id=child.id,
        lesson_id=lesson.id if lesson else None,
        quiz_id=quiz_id,
        question_ids=[q.id for q in questions],
        metadata_json=rotation_metadata,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return TestStartOut(
        test_session_id=session.id,
        lesson_id=session.lesson_id,
        quiz_id=session.quiz_id,
        timer_seconds=session.timer_seconds,
        core_question_count=session.metadata_json.get("core_question_count", 0),
        challenge_question_count=session.metadata_json.get("challenge_question_count", 0),
        ratio_policy=session.metadata_json.get("ratio_policy", RATIO_POLICY),
        rotation_cycle=session.metadata_json.get("rotation_cycle", 1),
        questions=[
            {
                "id": question.id,
                "question_text": question.question_text,
                "choices": question.choices or [],
            }
            for question in questions
        ],
    )


@router.post("/tests/{test_id}/submit")
def submit_test(test_id: str, payload: dict, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    session = db.get(TestSession, test_id)
    if not session or session.child_profile_id != child.id:
        raise HTTPException(status_code=404, detail="Test session not found")
    questions = _session_questions(db, session)
    if not questions:
        raise HTTPException(status_code=400, detail="Test session has no questions")
    if "question_id" in payload:
        item = MeQuestionSubmitIn.model_validate(payload)
        question = next((row for row in questions if row.id == item.question_id), None)
        if not question:
            raise HTTPException(status_code=404, detail="Question not found in test session")
        match = answer_match_details(question, item.selected_answer)
        return {
            "question_id": question.id,
            "is_correct": match["is_correct"],
            "correct_answer": question.correct_answer,
            "explanation_th": question.explanation or "",
            "selected_answer_raw": match["selected_answer_raw"],
            "selected_answer_normalized": match["selected_answer_normalized"],
            "correct_answer_normalized": match["correct_answer_normalized"],
        }
    answers_payload = payload.get("answers", {})
    if isinstance(answers_payload, list):
        answer_map = {answer["question_id"]: answer.get("selected_answer", "") for answer in answers_payload}
        response_times = {answer["question_id"]: int(answer.get("response_time_ms", 0) or 0) for answer in answers_payload}
        total_time_ms = int(payload.get("total_time_ms", 0) or 0)
    else:
        answer_map = answers_payload
        response_times = {key: int(value or 0) for key, value in payload.get("response_times_ms", {}).items()}
        total_time_ms = sum(response_times.values())
    correct = sum(1 for question in questions if is_answer_correct(question, answer_map.get(question.id, "")))
    total = len(questions)
    accuracy = round((correct / total) * 100, 2) if total else 0
    core_questions = [question for question in questions if _question_challenge_role(question) == "core"]
    challenge_questions = [question for question in questions if _question_challenge_role(question) == "challenge"]
    core_total = len(core_questions)
    challenge_total = len(challenge_questions)
    core_correct_count = sum(1 for question in core_questions if is_answer_correct(question, answer_map.get(question.id, "")))
    challenge_correct_count = sum(1 for question in challenge_questions if is_answer_correct(question, answer_map.get(question.id, "")))
    core_accuracy = round((core_correct_count / core_total) * 100, 2) if core_total else 0
    challenge_accuracy = round((challenge_correct_count / challenge_total) * 100, 2) if challenge_total else 0
    speeds = [response_times.get(question.id, 0) for question in questions if response_times.get(question.id, 0) > 0]
    avg_speed = round(sum(speeds) / len(speeds), 2) if speeds else 0
    score_awarded = int(accuracy)
    xp_awarded = 20 if accuracy >= 50 else 5
    session.status = "completed"
    session.completed_at = datetime.utcnow()
    result = TestResult(
        test_session_id=session.id,
        child_profile_id=child.id,
        lesson_id=session.lesson_id,
        quiz_id=session.quiz_id,
        total_questions=total,
        correct_count=correct,
        accuracy=accuracy,
        average_response_time_ms=avg_speed,
        total_time_ms=total_time_ms,
        score_awarded=score_awarded,
        xp_awarded=xp_awarded,
    )
    db.add(result)
    by_skill: dict[str, list[AnswerResult]] = {}
    weak_skills: list[dict] = []
    subject = db.scalar(select(Skill).where(Skill.id == questions[0].skill_id)) if questions else None
    quiz_session = QuizSession(
        child_profile_id=child.id,
        subject_id=subject.subject_id if subject else "",
        mode="dashboard_test",
        total_questions=total,
        correct_count=correct,
        metadata_json={"test_session_id": session.id, "total_time_ms": total_time_ms},
    )
    db.add(quiz_session)
    db.flush()
    for question in questions:
        selected = str(answer_map.get(question.id, ""))
        match = answer_match_details(question, selected)
        is_correct = match["is_correct"]
        response_time = response_times.get(question.id, 0)
        by_skill.setdefault(question.skill_id, []).append(AnswerResult(is_correct, response_time, question.difficulty))
        db.add(
            QuizAnswer(
                quiz_session_id=quiz_session.id,
                child_profile_id=child.id,
                question_id=question.id,
                skill_id=question.skill_id,
                selected_answer=selected,
                selected_answer_raw=match["selected_answer_raw"],
                selected_answer_normalized=match["selected_answer_normalized"],
                correct_answer_normalized=match["correct_answer_normalized"],
                is_correct=is_correct,
                response_time_ms=response_time,
                mistake_type=infer_mistake_type(is_correct, response_time),
            )
        )
    _record_question_attempts(db, child, session, questions, answer_map)
    for skill_id, results in by_skill.items():
        score = calculate_mastery_score(results)
        row = db.scalar(select(SkillMastery).where(SkillMastery.child_profile_id == child.id, SkillMastery.skill_id == skill_id))
        if not row:
            row = SkillMastery(child_profile_id=child.id, skill_id=skill_id, correct_count=0, incorrect_count=0)
            db.add(row)
        row.mastery_score = score
        row.mastery_level = mastery_level(score)
        row.correct_count = (row.correct_count or 0) + sum(1 for result in results if result.is_correct)
        row.incorrect_count = (row.incorrect_count or 0) + sum(1 for result in results if not result.is_correct)
        row.avg_response_time_ms = int(sum(result.response_time_ms for result in results) / len(results))
        row.last_practiced_at = datetime.utcnow()
        if score < 60:
            skill = db.get(Skill, skill_id)
            weak_skills.append({"skill_id": skill_id, "skill_code": skill.code if skill else None, "mastery_score": score})
    stats = get_or_create_stats(db, child)
    stats.tests_completed += 1
    if accuracy == 100:
        stats.perfect_tests += 1
    child.total_tests_completed += 1
    child.average_test_accuracy = round(((float(child.average_test_accuracy or 0) * (child.total_tests_completed - 1)) + accuracy) / child.total_tests_completed, 2)
    child.average_test_speed = round(((float(child.average_test_speed or 0) * (child.total_tests_completed - 1)) + avg_speed) / child.total_tests_completed, 2)
    if not is_paid(child):
        child.test_attempts_used = (child.test_attempts_used or 0) + 1
    award_progress(db, child, source_type="test_complete", source_id=session.id, xp=xp_awarded, score=score_awarded, description="Test completed")
    if session.lesson_id:
        stats.lessons_completed += 1
        apply_quest_progress(db, child, "lesson_complete")
    apply_quest_progress(db, child, "test_50" if accuracy >= 50 else "test_complete")
    if accuracy == 100:
        apply_quest_progress(db, child, "test_100")
    db.commit()
    db.refresh(child)
    recommendations = _recommendations(db, child)
    adaptive_recommendations: list[dict] = []
    if core_total and core_accuracy < 60:
        adaptive_recommendations.append({"type": "core_review", "reason": "core_accuracy_low", "title_th": "ทบทวนบทเรียนหลักก่อน"})
    if challenge_total and challenge_accuracy < 60 and core_accuracy >= 70:
        adaptive_recommendations.append({"type": "challenge_practice", "reason": "challenge_accuracy_low", "title_th": "ฝึกโจทย์ประยุกต์และโจทย์ไม่ตรงแบบ"})
    if core_total and challenge_total and core_accuracy < 60 and challenge_accuracy < 60:
        adaptive_recommendations.append({"type": "core_first", "reason": "core_and_challenge_accuracy_low", "title_th": "เริ่มจากทบทวนพื้นฐาน แล้วค่อยฝึกโจทย์ท้าทาย"})
    recommendations = recommendations + adaptive_recommendations
    updated_status = {
        "level": child.current_level,
        "total_xp": child.total_xp,
        "total_score": child.total_score,
        "coins": child.coins,
        "rank_title": child.current_rank_title,
        "test_attempts_used": child.test_attempts_used or 0,
        "remaining_free_tests": remaining_free_tests(child) if not is_paid(child) else 999999,
    }
    return {
        "test_session_id": session.id,
        "session_id": session.id,
        "total_questions": total,
        "correct_count": correct,
        "core_correct_count": core_correct_count,
        "core_total": core_total,
        "challenge_correct_count": challenge_correct_count,
        "challenge_total": challenge_total,
        "core_accuracy": core_accuracy,
        "challenge_accuracy": challenge_accuracy,
        "accuracy": accuracy,
        "score_percent": accuracy,
        "average_response_time_ms": avg_speed,
        "total_time_ms": total_time_ms,
        "score_awarded": score_awarded,
        "score_earned": score_awarded,
        "xp_awarded": xp_awarded,
        "xp_earned": xp_awarded,
        "total_score": child.total_score,
        "total_xp": child.total_xp,
        "rank_title": child.current_rank_title,
        "updated_status": updated_status,
        "weak_skills": weak_skills,
        "recommendations": recommendations,
    }


@router.post("/tests/{test_id}/finish")
def finish_test(test_id: str, payload: dict, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    return submit_test(test_id, payload, db, user)


@router.get("/stats")
def stats(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    stats_row = get_or_create_stats(db, child)
    return {
        "score": child.total_score,
        "speed": float(child.average_test_speed or 0),
        "lesson_count": stats_row.lessons_completed,
        "test_count": child.total_tests_completed,
        "rank_title": child.current_rank_title,
        "average_test_accuracy": float(child.average_test_accuracy or 0),
    }


@router.get("/rank-summary")
def rank_summary(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    child.current_rank_title = rank_title_for_score(child.total_score)
    return {
        "total_score": child.total_score,
        "rank_title": child.current_rank_title,
        "grade_level": child.grade_level,
        "leaderboard_scope": "grade",
    }


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _profile(db, user)
    stats_row = get_or_create_stats(db, child)
    refresh_rank(child)
    daily = _fixed_quests(db, child, "daily")
    weekly = _fixed_quests(db, child, "weekly")
    monthly = _fixed_quests(db, child, "monthly")
    lesson_sections = _dashboard_lessons(db, child)
    lesson_items = lesson_sections.get("all_lessons") or lesson_sections["review_lessons"] + lesson_sections["current_grade_lessons"]
    daily_payload = daily
    weekly_payload = weekly
    monthly_payload = monthly
    test_levels = _test_level_items(child)
    child_out = child_to_out(child).model_dump()
    child_summary = {
        "id": child.id,
        "first_name": child.first_name,
        "last_name": child.last_name,
        "nickname": child.nickname,
        "school_name": child.school_name,
        "school_province": child.school_province,
        "school_district": child.school_district,
        "grade_level": child.grade_level,
        "program_type": child.program_type or "THP",
        "membership_status": child.membership_status or "free",
        "avatar_gender": child.avatar_gender,
        "avatar_config": child.avatar_config or {},
    }
    remaining = remaining_free_tests(child) if not is_paid(child) else 999999
    return {
        "child": child_summary,
        "status": {
            "level": child.current_level,
            "total_xp": child.total_xp,
            "total_score": child.total_score,
            "coins": child.coins,
            "days_active": child.days_active,
            "rank_title": child.current_rank_title,
            "test_attempts_used": child.test_attempts_used or 0,
            "free_test_limit": child.free_test_limit or 5,
            "remaining_free_tests": remaining,
        },
        "foundation_test": _foundation_test(child),
        "test_levels": test_levels,
        "available_test_levels": test_levels,
        "daily_quests": daily_payload,
        "weekly_quests": weekly_payload,
        "monthly_quests": monthly_payload,
        "lessons": lesson_items,
        "lesson_sections": lesson_sections,
        "quests": {
            "daily": daily_payload,
            "weekly": weekly_payload,
            "monthly": monthly_payload,
        },
        "recommendations": _recommendations(db, child),
        "profile": child_out,
        "level": child.current_level,
        "days_active": child.days_active,
        "total_score": child.total_score,
        "rank_title": child.current_rank_title,
        "program_type": child.program_type,
        "avatar": {"avatar_gender": child.avatar_gender, "avatar_config": child.avatar_config or {}},
        "rank_summary": {
            "total_score": child.total_score,
            "rank_title": child.current_rank_title,
            "grade_level": child.grade_level,
        },
        "lesson_summary": {
            "available": len([lesson for lesson in lesson_items if not lesson["is_locked"]]),
            "locked": len([lesson for lesson in lesson_items if lesson["is_locked"]]),
            "completed": stats_row.lessons_completed,
        },
        "quest_summary": {
            "daily": len(daily),
            "weekly": len(weekly),
            "monthly": len(monthly),
            "completed": stats_row.quests_completed,
        },
    }
