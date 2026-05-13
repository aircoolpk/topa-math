from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=8)


class UserOut(BaseModel):
    id: str
    email: str
    role: str


class LoginIn(BaseModel):
    email: str
    password: str


class ChildCreate(BaseModel):
    first_name: str | None = Field(default=None, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)
    nickname: str = Field(min_length=1, max_length=80)
    grade_level: int = Field(ge=1, le=6)
    province: str | None = None
    district: str | None = None
    school_name: str | None = None
    school_province: str | None = None
    school_district: str | None = None
    student_photo_url: str | None = None
    student_photo_path: str | None = None
    avatar_gender: Literal["girl", "boy"] | None = None
    avatar_config: dict = Field(default_factory=dict)
    program_type: Literal["THP", "EP"] = "THP"
    membership_status: Literal["free", "trial", "paid", "plus"] = "free"


class ChildUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)
    nickname: str | None = Field(default=None, min_length=1, max_length=80)
    grade_level: int | None = Field(default=None, ge=1, le=6)
    province: str | None = None
    district: str | None = None
    school_name: str | None = None
    school_province: str | None = None
    school_district: str | None = None
    student_photo_url: str | None = None
    student_photo_path: str | None = None
    avatar_gender: Literal["girl", "boy"] | None = None
    avatar_config: dict | None = None
    program_type: Literal["THP", "EP"] | None = None
    membership_status: Literal["free", "trial", "paid", "plus"] | None = None


class ChildOut(BaseModel):
    id: str
    first_name: str | None
    last_name: str | None
    nickname: str
    grade_level: int
    province: str | None
    district: str | None
    school_name: str | None
    school_province: str | None
    school_district: str | None
    student_photo_url: str | None
    student_photo_path: str | None
    avatar_gender: str | None
    avatar_config: dict
    program_type: str
    membership_status: str
    total_score: int
    total_xp: int
    coins: int
    current_level: int
    days_active: int
    test_attempts_used: int
    free_test_limit: int
    total_tests_completed: int
    average_test_accuracy: float
    average_test_speed: float
    current_rank_title: str
    streak_count: int
    created_at: datetime
    updated_at: datetime


class MeTestStartIn(BaseModel):
    grade_level: int = Field(ge=1, le=6)
    mode: Literal["foundation", "placement", "quiz", "review", "lesson", "free_practice"] | None = None
    session_type: Literal["placement", "quiz", "foundation", "review", "lesson"] | None = None


class MeTestAnswerIn(BaseModel):
    question_id: str
    selected_answer: str
    response_time_ms: int = Field(default=0, ge=0)


class MeTestSubmitIn(BaseModel):
    answers: list[MeTestAnswerIn]
    total_time_ms: int = Field(default=0, ge=0)


class MeQuestionSubmitIn(BaseModel):
    question_id: str
    selected_answer: str
    response_time_ms: int = Field(default=0, ge=0)


class QuizAnswerIn(BaseModel):
    question_id: str
    selected_answer: str
    response_time_ms: int = Field(ge=0)
    hint_used: bool = False
    attempt_count: int = Field(default=1, ge=1)


class PersonalizedPracticeIn(BaseModel):
    grade_level: int = Field(ge=1, le=6)
    skill_id: str
    mastery_score: float = Field(ge=0, le=100)
    mistake_type: str = "calculation_error"
    recent_wrong_answers: list[str] = []
    target_difficulty: str = "easy"
    language_style: str = "child-friendly Thai"


class QuestOut(BaseModel):
    id: str
    quest_id: str
    grade_level: int
    skill_code: str | None
    title: str
    title_th: str | None = None
    description: str | None
    description_th: str | None = None
    quest_type: str
    recurrence_type: str
    xp_reward: int
    coin_reward: int
    estimated_minutes: int | None
    status: str
    lesson_id: str | None
    quiz_id: str | None
    child_status: str = "not_started"
    progress_current: int = 0
    progress_target: int = 1
    progress_total: int = 1
    progress_percent: float = 0
    score_reward: int = 0
    can_claim_reward: bool = False


class QuestActionOut(BaseModel):
    quest: QuestOut
    total_xp: int
    total_score: int
    coins: int = 0
    current_level: int


class LessonOut(BaseModel):
    id: str
    title: str
    grade_level: int
    skill_code: str
    is_review: bool
    is_locked: bool
    access_type: str
    content_preview: str | None = None
    linked_quiz_id: str | None = None


class TestStartOut(BaseModel):
    test_session_id: str
    lesson_id: str | None
    quiz_id: str | None
    timer_seconds: int
    core_question_count: int = 0
    challenge_question_count: int = 0
    ratio_policy: str | None = None
    rotation_cycle: int = 1
    questions: list[dict]


class TestSubmitIn(BaseModel):
    answers: dict[str, str]
    response_times_ms: dict[str, int] = Field(default_factory=dict)


class TestResultOut(BaseModel):
    test_session_id: str
    total_questions: int
    correct_count: int
    accuracy: float
    average_response_time_ms: float
    score_awarded: int
    xp_awarded: int
    total_score: int
    total_xp: int
    rank_title: str
