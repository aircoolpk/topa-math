import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import (
    ChildProfile,
    Lesson,
    Question,
    QuizAnswer,
    QuizSession,
    Skill,
    SkillMastery,
    Subject,
    XPEvent,
)
from app.routers.deps import current_user
from app.schemas.api import PersonalizedPracticeIn, QuizAnswerIn
from app.services.answers import answer_match_details
from app.services.ai_provider import MockAIProvider
from app.services.ai_validation import validate_generated_practice
from app.services.mastery import AnswerResult, calculate_mastery_score, infer_mistake_type, mastery_level
from app.services.xp import XP_SOURCES, level_from_total_xp

router = APIRouter(tags=["learning"])
RATIO_POLICY = "80_core_20_challenge"


def question_payload(question: Question) -> dict:
    return {
        "id": question.id,
        "skill_id": question.skill_id,
        "grade_level": question.grade_level,
        "question_type": question.question_type,
        "difficulty": question.difficulty,
        "question_text": question.question_text,
        "choices": question.choices or [],
        "correct_answer": question.correct_answer,
        "explanation": question.explanation,
        "hint": question.hint,
    }


def _placement_questions(db: Session, grade_level: int, limit: int = 25) -> list[Question]:
    rows = db.scalars(
        select(Question).where(Question.grade_level == grade_level, Question.status == "approved")
    ).all()
    return _select_ratio_questions(rows, limit)


def _challenge_role(question: Question) -> str:
    metadata = question.metadata_json or {}
    question_type = str(metadata.get("question_type") or "").lower()
    routine_level = str(metadata.get("routine_level") or "").lower()
    confidence_role = str(metadata.get("confidence_role") or "").lower()
    if question_type == "challenge" or routine_level == "non_routine" or confidence_role == "stretch_thinking":
        return "challenge"
    return "core"


def _ratio_counts(limit: int) -> tuple[int, int]:
    if limit < 5:
        return limit, 0
    challenge_count = int((limit * 0.20) + 0.5)
    return limit - challenge_count, challenge_count


def _balanced(rows: list[Question], limit: int) -> list[Question]:
    random.shuffle(rows)
    buckets: dict[tuple[str, str], list[Question]] = {}
    for question in rows:
        buckets.setdefault((question.skill_id, question.difficulty), []).append(question)
    selected: list[Question] = []
    seen: set[str] = set()
    while len(selected) < limit and buckets:
        progressed = False
        for key in list(buckets.keys()):
            bucket = buckets[key]
            while bucket:
                question = bucket.pop()
                if question.id not in seen:
                    selected.append(question)
                    seen.add(question.id)
                    progressed = True
                    break
            if not bucket:
                buckets.pop(key, None)
            if len(selected) >= limit:
                break
        if not progressed:
            break
    return selected


def _select_ratio_questions(rows: list[Question], limit: int) -> list[Question]:
    core_target, challenge_target = _ratio_counts(limit)
    core = [question for question in rows if _challenge_role(question) == "core"]
    challenge = [question for question in rows if _challenge_role(question) == "challenge"]
    selected = _balanced(challenge, challenge_target) + _balanced(core, core_target)
    selected_ids = {question.id for question in selected}
    if len(selected) < limit:
        selected.extend(question for question in _balanced(rows, limit) if question.id not in selected_ids)
    random.shuffle(selected)
    return selected[:limit]


def _ratio_metadata(questions: list[Question]) -> dict:
    return {
        "core_question_count": sum(1 for question in questions if _challenge_role(question) == "core"),
        "challenge_question_count": sum(1 for question in questions if _challenge_role(question) == "challenge"),
        "ratio_policy": RATIO_POLICY,
    }


@router.get("/subjects")
def subjects(db: Session = Depends(get_db)):
    return db.scalars(select(Subject)).all()


@router.get("/skills")
def skills(subject: str = "math", grade_level: int = 1, db: Session = Depends(get_db)):
    subject_row = db.scalar(select(Subject).where(Subject.code == subject))
    if not subject_row:
        return []
    return db.scalars(select(Skill).where(Skill.subject_id == subject_row.id, Skill.grade_level == grade_level)).all()


@router.post("/children/{child_id}/placement/start")
def start_placement(child_id: str, db: Session = Depends(get_db), _user=Depends(current_user)):
    child = db.get(ChildProfile, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    subject = db.scalar(select(Subject).where(Subject.code == "math"))
    questions = _placement_questions(db, child.grade_level, limit=25)
    session = QuizSession(
        child_profile_id=child.id,
        subject_id=subject.id,
        mode="placement",
        total_questions=len(questions),
        metadata_json={"question_ids": [question.id for question in questions], **_ratio_metadata(questions)},
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": session.id, "questions": [question_payload(question) for question in questions]}


@router.post("/quiz-sessions/{session_id}/answer")
def answer_question(session_id: str, payload: QuizAnswerIn, db: Session = Depends(get_db), _user=Depends(current_user)):
    session = db.get(QuizSession, session_id)
    question = db.get(Question, payload.question_id)
    if not session or not question:
        raise HTTPException(status_code=404, detail="Session or question not found")
    previous_incorrect = db.scalar(
        select(QuizAnswer).where(
            QuizAnswer.child_profile_id == session.child_profile_id,
            QuizAnswer.skill_id == question.skill_id,
            QuizAnswer.is_correct.is_(False),
        )
    )
    match = answer_match_details(question, payload.selected_answer)
    is_correct = match["is_correct"]
    answer = QuizAnswer(
        quiz_session_id=session.id,
        child_profile_id=session.child_profile_id,
        question_id=question.id,
        skill_id=question.skill_id,
        selected_answer=payload.selected_answer,
        selected_answer_raw=match["selected_answer_raw"],
        selected_answer_normalized=match["selected_answer_normalized"],
        correct_answer_normalized=match["correct_answer_normalized"],
        is_correct=is_correct,
        response_time_ms=payload.response_time_ms,
        hint_used=payload.hint_used,
        attempt_count=payload.attempt_count,
        mistake_type=infer_mistake_type(is_correct, payload.response_time_ms, 2 if previous_incorrect else 0),
    )
    db.add(answer)
    if is_correct:
        child = db.get(ChildProfile, session.child_profile_id)
        child.total_xp += XP_SOURCES["correct_answer"]
        child.current_level = level_from_total_xp(child.total_xp)
        db.add(XPEvent(child_profile_id=child.id, source_type="correct_answer", source_id=question.id, xp_amount=5))
    db.commit()
    return {"is_correct": is_correct, "correct_answer": question.correct_answer, "mistake_type": answer.mistake_type}


@router.post("/quiz-sessions/{session_id}/complete")
def complete_session(session_id: str, db: Session = Depends(get_db), _user=Depends(current_user)):
    session = db.get(QuizSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    answers = db.scalars(select(QuizAnswer).where(QuizAnswer.quiz_session_id == session.id)).all()
    session.completed_at = datetime.utcnow()
    session.total_questions = len(answers)
    session.correct_count = sum(1 for answer in answers if answer.is_correct)
    by_skill: dict[str, list[AnswerResult]] = {}
    for answer in answers:
        by_skill.setdefault(answer.skill_id, []).append(AnswerResult(answer.is_correct, answer.response_time_ms or 0))
    mastery_summary = []
    for skill_id, results in by_skill.items():
        score = calculate_mastery_score(results)
        row = db.scalar(select(SkillMastery).where(SkillMastery.child_profile_id == session.child_profile_id, SkillMastery.skill_id == skill_id))
        if not row:
            row = SkillMastery(
                child_profile_id=session.child_profile_id,
                skill_id=skill_id,
                correct_count=0,
                incorrect_count=0,
            )
            db.add(row)
        row.mastery_score = score
        row.mastery_level = mastery_level(score)
        row.correct_count = (row.correct_count or 0) + sum(1 for result in results if result.is_correct)
        row.incorrect_count = (row.incorrect_count or 0) + sum(1 for result in results if not result.is_correct)
        row.avg_response_time_ms = int(sum(result.response_time_ms for result in results) / len(results))
        row.last_practiced_at = datetime.utcnow()
        mastery_summary.append({"skill_id": skill_id, "mastery_score": score, "mastery_level": row.mastery_level})
    db.commit()
    return {"session_id": session.id, "correct_count": session.correct_count, "mastery": mastery_summary}


@router.get("/lessons/{lesson_id}")
def get_lesson(lesson_id: str, db: Session = Depends(get_db), _user=Depends(current_user)):
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


@router.get("/children/{child_id}/skill-mastery")
def skill_mastery(child_id: str, db: Session = Depends(get_db), _user=Depends(current_user)):
    return db.scalars(select(SkillMastery).where(SkillMastery.child_profile_id == child_id)).all()


@router.get("/children/{child_id}/progress")
def progress(child_id: str, db: Session = Depends(get_db), _user=Depends(current_user)):
    child = db.get(ChildProfile, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    return {
        "total_xp": child.total_xp,
        "coins": child.coins,
        "current_level": level_from_total_xp(child.total_xp),
        "streak_count": child.streak_count,
    }


@router.post("/children/{child_id}/personalized-practice/generate")
async def generate_practice(child_id: str, payload: PersonalizedPracticeIn, db: Session = Depends(get_db), _user=Depends(current_user)):
    provider = MockAIProvider()
    output = await provider.generate_practice(payload.model_dump())
    practice = validate_generated_practice(output, expected_skill_id=payload.skill_id, expected_difficulty=payload.target_difficulty)
    return practice.model_dump()
