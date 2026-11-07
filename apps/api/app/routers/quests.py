from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Badge, ChildBadge, ChildProfile, ChildQuest, LearningQuest, Lesson, Skill, User, XPEvent
from app.routers.deps import current_user
from app.schemas.api import QuestActionOut, QuestOut
from app.services.badges import badge_meta
from app.services.foundation import is_paid
from app.services.rank_titles import next_rank_title_for_score, rank_title_for_score
from app.services.ranking import rank_position
from app.services.xp import level_from_total_xp, level_progress

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
    # is_paid() accepts every entitled membership tier (paid / plus / trial),
    # so Plus members are no longer locked out of current-grade lessons.
    entitled = is_paid(child)
    is_locked = not entitled and lesson_type != "review"
    title = content.get("title_th") or lesson.title
    linked_quiz_id = content.get("quiz_id") or content.get("linked_quiz_id")
    return {
        "id": lesson.id,
        "title_th": title,
        # Aliases expected by the web client (CourseMapItem).
        "title": title,
        "grade": skill.grade_level,
        "lesson_id": lesson.id,
        "quiz_id": linked_quiz_id,
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
        "linked_quiz_id": linked_quiz_id,
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
    earned_rows = db.scalars(
        select(ChildBadge).where(ChildBadge.child_profile_id == child.id)
    ).all()
    if not earned_rows:
        return []
    earned_at_by_badge = {row.badge_id: row.awarded_at for row in earned_rows}
    badges = db.scalars(select(Badge).where(Badge.id.in_(list(earned_at_by_badge)))).all()
    payload = []
    for badge in badges:
        meta = badge_meta(badge.code)
        earned_at = earned_at_by_badge.get(badge.id)
        payload.append(
            {
                "id": badge.id,
                "code": badge.code,
                "name": badge.name,
                "name_th": meta.name_th or badge.name,
                "description": badge.description,
                "icon": badge.icon_url or meta.icon,
                "icon_url": badge.icon_url or meta.icon,
                "category": meta.category,
                "earned": True,
                "earned_at": earned_at.isoformat() if earned_at else None,
            }
        )
    payload.sort(key=lambda item: item["code"])
    return payload


@router.get("/rank-summary")
def rank_summary(child_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    child = _child_for_user(child_id, user, db)
    score_for_title = child.total_score or child.total_xp
    child.current_rank_title = rank_title_for_score(score_for_title)
    db.commit()

    level, xp_into_level, xp_to_next_level = level_progress(child.total_xp)
    province_rank, _province_total = rank_position(db, child, scope="province", province=child.province)
    country_rank, country_total = rank_position(db, child, scope="country")
    return {
        "province_rank": province_rank,
        "country_rank": country_rank,
        "total_in_country": country_total,
        "rank_title": child.current_rank_title,
        "current_rank": child.current_rank_title,
        "next_rank": next_rank_title_for_score(score_for_title),
        "total_score": child.total_score,
        "total_xp": child.total_xp,
        "level": level,
        "xp_into_level": xp_into_level,
        "xp_to_next_rank": xp_to_next_level,
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
            "reason_th": "แนะนำภารกิจที่ยังทำไม่เสร็จสำหรับวันนี้",
            # Aliases expected by the web client (RecommendedNextQuest).
            "title": quest.title,
            "description": quest.description,
            "skill_code": quest.skill_code,
            "grade_level": quest.grade_level,
            "estimated_minutes": quest.estimated_minutes,
            "lesson_id": quest.lesson_id,
            "quiz_id": quest.quiz_id,
            "quest_type": quest.recurrence_type if quest.recurrence_type != "none" else quest.quest_type,
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
        "reason_th": "ภารกิจพร้อมใช้งานถูกทำครบแล้ว",
        "title": "ยังไม่มีภารกิจแนะนำ",
        "description": "ทำได้ดีมาก ลองกลับมาใหม่ภายหลัง",
        "skill_code": None,
        "grade_level": child.grade_level,
        "estimated_minutes": None,
        "lesson_id": None,
        "quiz_id": None,
        "quest_type": "daily",
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
