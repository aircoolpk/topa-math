from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ChildProfile, ChildQuest, LearningQuest, StudentStats, XPEvent
from app.services.rank_titles import rank_title_for_score
from app.services.xp import level_from_total_xp


def get_or_create_stats(db: Session, child: ChildProfile) -> StudentStats:
    stats = db.scalar(select(StudentStats).where(StudentStats.child_profile_id == child.id))
    if not stats:
        stats = StudentStats(child_profile_id=child.id)
        db.add(stats)
        db.flush()
    return stats


def refresh_rank(child: ChildProfile) -> None:
    child.current_level = level_from_total_xp(child.total_xp)
    child.current_rank_title = rank_title_for_score(child.total_score)


def award_progress(
    db: Session,
    child: ChildProfile,
    *,
    source_type: str,
    source_id: str | None,
    xp: int,
    score: int,
    coins: int = 0,
    description: str | None = None,
) -> None:
    child.total_xp += xp
    child.total_score += score
    child.coins += coins
    refresh_rank(child)
    db.add(XPEvent(child_profile_id=child.id, source_type=source_type, source_id=source_id, xp_amount=xp, description=description))


def period_key(recurrence_type: str, today: date | None = None) -> str:
    today = today or date.today()
    if recurrence_type == "weekly":
        year, week, _ = today.isocalendar()
        return f"{year}-W{week:02d}"
    if recurrence_type == "monthly":
        return today.strftime("%Y-%m")
    return today.isoformat()


def quest_target(quest: LearningQuest) -> int:
    metadata = quest.metadata_json or {}
    return int(metadata.get("target_count", 1))


def quest_action(quest: LearningQuest) -> str:
    metadata = quest.metadata_json or {}
    return str(metadata.get("action_type", quest.quest_type))


def get_or_create_child_quest(db: Session, child: ChildProfile, quest: LearningQuest) -> ChildQuest:
    key = period_key(quest.recurrence_type) if quest.recurrence_type != "none" else None
    query = select(ChildQuest).where(ChildQuest.child_profile_id == child.id, ChildQuest.quest_id == quest.id)
    if key:
        query = query.where(ChildQuest.period_key == key)
    child_quest = db.scalar(query)
    if not child_quest:
        child_quest = ChildQuest(
            child_profile_id=child.id,
            quest_id=quest.id,
            recurrence_type=quest.recurrence_type,
            period_key=key,
            progress_current=0,
            progress_target=quest_target(quest),
        )
        db.add(child_quest)
        db.flush()
    return child_quest


def apply_quest_progress(db: Session, child: ChildProfile, action_type: str, increment: int = 1) -> None:
    quests = db.scalars(
        select(LearningQuest).where(
            LearningQuest.grade_level == child.grade_level,
            LearningQuest.status == "active",
        )
    ).all()
    for quest in quests:
        if (quest.metadata_json or {}).get("fixed"):
            continue
        if quest_action(quest) != action_type:
            continue
        child_quest = get_or_create_child_quest(db, child, quest)
        if child_quest.status == "completed":
            continue
        child_quest.progress_current = min(child_quest.progress_target, child_quest.progress_current + increment)
        if child_quest.progress_current >= child_quest.progress_target:
            complete_child_quest(db, child, quest, child_quest)


def complete_child_quest(db: Session, child: ChildProfile, quest: LearningQuest, child_quest: ChildQuest | None = None) -> ChildQuest:
    child_quest = child_quest or get_or_create_child_quest(db, child, quest)
    if child_quest.status != "completed":
        child_quest.status = "completed"
        child_quest.completed_at = datetime.utcnow()
        child_quest.progress_current = max(child_quest.progress_current, child_quest.progress_target)
        child_quest.xp_awarded = quest.xp_reward
        child_quest.coin_awarded = quest.coin_reward
        child_quest.score_awarded = int((quest.metadata_json or {}).get("score_reward", quest.xp_reward))
        stats = get_or_create_stats(db, child)
        stats.quests_completed += 1
        award_progress(
            db,
            child,
            source_type="quest_complete",
            source_id=quest.quest_id,
            xp=quest.xp_reward,
            score=child_quest.score_awarded,
            coins=quest.coin_reward,
            description=quest.title,
        )
    return child_quest
