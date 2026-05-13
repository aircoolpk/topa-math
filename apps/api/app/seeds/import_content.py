import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import Base, engine
from app.core.schema_maintenance import ensure_local_schema
from app.models import (
    LearningQuest,
    Lesson,
    Question,
    QuestTemplate,
    RecurringQuestTemplate,
    Skill,
    Subject,
)
from app.services.content_quality import validate_lesson_payload

CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "math"
RECURRENCE_FILES = {
    "daily_quests.json": "daily",
    "weekly_quests.json": "weekly",
    "monthly_quests.json": "monthly",
}


class ContentImportError(ValueError):
    pass


def _load_json(path: Path) -> Any:
    if not path.exists():
        raise ContentImportError(f"Missing content file: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ContentImportError(f"Invalid JSON in {path}: {exc}") from exc


def _grade_number(path: Path) -> int:
    name = path.name
    if name.startswith("grade_"):
        return int(name.removeprefix("grade_"))
    if name.startswith("g") and name[1:].isdigit():
        return int(name[1:])
    raise ContentImportError(f"Cannot infer grade from folder name: {path}")


def _available_grade_dirs(content_root: Path) -> list[Path]:
    by_grade: dict[int, Path] = {}
    for child in content_root.iterdir() if content_root.exists() else []:
        if not child.is_dir():
            continue
        try:
            grade = _grade_number(child)
        except ContentImportError:
            continue
        if 1 <= grade <= 6 and (child / "curriculum.json").exists():
            # Prefer the richer grade_N folders when both naming styles exist.
            if grade not in by_grade or child.name.startswith("grade_"):
                by_grade[grade] = child
    return [by_grade[grade] for grade in sorted(by_grade)]


def _require_keys(payload: dict, keys: set[str], label: str) -> None:
    missing = sorted(keys - payload.keys())
    if missing:
        raise ContentImportError(f"{label} missing required keys: {', '.join(missing)}")


def _as_list(payload: Any, label: str) -> list[dict]:
    if not isinstance(payload, list) or any(not isinstance(item, dict) for item in payload):
        raise ContentImportError(f"{label} must be a list of objects")
    return payload


def _object_list(payload: Any, label: str) -> list[dict]:
    if isinstance(payload, dict):
        for key in ("quests", "daily_quests", "weekly_quests", "monthly_quests", "items", "templates"):
            if key in payload:
                payload = payload[key]
                break
    return _as_list(payload, label)


def _subject(db: Session) -> Subject:
    subject = db.scalar(select(Subject).where(Subject.code == "math"))
    if not subject:
        subject = Subject(code="math", name="Mathematics")
        db.add(subject)
        db.flush()
    return subject


def _lesson_index(db: Session) -> dict[str, Lesson]:
    return {
        lesson.content.get("content_id"): lesson
        for lesson in db.scalars(select(Lesson)).all()
        if isinstance(lesson.content, dict) and lesson.content.get("content_id")
    }


def _question_index(db: Session) -> dict[str, Question]:
    return {
        question.metadata_json.get("content_id"): question
        for question in db.scalars(select(Question)).all()
        if isinstance(question.metadata_json, dict) and question.metadata_json.get("content_id")
    }


def _upsert_skills(db: Session, grade_dir: Path, subject: Subject) -> dict[str, Skill]:
    curriculum = _load_json(grade_dir / "curriculum.json")
    _require_keys(curriculum, {"grade_level", "skills"}, str(grade_dir / "curriculum.json"))
    grade_level = int(curriculum.get("grade_level") or _grade_number(grade_dir))
    skills = _as_list(curriculum["skills"], "curriculum skills")
    by_code: dict[str, Skill] = {}
    for order, payload in enumerate(skills, start=1):
        code = payload.get("code") or payload.get("skill_code")
        name = payload.get("name") or payload.get("skill_name_th")
        if not code or not name:
            raise ContentImportError("skill missing required code/name fields")
        skill = db.scalar(select(Skill).where(Skill.code == code))
        if not skill:
            skill = Skill(subject_id=subject.id, grade_level=grade_level, code=code, name=name)
            db.add(skill)
        skill.subject_id = subject.id
        skill.grade_level = grade_level
        skill.name = name
        skill.description = payload.get("description") or payload.get("description_th")
        skill.prerequisite_skill_ids = payload.get("prerequisite_skill_ids") or payload.get("prerequisite_skill_codes", [])
        skill.difficulty_order = int(payload.get("difficulty_order", order))
        db.flush()
        by_code[skill.code] = skill
    return by_code


def _skill_for_code(db: Session, skills: dict[str, Skill], subject: Subject, code: str, grade_level: int) -> Skill:
    skill = skills.get(code) or db.scalar(select(Skill).where(Skill.code == code))
    if not skill:
        skill = Skill(subject_id=subject.id, grade_level=grade_level, code=code, name=code, description=None)
        db.add(skill)
        db.flush()
    skills[code] = skill
    return skill


def _upsert_lessons(db: Session, grade_dir: Path, subject: Subject, skills: dict[str, Skill], existing_lessons: dict[str, Lesson]) -> dict[str, Lesson]:
    lessons_by_content_id: dict[str, Lesson] = {}
    lessons_dir = grade_dir / "lessons"
    if not lessons_dir.exists():
        raise ContentImportError(f"Missing lessons directory: {lessons_dir}")
    for path in sorted(lessons_dir.glob("*.json")):
        payload = _load_json(path)
        lesson_id = payload.get("lesson_id") or payload.get("id")
        skill_code = payload.get("skill_code") or payload.get("skill") or lesson_id
        grade_level = int(payload.get("grade") or payload.get("grade_level") or _grade_number(grade_dir))
        if not lesson_id or not skill_code:
            raise ContentImportError(f"{path} missing lesson id or skill code")
        skill = _skill_for_code(db, skills, subject, skill_code, grade_level)
        lesson = existing_lessons.get(lesson_id)
        title = payload.get("title") or payload.get("title_th") or payload.get("name") or lesson_id
        content = dict(payload.get("content") or payload)
        content["content_id"] = lesson_id
        content["skill_code"] = skill_code
        content["grade_level"] = grade_level
        quiz_path = grade_dir / "quizzes" / f"{payload.get('quiz_id') or lesson_id}.json"
        quiz_payload = _load_json(quiz_path) if quiz_path.exists() else None
        if content.get("quality_required") is True or content.get("content_schema_version") == "2.0":
            quality = validate_lesson_payload(content, quiz_payload=quiz_payload)
            content["quality_issues"] = quality["issues"]
            content["publishable"] = quality["publishable"]
        if not lesson:
            lesson = Lesson(skill_id=skill.id, title=title, content=content)
            db.add(lesson)
            existing_lessons[lesson_id] = lesson
        lesson.skill_id = skill.id
        lesson.title = title
        lesson.content = content
        lesson.source = payload.get("source", "human")
        requested_status = payload.get("status", "approved")
        lesson.status = requested_status
        if (content.get("quality_required") is True or content.get("content_schema_version") == "2.0") and not content.get("publishable"):
            lesson.status = "needs_review"
        db.flush()
        lessons_by_content_id[lesson_id] = lesson
    return lessons_by_content_id


def _upsert_questions(db: Session, grade_dir: Path, subject: Subject, skills: dict[str, Skill], existing_questions: dict[str, Question]) -> int:
    count = 0
    quizzes_dir = grade_dir / "quizzes"
    if not quizzes_dir.exists():
        return 0
    for path in sorted(quizzes_dir.glob("*.json")):
        quiz = _load_json(path)
        _require_keys(quiz, {"quiz_id", "skill_code", "grade_level", "questions"}, str(path))
        skill = _skill_for_code(db, skills, subject, quiz["skill_code"], int(quiz["grade_level"]))
        for payload in _as_list(quiz["questions"], f"{path} questions"):
            question_text = (
                payload.get("question_text")
                or payload.get("question_text_th")
                or payload.get("question_th")
                or payload.get("question_en")
                or payload.get("prompt")
            )
            question_id = payload.get("question_id") or payload.get("id")
            if not question_id or not question_text or "correct_answer" not in payload:
                raise ContentImportError(f"question in {path} missing required id/text/correct_answer fields")
            content_id = f"{quiz['quiz_id']}:{question_id}"
            question = existing_questions.get(content_id)
            if not question:
                question = Question(skill_id=skill.id, grade_level=int(quiz["grade_level"]), question_type="multiple_choice", difficulty="easy", question_text="", correct_answer="")
                db.add(question)
                existing_questions[content_id] = question
            question.skill_id = skill.id
            question.grade_level = int(quiz["grade_level"])
            question.question_type = payload.get("question_type", "multiple_choice")
            question.difficulty = payload.get("difficulty", "easy")
            question.question_text = question_text
            question.choices = payload.get("choices", [])
            question.correct_answer = str(payload["correct_answer"])
            question.explanation = payload.get("explanation") or payload.get("explanation_th") or payload.get("explanation_en")
            question.hint = payload.get("hint") or payload.get("hint_th")
            question.source = payload.get("source", "human")
            question.status = payload.get("status", "approved")
            question.metadata_json = {
                "content_id": content_id,
                "quiz_id": quiz["quiz_id"],
                "skill_code": quiz["skill_code"],
                "topic_code": payload.get("topic_code") or quiz["skill_code"],
                "question_type": payload.get("question_type"),
                "routine_level": payload.get("routine_level"),
                "confidence_role": payload.get("confidence_role"),
                "question_en": payload.get("question_en"),
                "question_th": payload.get("question_th"),
                "explanation_en": payload.get("explanation_en"),
                "explanation_th": payload.get("explanation_th"),
            }
            count += 1
    return count


def _quest_payload(payload: dict, recurrence_type: str, lessons: dict[str, Lesson], grade_level: int) -> dict:
    _require_keys(payload, {"quest_id", "xp_reward"}, "quest")
    lesson_refs = payload.get("linked_lesson_ids") or []
    quiz_refs = payload.get("linked_quiz_ids") or []
    lesson_ref = payload.get("lesson_id") or (lesson_refs[0] if lesson_refs else None)
    quiz_ref = payload.get("quiz_id") or (quiz_refs[0] if quiz_refs else None)
    skill_codes = payload.get("skill_codes") or []
    title = payload.get("title") or payload.get("quest_title_th") or payload["quest_id"]
    return {
        "quest_id": payload["quest_id"],
        "grade_level": int(payload.get("grade_level") or grade_level),
        "skill_code": payload.get("skill_code") or payload.get("topic_code") or (skill_codes[0] if skill_codes else None),
        "title": title,
        "description": payload.get("description") or payload.get("quest_story_th"),
        "quest_type": payload.get("quest_type") or payload.get("requirement_type") or ("practice" if recurrence_type != "none" else "lesson"),
        "recurrence_type": payload.get("recurrence_type", recurrence_type),
        "xp_reward": int(payload.get("xp_reward", 0)),
        "coin_reward": int(payload.get("coin_reward", 0)),
        "estimated_minutes": payload.get("estimated_minutes"),
        "status": payload.get("status", "active"),
        "lesson_id": lessons[lesson_ref].id if lesson_ref and lesson_ref in lessons else None,
        "quiz_id": quiz_ref,
        "metadata_json": {
            "source_lesson_id": lesson_ref,
            "action_type": payload.get("action_type") or payload.get("requirement_type") or payload.get("quest_type", "lesson"),
            "target_count": int(payload.get("target_count") or payload.get("requirement_count") or 1),
            "score_reward": int(payload.get("score_reward", payload.get("xp_reward", 0))),
        },
    }


def _copy_attrs(row: Any, values: dict) -> None:
    for field, value in values.items():
        setattr(row, field, value)


def _upsert_quests(db: Session, grade_dir: Path, lessons: dict[str, Lesson]) -> int:
    count = 0
    grade_level = _grade_number(grade_dir)
    for filename, recurrence_type in {"quests.json": "none", **RECURRENCE_FILES}.items():
        path = grade_dir / filename
        if not path.exists():
            continue
        for payload in _object_list(_load_json(path), filename):
            values = _quest_payload(payload, recurrence_type, lessons, grade_level)
            quest = db.scalar(select(LearningQuest).where(LearningQuest.quest_id == values["quest_id"]))
            if not quest:
                quest = LearningQuest(**values)
                db.add(quest)
            else:
                _copy_attrs(quest, values)
            template = db.scalar(select(QuestTemplate).where(QuestTemplate.quest_id == values["quest_id"]))
            if not template:
                template = QuestTemplate(**values)
                db.add(template)
            else:
                _copy_attrs(template, values)
            if values["recurrence_type"] != "none":
                recurring_values = dict(values)
                recurring_values.pop("recurrence_type")
                recurring = db.scalar(select(RecurringQuestTemplate).where(RecurringQuestTemplate.quest_id == values["quest_id"]))
                if not recurring:
                    recurring = RecurringQuestTemplate(recurrence_type=values["recurrence_type"], **recurring_values)
                    db.add(recurring)
                else:
                    recurring.recurrence_type = values["recurrence_type"]
                    _copy_attrs(recurring, recurring_values)
            count += 1
    return count


def import_content(db: Session, content_root: Path = CONTENT_ROOT) -> dict[str, int]:
    subject = _subject(db)
    totals = {"grades": 0, "skills": 0, "lessons": 0, "questions": 0, "quests": 0}
    existing_lessons = _lesson_index(db)
    existing_questions = _question_index(db)
    for grade_dir in _available_grade_dirs(content_root):
        skills = _upsert_skills(db, grade_dir, subject)
        lessons = _upsert_lessons(db, grade_dir, subject, skills, existing_lessons)
        question_count = _upsert_questions(db, grade_dir, subject, skills, existing_questions)
        quest_count = _upsert_quests(db, grade_dir, lessons)
        totals["grades"] += 1
        totals["skills"] += len(skills)
        totals["lessons"] += len(lessons)
        totals["questions"] += question_count
        totals["quests"] += quest_count
    db.commit()
    return totals


def main() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_local_schema(engine)
    with Session(engine) as session:
        totals = import_content(session)
    print(
        "Content import complete: "
        f"{totals['grades']} grades, {totals['skills']} skills, {totals['lessons']} lessons, "
        f"{totals['questions']} questions, {totals['quests']} quests"
    )


if __name__ == "__main__":
    main()
