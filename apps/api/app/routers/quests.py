from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Badge, ChildBadge, ChildProfile, ChildQuest, LearningQuest, Lesson, Skill, User, XPEvent
from app.routers.deps import current_user
from app.schemas.api import QuestActionOut, QuestOut
from app.services.rank_titles import rank_title_for_score
from app.services.xp import level_from_total_xp

router = APIRouter(prefix="/children/{child_id}", tags=["quests"])


def _child_for_user(child_id: str, user: User, db: Session) -> ChildProfile:
    child = db.get(ChildProfile, child_id)
    if not child or child.parent_user_id != user.id:
        raise HTTPException(status_code=404, detail="Child not found")
    return child


def _child_quest(child_id: str, quest_db_id: str, db: Session) -> ChildQuest | None:
    return db.scalar(
        select(ChildQuest).where(
            ChildQuest.child_profile_id == child_id,
            ChildQuest.quest_id == quest_db_id,
        )
    )


def _quest_to_out(quest: LearningQuest, child_quest: ChildQuest | None = None) -> QuestOut:
    progress_current = child_quest.progress_current if child_quest else 0
    progress_total = child_quest.progress_target if child_quest else int((quest.metadata_json or {}).get("target_count", 1))
    progress_percent = round((progress_current / progress_total) * 100, 2) if progress_total else 0
    child_status = child_quest.status if child_quest else "not_started"
    return QuestOut(
        id=quest.id,
        quest_id=quest.quest_id,
        grade_level=quest.grade_level,
        skill_code=quest.skill_code,
        title=quest.title,
        description=quest.description,
        quest_type=quest.quest_type,
        recurrence_type=quest.recurrence_type,
        xp_reward=quest.xp_reward,
        coin_reward=quest.coin_reward,
        estimated_minutes=quest.estimated_minutes,
        status=quest.status,
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


def _list_quests(child_id: str, recurrence_type: str | None, db: Session, user: User) -> list[QuestOut]:
    child = _child_for_user(child_id, user, db)
    query = select(LearningQuest).where(
        LearningQuest.grade_level == child.grade_level,
        LearningQuest.status == "active",
    )
    if recurrence_type is not None:
        query = query.where(LearningQuest.recurrence_type == recurrence_type)
    quests = db.scalars(query.order_by(LearningQuest.grade_level, LearningQuest.quest_id)).all()
    child_quests = {
        row.quest_id: row
        for row in db.scalars(select(ChildQuest).where(ChildQuest.child_profile_id == child.id)).all()
    }
    return [_quest_to_out(quest, child_quests.get(quest.id)) for quest in quests]


def _course_map_item(lesson: Lesson, skill: Skill, child: ChildProfile) -> dict:
    content = lesson.content or {}
    lesson_type = "review" if skill.grade_level < child.grade_level else "current"
    is_locked = child.membership_status not in {"paid"} and lesson_type != "review"
    return {
        "id": lesson.id,
        "title_th": content.get("title_th") or lesson.title,
        "topic_code": content.get("topic_code") or skill.code,
        "skill_code": skill.code,
        "grade_level": skill.grade_level,
        "lesson_type": lesson_type,
        "estimated_minutes": content.get("estimated_minutes", 5),
        "difficulty": content.get("difficulty", "easy"),
        "xp_reward": content.get("xp_reward", 50),
        "is_locked": is_locked,
        "lock_reason": "Free users can access review lessons only" if is_locked else None,
        "status": "locked" if is_locked else "available",
        "linked_lesson_id": lesson.id,
        "linked_quiz_id": content.get("quiz_id") or content.get("linked_quiz_id"),
    }


@router.get("/quests", response_model=list[QuestOut])
def quests(child_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[QuestOut]:
    return _list_quests(child_id, None, db, user)


@router.get("/daily-quests", response_model=list[QuestOut])
def daily_quests(child_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[QuestOut]:
    return _list_quests(child_id, "daily", db, user)


@router.get("/weekly-quests", response_model=list[QuestOut])
def weekly_quests(child_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[QuestOut]:
    return _list_quests(child_id, "weekly", db, user)


@router.get("/monthly-quests", response_model=list[QuestOut])
def monthly_quests(child_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[QuestOut]:
    return _list_quests(child_id, "monthly", db, user)


@router.get("/badges")
def child_badges(child_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[dict]:
    child = _child_for_user(child_id, user, db)
    earned_badge_ids = {
        row.badge_id
        for row in db.scalars(select(ChildBadge).where(ChildBadge.child_profile_id == child.id)).all()
    }
    badges = db.scalars(select(Badge).order_by(Badge.code)).all()
    return [
        {
            "code": badge.code,
            "name": badge.name,
            "description": badge.description,
            "icon": badge.icon_url or "🏅",
            "earned": badge.id in earned_badge_ids,
        }
        for badge in badges
    ]


@router.get("/rank-summary")
def rank_summary(child_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _child_for_user(child_id, user, db)
    score_for_title = child.total_score or child.total_xp
    child.current_rank_title = rank_title_for_score(score_for_title)
    db.commit()
    return {
        "province_rank": None,
        "country_rank": None,
        "rank_title": child.current_rank_title,
        "total_score": child.total_score,
        "total_xp": child.total_xp,
        "average_accuracy": float(child.average_test_accuracy or 0) if child.total_tests_completed else None,
        "average_speed_seconds": round(float(child.average_test_speed or 0) / 1000, 2) if child.total_tests_completed else None,
    }


@router.get("/course-map")
def course_map(child_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _child_for_user(child_id, user, db)
    allowed_grades = {child.grade_level}
    if child.grade_level > 1:
        allowed_grades.add(child.grade_level - 1)
    rows = db.execute(
        select(Lesson, Skill)
        .join(Skill, Lesson.skill_id == Skill.id)
        .where(Lesson.status == "approved", Skill.grade_level.in_(allowed_grades))
        .order_by(Skill.grade_level, Skill.difficulty_order, Lesson.title)
    ).all()
    return {"current_grade": child.grade_level, "items": [_course_map_item(lesson, skill, child) for lesson, skill in rows]}


@router.get("/recommended-next-quest")
def recommended_next_quest(child_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _child_for_user(child_id, user, db)
    quests = db.scalars(
        select(LearningQuest).where(
            LearningQuest.grade_level == child.grade_level,
            LearningQuest.status == "active",
        )
    ).all()
    child_quests = {
        row.quest_id: row
        for row in db.scalars(select(ChildQuest).where(ChildQuest.child_profile_id == child.id)).all()
    }
    ordered = sorted(
        quests,
        key=lambda quest: (
            0 if quest.recurrence_type == "daily" else 1 if quest.quest_type == "weak_skill" else 2,
            quest.quest_id,
        ),
    )
    for quest in ordered:
        row = child_quests.get(quest.id)
        if row and row.status == "completed":
            continue
        out = _quest_to_out(quest, row)
        return {
            "quest_id": quest.quest_id,
            "title_th": quest.title,
            "description_th": quest.description,
            "quest_type": quest.recurrence_type if quest.recurrence_type != "none" else quest.quest_type,
            "reason_th": "แนะนำภารกิจที่ยังทำไม่เสร็จสำหรับวันนี้",
            "xp_reward": quest.xp_reward,
            "coin_reward": quest.coin_reward,
            "progress_current": out.progress_current,
            "progress_total": out.progress_total,
            "status": "in_progress" if row and row.status == "in_progress" else "available",
        }
    return {
        "quest_id": None,
        "title_th": "ยังไม่มีภารกิจแนะนำ",
        "description_th": "ทำได้ดีมาก ลองกลับมาใหม่ภายหลัง",
        "quest_type": "daily",
        "reason_th": "ภารกิจพร้อมใช้งานถูกทำครบแล้ว",
        "xp_reward": 0,
        "coin_reward": 0,
        "progress_current": 0,
        "progress_total": 1,
        "status": "completed",
    }


@router.post("/quests/{quest_id}/start", response_model=QuestActionOut)
def start_quest(
    child_id: str,
    quest_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> QuestActionOut:
    child = _child_for_user(child_id, user, db)
    quest = db.scalar(select(LearningQuest).where(LearningQuest.quest_id == quest_id, LearningQuest.grade_level == child.grade_level))
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    child_quest = _child_quest(child.id, quest.id, db)
    if not child_quest:
        child_quest = ChildQuest(
            child_profile_id=child.id,
            quest_id=quest.id,
            recurrence_type=quest.recurrence_type,
            status="in_progress",
            started_at=datetime.utcnow(),
            progress_target=int((quest.metadata_json or {}).get("target_count", 1)),
        )
        db.add(child_quest)
    elif child_quest.status == "not_started":
        child_quest.status = "in_progress"
        child_quest.started_at = datetime.utcnow()
    db.commit()
    db.refresh(child_quest)
    return QuestActionOut(quest=_quest_to_out(quest, child_quest), total_xp=child.total_xp, total_score=child.total_score, coins=child.coins, current_level=level_from_total_xp(child.total_xp))


@router.post("/quests/{quest_id}/complete", response_model=QuestActionOut)
def complete_quest(
    child_id: str,
    quest_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> QuestActionOut:
    child = _child_for_user(child_id, user, db)
    quest = db.scalar(select(LearningQuest).where(LearningQuest.quest_id == quest_id, LearningQuest.grade_level == child.grade_level))
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    child_quest = _child_quest(child.id, quest.id, db)
    if not child_quest:
        child_quest = ChildQuest(
            child_profile_id=child.id,
            quest_id=quest.id,
            recurrence_type=quest.recurrence_type,
            status="in_progress",
            started_at=datetime.utcnow(),
            progress_target=int((quest.metadata_json or {}).get("target_count", 1)),
        )
        db.add(child_quest)
        db.flush()
    if child_quest.status != "completed":
        child_quest.status = "completed"
        child_quest.completed_at = datetime.utcnow()
        child_quest.xp_awarded = quest.xp_reward
        child_quest.coin_awarded = quest.coin_reward
        child_quest.score_awarded = int((quest.metadata_json or {}).get("score_reward", quest.xp_reward))
        child.total_xp += quest.xp_reward
        child.coins += quest.coin_reward
        child.total_score += child_quest.score_awarded
        child.current_level = level_from_total_xp(child.total_xp)
        db.add(
            XPEvent(
                child_profile_id=child.id,
                source_type="quest_complete",
                source_id=quest.quest_id,
                xp_amount=quest.xp_reward,
                description=quest.title,
            )
        )
    db.commit()
    db.refresh(child)
    db.refresh(child_quest)
    return QuestActionOut(quest=_quest_to_out(quest, child_quest), total_xp=child.total_xp, total_score=child.total_score, coins=child.coins, current_level=child.current_level)
