import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import Base, engine
from app.core.schema_maintenance import ensure_local_schema
from app.models import Question, Skill, Subject

CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "math"
QUESTION_BANK_ROOT = CONTENT_ROOT / "question_banks"


class QuestionBankImportError(ValueError):
    pass


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise QuestionBankImportError(f"Invalid JSON in {path}: {exc}") from exc


def _subject(db: Session) -> Subject:
    subject = db.scalar(select(Subject).where(Subject.code == "math"))
    if not subject:
        subject = Subject(code="math", name="Mathematics")
        db.add(subject)
        db.flush()
    return subject


def _grade_number(path: Path) -> int:
    name = path.name
    if name.startswith("grade_"):
        return int(name.removeprefix("grade_"))
    if name.startswith("g") and name[1:].isdigit():
        return int(name[1:])
    raise QuestionBankImportError(f"Cannot infer grade from folder name: {path}")


def _available_bank_dirs(root: Path) -> list[Path]:
    if not root.exists():
        return []
    dirs = []
    for child in root.iterdir():
        if not child.is_dir():
            continue
        try:
            grade = _grade_number(child)
        except QuestionBankImportError:
            continue
        if 1 <= grade <= 6:
            dirs.append(child)
    return sorted(dirs, key=_grade_number)


def _skill_for_payload(db: Session, subject: Subject, payload: dict) -> Skill:
    grade_level = int(payload["grade_level"])
    code = payload.get("skill_code") or payload.get("topic_code")
    if not code:
        raise QuestionBankImportError("Question missing skill_code/topic_code")
    skill = db.scalar(select(Skill).where(Skill.code == code))
    if not skill:
        skill = Skill(
            subject_id=subject.id,
            grade_level=grade_level,
            code=code,
            name=payload.get("skill_name_th") or payload.get("topic_name_th") or code,
            description=payload.get("learning_value_th"),
        )
        db.add(skill)
        db.flush()
    return skill


def _existing_questions(db: Session) -> dict[str, Question]:
    rows = db.scalars(select(Question)).all()
    return {
        row.metadata_json.get("external_id"): row
        for row in rows
        if isinstance(row.metadata_json, dict) and row.metadata_json.get("external_id")
    }


def _upsert_question(db: Session, subject: Subject, payload: dict, existing: dict[str, Question]) -> tuple[int, str]:
    question_id = payload.get("question_id") or payload.get("external_id") or payload.get("id")
    question_text = payload.get("question_text") or payload.get("question_text_th") or payload.get("prompt")
    nested_choices = payload.get("choices") if isinstance(payload.get("choices"), dict) else {}
    for field in ("correct_answer", "explanation_th", "hint_th"):
        if field not in payload and field in nested_choices:
            payload[field] = nested_choices[field]
    if not question_id or not question_text or "correct_answer" not in payload or "grade_level" not in payload:
        raise QuestionBankImportError(f"Question bank row missing required fields: {payload}")
    skill = _skill_for_payload(db, subject, payload)
    question = existing.get(question_id)
    created = 0
    if not question:
        question = Question(
            skill_id=skill.id,
            grade_level=int(payload["grade_level"]),
            question_type=payload.get("question_type", "multiple_choice"),
            difficulty=payload.get("difficulty", "easy"),
            question_text=question_text,
            correct_answer=str(payload["correct_answer"]),
        )
        db.add(question)
        existing[question_id] = question
        created = 1
    question.skill_id = skill.id
    question.grade_level = int(payload["grade_level"])
    question.question_type = payload.get("question_type", "multiple_choice")
    question.difficulty = payload.get("difficulty", "easy")
    question.question_text = question_text
    choices = payload.get("choices", [])
    if isinstance(choices, dict):
        choices = [value for key, value in choices.items() if key in {"A", "B", "C", "D"}]
    question.choices = choices
    question.correct_answer = str(payload["correct_answer"])
    question.explanation = payload.get("explanation") or payload.get("explanation_th")
    question.hint = payload.get("hint") or payload.get("hint_th")
    question.source = payload.get("source", "question_bank")
    question.status = "approved"
    question.metadata_json = {
        "external_id": question_id,
        "topic_code": payload.get("topic_code"),
        "topic_name_th": payload.get("topic_name_th"),
        "skill_code": payload.get("skill_code") or payload.get("topic_code"),
        "question_type": payload.get("question_type"),
        "routine_level": payload.get("routine_level"),
        "confidence_role": payload.get("confidence_role"),
        "estimated_time_seconds": payload.get("estimated_time_seconds"),
        "tags": payload.get("tags", []),
        "source": payload.get("source", "question_bank"),
    }
    return created, str(payload.get("topic_code") or payload.get("skill_code") or "unknown")


def import_question_banks(db: Session, bank_root: Path = QUESTION_BANK_ROOT) -> dict:
    subject = _subject(db)
    existing = _existing_questions(db)
    summary: dict[str, Any] = {"grades": {}, "created": 0, "updated": 0}
    for grade_dir in _available_bank_dirs(bank_root):
        grade = _grade_number(grade_dir)
        manifest_path = grade_dir / "manifest.json"
        if manifest_path.exists():
            _load_json(manifest_path)
        grade_summary = summary["grades"].setdefault(str(grade), {"files": 0, "questions": 0, "topics": {}})
        for path in sorted(grade_dir.glob("*.jsonl")):
            grade_summary["files"] += 1
            with path.open("r", encoding="utf-8-sig") as handle:
                for line_number, line in enumerate(handle, start=1):
                    if not line.strip():
                        continue
                    json_line = line.strip()
                    if json_line.endswith(","):
                        json_line = json_line[:-1]
                    if json_line.endswith(r",\n"):
                        json_line = json_line[:-3]
                    try:
                        payload = json.loads(json_line)
                    except json.JSONDecodeError as exc:
                        repaired = json_line + ("}" * max(0, json_line.count("{") - json_line.count("}")))
                        try:
                            payload = json.loads(repaired)
                        except json.JSONDecodeError:
                            raise QuestionBankImportError(f"Invalid JSONL in {path}:{line_number}: {exc}") from exc
                    created, topic = _upsert_question(db, subject, payload, existing)
                    summary["created"] += created
                    summary["updated"] += 0 if created else 1
                    grade_summary["questions"] += 1
                    grade_summary["topics"][topic] = grade_summary["topics"].get(topic, 0) + 1
    db.commit()
    return summary


def main() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_local_schema(engine)
    with Session(engine) as session:
        summary = import_question_banks(session)
    print("Question bank import complete")
    for grade, grade_summary in summary["grades"].items():
        print(f"Grade {grade}: {grade_summary['questions']} questions across {len(grade_summary['topics'])} topics")
    print(f"Created: {summary['created']}; Updated: {summary['updated']}")


if __name__ == "__main__":
    main()
