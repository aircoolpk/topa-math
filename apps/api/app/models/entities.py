from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.ext.mutable import MutableDict, MutableList
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.core.database import Base


def uuid_pk() -> Mapped[str]:
    return mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))


JsonDict = MutableDict.as_mutable(JSON().with_variant(JSONB, "postgresql"))
JsonList = MutableList.as_mutable(JSON().with_variant(JSONB, "postgresql"))
UuidArray = JSON().with_variant(ARRAY(UUID(as_uuid=False)), "postgresql")


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = uuid_pk()
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(20), default="parent")
    plan: Mapped[str] = mapped_column(String(40), default="free")
    plan_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    referral_token: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    referred_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    children: Mapped[list["ChildProfile"]] = relationship(back_populates="parent", cascade="all, delete-orphan")


class ChildProfile(Base, TimestampMixin):
    __tablename__ = "child_profiles"

    id: Mapped[str] = uuid_pk()
    parent_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    first_name: Mapped[str | None] = mapped_column(String(80))
    last_name: Mapped[str | None] = mapped_column(String(80))
    nickname: Mapped[str] = mapped_column(String(80))
    grade_level: Mapped[int] = mapped_column(Integer)
    province: Mapped[str | None] = mapped_column(String(120))
    district: Mapped[str | None] = mapped_column(String(120))
    school_name: Mapped[str | None] = mapped_column(String(180))
    school_province: Mapped[str | None] = mapped_column(String(120))
    school_district: Mapped[str | None] = mapped_column(String(120))
    student_photo_url: Mapped[str | None] = mapped_column(Text)
    student_photo_path: Mapped[str | None] = mapped_column(Text)
    avatar_gender: Mapped[str | None] = mapped_column(String(20))
    avatar_config: Mapped[dict] = mapped_column(JsonDict, default=dict)
    program_type: Mapped[str] = mapped_column(String(10), default="THP")
    membership_status: Mapped[str] = mapped_column(String(20), default="free")
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), index=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), index=True)
    subscription_status: Mapped[str] = mapped_column(String(40), default="none")
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    access_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    plan_code: Mapped[str] = mapped_column(String(40), default="free")
    plan_type: Mapped[str] = mapped_column(String(40), default="free")
    active_price_code: Mapped[str | None] = mapped_column(String(80))
    price_type: Mapped[str | None] = mapped_column(String(40))
    billing_program_type: Mapped[str | None] = mapped_column(String(10))
    admin_note: Mapped[str | None] = mapped_column(Text)
    manual_grant_reason: Mapped[str | None] = mapped_column(String(120))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    total_score: Mapped[int] = mapped_column(Integer, default=0)
    total_xp: Mapped[int] = mapped_column(Integer, default=0)
    coins: Mapped[int] = mapped_column(Integer, default=0)
    current_level: Mapped[int] = mapped_column(Integer, default=1)
    days_active: Mapped[int] = mapped_column(Integer, default=0)
    test_attempts_used: Mapped[int] = mapped_column(Integer, default=0)
    free_test_limit: Mapped[int] = mapped_column(Integer, default=5)
    total_tests_completed: Mapped[int] = mapped_column(Integer, default=0)
    average_test_accuracy: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    average_test_speed: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    current_rank_title: Mapped[str] = mapped_column(String(80), default="เด็กหลังห้อง")
    streak_count: Mapped[int] = mapped_column(Integer, default=0)
    last_active_date: Mapped[date | None] = mapped_column(Date)
    parent: Mapped[User] = relationship(back_populates="children")


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id: Mapped[str] = uuid_pk()
    action: Mapped[str] = mapped_column(String(80), index=True)
    target_user_id: Mapped[str | None] = mapped_column(String(36), index=True)
    old_value: Mapped[dict | None] = mapped_column(JsonDict, default=dict)
    new_value: Mapped[dict | None] = mapped_column(JsonDict, default=dict)
    changed_by_admin_id: Mapped[str | None] = mapped_column(String(36), index=True)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[str] = uuid_pk()
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(120))


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = uuid_pk()
    subject_id: Mapped[str] = mapped_column(ForeignKey("subjects.id"))
    grade_level: Mapped[int] = mapped_column(Integer)
    code: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    prerequisite_skill_ids: Mapped[list] = mapped_column(JsonList, default=list)
    difficulty_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Lesson(Base, TimestampMixin):
    __tablename__ = "lessons"

    id: Mapped[str] = uuid_pk()
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"))
    title: Mapped[str] = mapped_column(String(180))
    content: Mapped[dict] = mapped_column(JsonDict)
    source: Mapped[str] = mapped_column(String(20), default="human")
    status: Mapped[str] = mapped_column(String(20), default="draft")


class QuestTemplate(Base, TimestampMixin):
    __tablename__ = "quest_templates"

    id: Mapped[str] = uuid_pk()
    quest_id: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    grade_level: Mapped[int] = mapped_column(Integer)
    skill_code: Mapped[str | None] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str | None] = mapped_column(Text)
    quest_type: Mapped[str] = mapped_column(String(40), default="lesson")
    recurrence_type: Mapped[str] = mapped_column(String(20), default="none")
    xp_reward: Mapped[int] = mapped_column(Integer, default=0)
    coin_reward: Mapped[int] = mapped_column(Integer, default=0)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="active")
    lesson_id: Mapped[str | None] = mapped_column(ForeignKey("lessons.id"))
    quiz_id: Mapped[str | None] = mapped_column(String(120))
    metadata_json: Mapped[dict] = mapped_column("metadata", JsonDict, default=dict)


class LearningQuest(Base, TimestampMixin):
    __tablename__ = "learning_quests"

    id: Mapped[str] = uuid_pk()
    quest_id: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    grade_level: Mapped[int] = mapped_column(Integer)
    skill_code: Mapped[str | None] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str | None] = mapped_column(Text)
    quest_type: Mapped[str] = mapped_column(String(40), default="lesson")
    recurrence_type: Mapped[str] = mapped_column(String(20), default="none")
    xp_reward: Mapped[int] = mapped_column(Integer, default=0)
    coin_reward: Mapped[int] = mapped_column(Integer, default=0)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="active")
    lesson_id: Mapped[str | None] = mapped_column(ForeignKey("lessons.id"))
    quiz_id: Mapped[str | None] = mapped_column(String(120))
    metadata_json: Mapped[dict] = mapped_column("metadata", JsonDict, default=dict)


class RecurringQuestTemplate(Base, TimestampMixin):
    __tablename__ = "recurring_quest_templates"

    id: Mapped[str] = uuid_pk()
    quest_id: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    recurrence_type: Mapped[str] = mapped_column(String(20))
    grade_level: Mapped[int] = mapped_column(Integer)
    skill_code: Mapped[str | None] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str | None] = mapped_column(Text)
    quest_type: Mapped[str] = mapped_column(String(40), default="practice")
    xp_reward: Mapped[int] = mapped_column(Integer, default=0)
    coin_reward: Mapped[int] = mapped_column(Integer, default=0)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="active")
    lesson_id: Mapped[str | None] = mapped_column(ForeignKey("lessons.id"))
    quiz_id: Mapped[str | None] = mapped_column(String(120))
    metadata_json: Mapped[dict] = mapped_column("metadata", JsonDict, default=dict)


class ChildQuest(Base, TimestampMixin):
    __tablename__ = "child_quests"

    id: Mapped[str] = uuid_pk()
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"))
    quest_id: Mapped[str] = mapped_column(ForeignKey("learning_quests.id"))
    recurrence_type: Mapped[str] = mapped_column(String(20), default="none")
    period_key: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="not_started")
    progress_current: Mapped[int] = mapped_column(Integer, default=0)
    progress_target: Mapped[int] = mapped_column(Integer, default=1)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    xp_awarded: Mapped[int] = mapped_column(Integer, default=0)
    coin_awarded: Mapped[int] = mapped_column(Integer, default=0)
    score_awarded: Mapped[int] = mapped_column(Integer, default=0)


class CheckInEvent(Base):
    __tablename__ = "check_in_events"

    id: Mapped[str] = uuid_pk()
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"))
    event_date: Mapped[date] = mapped_column(Date)
    period_day: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LessonActivity(Base):
    __tablename__ = "lesson_activity"

    id: Mapped[str] = uuid_pk()
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"))
    lesson_id: Mapped[str] = mapped_column(String(120))
    activity_type: Mapped[str] = mapped_column(String(40), default="started")
    period_day: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LessonVariantView(Base):
    __tablename__ = "lesson_variant_views"

    id: Mapped[str] = uuid_pk()
    child_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"), index=True)
    lesson_id: Mapped[str] = mapped_column(String(120), index=True)
    variant_id: Mapped[str] = mapped_column(String(80))
    cycle_number: Mapped[int] = mapped_column(Integer, default=1)
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChildRecurringQuest(Base, TimestampMixin):
    __tablename__ = "child_recurring_quests"

    id: Mapped[str] = uuid_pk()
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"))
    recurring_quest_template_id: Mapped[str] = mapped_column(ForeignKey("recurring_quest_templates.id"))
    recurrence_type: Mapped[str] = mapped_column(String(20))
    period_key: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="not_started")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    xp_awarded: Mapped[int] = mapped_column(Integer, default=0)
    coin_awarded: Mapped[int] = mapped_column(Integer, default=0)


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = uuid_pk()
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"))
    grade_level: Mapped[int] = mapped_column(Integer)
    question_type: Mapped[str] = mapped_column(String(40))
    difficulty: Mapped[str] = mapped_column(String(20))
    question_text: Mapped[str] = mapped_column(Text)
    choices: Mapped[list | None] = mapped_column(JsonList)
    correct_answer: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str | None] = mapped_column(Text)
    hint: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="human")
    status: Mapped[str] = mapped_column(String(20), default="draft")
    metadata_json: Mapped[dict] = mapped_column("metadata", JsonDict, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LessonAccess(Base, TimestampMixin):
    __tablename__ = "lesson_access"

    id: Mapped[str] = uuid_pk()
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"))
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id"))
    access_type: Mapped[str] = mapped_column(String(20), default="review")
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TestSession(Base, TimestampMixin):
    __tablename__ = "test_sessions"

    id: Mapped[str] = uuid_pk()
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"))
    lesson_id: Mapped[str | None] = mapped_column(ForeignKey("lessons.id"))
    quiz_id: Mapped[str | None] = mapped_column(String(120))
    question_ids: Mapped[list] = mapped_column(JsonList, default=list)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    timer_seconds: Mapped[int] = mapped_column(Integer, default=300)
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    metadata_json: Mapped[dict] = mapped_column("metadata", JsonDict, default=dict)


class TestResult(Base, TimestampMixin):
    __tablename__ = "test_results"

    id: Mapped[str] = uuid_pk()
    test_session_id: Mapped[str] = mapped_column(ForeignKey("test_sessions.id", ondelete="CASCADE"))
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"))
    lesson_id: Mapped[str | None] = mapped_column(ForeignKey("lessons.id"))
    quiz_id: Mapped[str | None] = mapped_column(String(120))
    total_questions: Mapped[int] = mapped_column(Integer, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    accuracy: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    average_response_time_ms: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    total_time_ms: Mapped[int] = mapped_column(Integer, default=0)
    score_awarded: Mapped[int] = mapped_column(Integer, default=0)
    xp_awarded: Mapped[int] = mapped_column(Integer, default=0)


class PublicShare(Base, TimestampMixin):
    __tablename__ = "public_shares"

    id: Mapped[str] = uuid_pk()
    token: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    share_type: Mapped[str] = mapped_column(String(40), index=True)
    created_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    data: Mapped[dict] = mapped_column(JsonDict, default=dict)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ReferralEvent(Base):
    __tablename__ = "referral_events"

    id: Mapped[str] = uuid_pk()
    referrer_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    referred_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    referral_token: Mapped[str] = mapped_column(String(80), index=True)
    event_type: Mapped[str] = mapped_column(String(40), index=True)
    share_token: Mapped[str | None] = mapped_column(String(80), index=True)
    visitor_hash: Mapped[str | None] = mapped_column(String(96), index=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JsonDict, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CoinLedger(Base):
    __tablename__ = "coin_ledger"

    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(60), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    reference_id: Mapped[str | None] = mapped_column(String(120), index=True)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class QuestionAttemptHistory(Base):
    __tablename__ = "question_attempt_history"

    id: Mapped[str] = uuid_pk()
    child_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    lesson_id: Mapped[str | None] = mapped_column(String(120), index=True)
    grade_level: Mapped[int] = mapped_column(Integer, index=True)
    topic_code: Mapped[str | None] = mapped_column(String(120))
    skill_code: Mapped[str | None] = mapped_column(String(120))
    question_type: Mapped[str] = mapped_column(String(20), default="core")
    rotation_scope: Mapped[str] = mapped_column(String(40), index=True)
    rotation_key: Mapped[str] = mapped_column(String(160), index=True)
    cycle_number: Mapped[int] = mapped_column(Integer, default=1)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    last_is_correct: Mapped[bool | None] = mapped_column(Boolean)


class RankTitle(Base):
    __tablename__ = "rank_titles"

    id: Mapped[str] = uuid_pk()
    title: Mapped[str] = mapped_column(String(80), unique=True)
    min_score: Mapped[int] = mapped_column(Integer, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class StudentStats(Base, TimestampMixin):
    __tablename__ = "student_stats"

    id: Mapped[str] = uuid_pk()
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"), unique=True)
    lessons_completed: Mapped[int] = mapped_column(Integer, default=0)
    tests_completed: Mapped[int] = mapped_column(Integer, default=0)
    quests_completed: Mapped[int] = mapped_column(Integer, default=0)
    checkins: Mapped[int] = mapped_column(Integer, default=0)
    perfect_tests: Mapped[int] = mapped_column(Integer, default=0)


class QuizSession(Base):
    __tablename__ = "quiz_sessions"

    id: Mapped[str] = uuid_pk()
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"))
    subject_id: Mapped[str] = mapped_column(ForeignKey("subjects.id"))
    mode: Mapped[str] = mapped_column(String(40))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    total_questions: Mapped[int] = mapped_column(Integer, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    total_xp_earned: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[dict] = mapped_column("metadata", JsonDict, default=dict)


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"

    id: Mapped[str] = uuid_pk()
    quiz_session_id: Mapped[str] = mapped_column(ForeignKey("quiz_sessions.id", ondelete="CASCADE"))
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"))
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id"))
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"))
    selected_answer: Mapped[str | None] = mapped_column(Text)
    selected_answer_raw: Mapped[str | None] = mapped_column(Text)
    selected_answer_normalized: Mapped[str | None] = mapped_column(Text)
    correct_answer_normalized: Mapped[str | None] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean)
    response_time_ms: Mapped[int | None] = mapped_column(Integer)
    hint_used: Mapped[bool] = mapped_column(Boolean, default=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=1)
    mistake_type: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SkillMastery(Base):
    __tablename__ = "skill_mastery"

    id: Mapped[str] = uuid_pk()
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"))
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"))
    mastery_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    mastery_level: Mapped[str] = mapped_column(String(40), default="needs_help")
    last_practiced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    incorrect_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_response_time_ms: Mapped[int | None] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class XPEvent(Base):
    __tablename__ = "xp_events"

    id: Mapped[str] = uuid_pk()
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"))
    source_type: Mapped[str] = mapped_column(String(80))
    source_id: Mapped[str | None] = mapped_column(String(36))
    xp_amount: Mapped[int] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[str] = uuid_pk()
    code: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    icon_url: Mapped[str | None] = mapped_column(Text)


class ChildBadge(Base):
    __tablename__ = "child_badges"

    id: Mapped[str] = uuid_pk()
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"))
    badge_id: Mapped[str] = mapped_column(ForeignKey("badges.id"))
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RankSnapshot(Base):
    __tablename__ = "rank_snapshots"

    id: Mapped[str] = uuid_pk()
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"))
    subject_id: Mapped[str] = mapped_column(ForeignKey("subjects.id"))
    grade_level: Mapped[int] = mapped_column(Integer)
    province: Mapped[str | None] = mapped_column(String(120))
    rank_scope: Mapped[str] = mapped_column(String(20))
    period_type: Mapped[str] = mapped_column(String(20))
    period_start: Mapped[date | None] = mapped_column(Date)
    period_end: Mapped[date | None] = mapped_column(Date)
    mastery_points: Mapped[float] = mapped_column(Numeric(8, 2))
    speed_points: Mapped[float] = mapped_column(Numeric(8, 2))
    improvement_points: Mapped[float] = mapped_column(Numeric(8, 2))
    rank_score: Mapped[float] = mapped_column(Numeric(8, 2))
    rank_position: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AIGenerationJob(Base):
    __tablename__ = "ai_generation_jobs"

    id: Mapped[str] = uuid_pk()
    child_profile_id: Mapped[str | None] = mapped_column(ForeignKey("child_profiles.id"))
    skill_id: Mapped[str | None] = mapped_column(ForeignKey("skills.id"))
    job_type: Mapped[str] = mapped_column(String(80))
    input_payload: Mapped[dict] = mapped_column(JsonDict)
    output_payload: Mapped[dict | None] = mapped_column(JsonDict)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AvatarItem(Base):
    __tablename__ = "avatar_items"

    id: Mapped[str] = uuid_pk()
    code: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    item_type: Mapped[str] = mapped_column(String(40))
    rarity: Mapped[str] = mapped_column(String(40), default="common")
    asset_url: Mapped[str | None] = mapped_column(Text)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChildInventory(Base):
    __tablename__ = "child_inventory"

    id: Mapped[str] = uuid_pk()
    child_profile_id: Mapped[str] = mapped_column(ForeignKey("child_profiles.id", ondelete="CASCADE"))
    avatar_item_id: Mapped[str] = mapped_column(ForeignKey("avatar_items.id"))
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
