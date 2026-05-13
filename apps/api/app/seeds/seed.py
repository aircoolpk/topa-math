from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import Base, engine
from app.core.schema_maintenance import ensure_local_schema
from app.core.security import hash_password
from app.models import AvatarItem, Badge, ChildProfile, LearningQuest, Lesson, QuestTemplate, Question, RankTitle, RecurringQuestTemplate, Skill, Subject, User
from app.services.rank_titles import RANK_RULES

DEV_OWNER_EMAIL = "infomilliongarden@gmail.com"
DEV_OWNER_PASSWORD = "Admin123456!"
QA_STUDENT_EMAIL = "demo@4-craft.com"
QA_STUDENT_PASSWORD = "demo1234"
QA_ADMIN_EMAIL = "admin@4-craft.com"
QA_ADMIN_PASSWORD = "admin1234"


GRADE_SKILLS = {
    1: [
        ("g1-count-100", "นับเลข 1-100", "อ่านและนับจำนวนไม่เกิน 100"),
        ("g1-compare", "เปรียบเทียบจำนวน", "มากกว่า น้อยกว่า เท่ากับ"),
        ("g1-add-20", "บวกเลขไม่เกิน 20", "บวกจำนวนสองจำนวนไม่เกิน 20"),
        ("g1-sub-20", "ลบเลขไม่เกิน 20", "ลบจำนวนไม่เกิน 20"),
        ("g1-word-add-sub", "โจทย์ปัญหาบวก/ลบง่าย", "อ่านโจทย์สั้น ๆ แล้วเลือกการคำนวณ"),
        ("g1-shapes", "รูปร่างพื้นฐาน", "สี่เหลี่ยม สามเหลี่ยม วงกลม"),
        ("g1-time", "เวลาเบื้องต้น", "อ่านเวลาง่าย ๆ"),
    ],
    2: [
        ("g2-add-2digit", "บวกเลขสองหลัก", "บวกเลขสองหลักแบบมีและไม่มีทด"),
        ("g2-sub-2digit", "ลบเลขสองหลัก", "ลบเลขสองหลัก"),
        ("g2-multiply-start", "เริ่มต้นคูณ", "เข้าใจการคูณจากการบวกซ้ำ"),
        ("g2-times-2-5-10", "ตารางคูณ 2, 5, 10", "คูณด้วย 2, 5 และ 10"),
        ("g2-money", "เงินและการทอนเงิน", "รวมเงินและทอนเงินง่าย ๆ"),
        ("g2-calendar", "เวลาและปฏิทิน", "วัน เดือน และเวลา"),
        ("g2-2d-shapes", "รูปทรงสองมิติ", "จำแนกรูปทรงสองมิติ"),
    ],
    3: [
        ("g3-multiply", "คูณเลขหลายหลัก", "คูณเลขหนึ่งหลักกับหลายหลัก"),
        ("g3-division", "หารเบื้องต้น", "แบ่งเท่า ๆ กันและหารลงตัว"),
        ("g3-fraction", "เศษส่วนเบื้องต้น", "อ่านและเปรียบเทียบเศษส่วนง่าย ๆ"),
        ("g3-multistep", "โจทย์ปัญหาหลายขั้นตอน", "วิเคราะห์โจทย์มากกว่าหนึ่งขั้น"),
        ("g3-measurement", "การวัด", "ความยาว น้ำหนัก ปริมาตร"),
        ("g3-area", "พื้นที่เบื้องต้น", "นับช่องตารางเพื่อหาพื้นที่"),
    ],
}


DASHBOARD_QUESTS = {
    "daily": [
        ("check-in", "เช็กชื่อในระบบ", "check_in", 1, 5),
        ("lesson", "เข้าเรียนเนื้อหา", "lesson_complete", 1, 10),
        ("test-50", "ทำเทส ตอบถูกเกิน 50%", "test_50", 1, 15),
    ],
    "weekly": [
        ("check-in-2", "เช็กชื่อ", "check_in", 2, 20),
        ("check-in-4", "เช็กชื่อ", "check_in", 4, 35),
        ("check-in-6", "เช็กชื่อ", "check_in", 6, 50),
        ("lesson-3", "เรียนบทเรียน", "lesson_complete", 3, 35),
        ("lesson-4", "เรียนบทเรียน", "lesson_complete", 4, 45),
        ("lesson-5", "เรียนบทเรียน", "lesson_complete", 5, 55),
        ("friend-3", "เพิ่มเพื่อน", "friend_add", 3, 30),
        ("test-50-5", "ทำเทส ตอบถูกเกิน 50%", "test_50", 5, 50),
        ("test-50-10", "ทำเทส ตอบถูกเกิน 50%", "test_50", 10, 80),
        ("test-100-1", "ทำเทส ตอบถูก 100%", "test_100", 1, 60),
        ("test-100-3", "ทำเทส ตอบถูก 100%", "test_100", 3, 100),
    ],
    "monthly": [
        ("check-in-10", "เช็กชื่อ", "check_in", 10, 90),
        ("check-in-20", "เช็กชื่อ", "check_in", 20, 140),
        ("check-in-28", "เช็กชื่อ", "check_in", 28, 200),
        ("lesson-10", "เรียนบทเรียน", "lesson_complete", 10, 150),
        ("friend-10", "เพิ่มเพื่อน", "friend_add", 10, 120),
        ("test-50-10", "ทำเทส ตอบถูกเกิน 50%", "test_50", 10, 120),
        ("test-50-20", "ทำเทส ตอบถูกเกิน 50%", "test_50", 20, 220),
        ("test-100-5", "ทำเทส ตอบถูก 100%", "test_100", 5, 220),
        ("test-100-10", "ทำเทส ตอบถูก 100%", "test_100", 10, 350),
    ],
}


def seed(db: Session) -> None:
    subject = db.scalar(select(Subject).where(Subject.code == "math"))
    if not subject:
        subject = Subject(code="math", name="คณิตศาสตร์")
        db.add(subject)
        db.flush()

    for grade, skills in GRADE_SKILLS.items():
        for order, (code, name, description) in enumerate(skills, start=1):
            skill = db.scalar(select(Skill).where(Skill.code == code))
            if not skill:
                skill = Skill(subject_id=subject.id, grade_level=grade, code=code, name=name, description=description, difficulty_order=order)
                db.add(skill)
                db.flush()
                db.add(
                    Lesson(
                        skill_id=skill.id,
                        title=f"เริ่มเรียน: {name}",
                        content={"summary": description, "examples": ["ลองทำทีละขั้น", "ตรวจคำตอบอีกครั้ง"], "quiz_id": f"seed-{code}"},
                        source="human",
                        status="approved",
                    )
                )
                db.add(
                    Question(
                        skill_id=skill.id,
                        grade_level=grade,
                        question_type="multiple_choice",
                        difficulty="easy",
                        question_text="2 + 3 = ?",
                        choices=["4", "5", "6", "7"],
                        correct_answer="5",
                        explanation="2 + 3 เท่ากับ 5",
                        hint="นับต่อจาก 2 อีก 3 ครั้ง",
                        source="human",
                        status="approved",
                    )
                )

    for code, name in [
        ("first-lesson", "First Lesson"),
        ("streak-3", "3-Day Streak"),
        ("streak-7", "7-Day Streak"),
        ("addition-hero", "Addition Hero"),
        ("speed-star", "Speed Star"),
        ("improvement-champion", "Improvement Champion"),
    ]:
        if not db.scalar(select(Badge).where(Badge.code == code)):
            db.add(Badge(code=code, name=name, description=name))

    avatar_specs = {
        "hair_style": 6,
        "hair_color": 6,
        "eye_style": 6,
        "outfit": 3,
        "accessory": 5,
        "background": 3,
    }
    for item_type, count in avatar_specs.items():
        for index in range(1, count + 1):
            code = f"{item_type}-{index}"
            if not db.scalar(select(AvatarItem).where(AvatarItem.code == code)):
                db.add(AvatarItem(code=code, name=f"{item_type} {index}", item_type=item_type, is_default=index == 1))

    for order, (title, min_score) in enumerate(RANK_RULES, start=1):
        rank = db.scalar(select(RankTitle).where(RankTitle.title == title))
        if not rank:
            rank = RankTitle(title=title, min_score=min_score, sort_order=order)
            db.add(rank)
        rank.min_score = min_score
        rank.sort_order = order

    for grade in (1, 2, 3, 4, 5, 6):
        for recurrence_type, specs in DASHBOARD_QUESTS.items():
            for slug, title, action_type, target, reward in specs:
                quest_id = f"{recurrence_type}-g{grade}-{slug}"
                values = {
                    "quest_id": quest_id,
                    "grade_level": grade,
                    "skill_code": None,
                    "title": title,
                    "description": f"{title} 0/{target}",
                    "quest_type": action_type,
                    "recurrence_type": recurrence_type,
                    "xp_reward": reward,
                    "coin_reward": max(1, reward // 10),
                    "estimated_minutes": 3,
                    "status": "active",
                    "lesson_id": None,
                    "quiz_id": None,
                    "metadata_json": {"action_type": action_type, "target_count": target, "score_reward": reward},
                }
                quest = db.scalar(select(LearningQuest).where(LearningQuest.quest_id == quest_id))
                if not quest:
                    quest = LearningQuest(**values)
                    db.add(quest)
                else:
                    for field, value in values.items():
                        setattr(quest, field, value)
                template = db.scalar(select(QuestTemplate).where(QuestTemplate.quest_id == quest_id))
                if not template:
                    db.add(QuestTemplate(**values))
                else:
                    for field, value in values.items():
                        setattr(template, field, value)
                recurring_values = dict(values)
                recurring_values.pop("recurrence_type")
                recurring = db.scalar(select(RecurringQuestTemplate).where(RecurringQuestTemplate.quest_id == quest_id))
                if not recurring:
                    db.add(RecurringQuestTemplate(recurrence_type=recurrence_type, **recurring_values))
                else:
                    recurring.recurrence_type = recurrence_type
                    for field, value in recurring_values.items():
                        setattr(recurring, field, value)

    if not db.scalar(select(User).where(User.email == "admin@4-craft.local")):
        db.add(User(email="admin@4-craft.local", password_hash=hash_password("admin12345"), role="admin"))
    ensure_dev_owner(db)
    ensure_local_qa_users(db)
    db.commit()


def ensure_dev_owner(db: Session) -> User:
    owner = db.scalar(select(User).where(User.email == DEV_OWNER_EMAIL))
    if owner:
        owner.role = "owner"
        return owner
    owner = User(email=DEV_OWNER_EMAIL, password_hash=hash_password(DEV_OWNER_PASSWORD), role="owner")
    db.add(owner)
    return owner


def _is_local_seed_context() -> bool:
    settings = get_settings()
    environment = (settings.environment or "").lower()
    database_url = settings.database_url.lower()
    return environment in {"local", "dev", "development", "test"} or database_url.startswith("sqlite")


def _ensure_user(db: Session, email: str, password: str, role: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    password_hash = hash_password(password)
    if user:
        user.password_hash = password_hash
        user.role = role
        return user
    user = User(email=email, password_hash=password_hash, role=role)
    db.add(user)
    db.flush()
    return user


def _ensure_child_profile(
    db: Session,
    user: User,
    *,
    nickname: str,
    grade_level: int,
    program_type: str,
    plan_type: str,
    plan_code: str,
) -> ChildProfile:
    child = db.scalar(select(ChildProfile).where(ChildProfile.parent_user_id == user.id))
    if not child:
        child = ChildProfile(parent_user_id=user.id, nickname=nickname, grade_level=grade_level)
        db.add(child)
        db.flush()
    child.nickname = nickname
    child.grade_level = grade_level
    child.program_type = program_type
    child.membership_status = "plus"
    child.subscription_status = "active"
    child.plan_type = plan_type
    child.plan_code = plan_code
    child.active_price_code = plan_code
    child.price_type = "manual"
    child.billing_program_type = program_type
    child.admin_note = "Local QA seed account"
    child.manual_grant_reason = "local_qa_seed"
    child.free_test_limit = 999999
    return child


def ensure_local_qa_users(db: Session) -> None:
    if not _is_local_seed_context():
        return

    student = _ensure_user(db, QA_STUDENT_EMAIL, QA_STUDENT_PASSWORD, "student")
    _ensure_child_profile(
        db,
        student,
        nickname="QA Student",
        grade_level=3,
        program_type="THP",
        plan_type="thp",
        plan_code="th_plus_monthly",
    )

    admin = _ensure_user(db, QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD, "admin")
    _ensure_child_profile(
        db,
        admin,
        nickname="QA Admin",
        grade_level=3,
        program_type="EP",
        plan_type="ep",
        plan_code="ep_plus_monthly",
    )


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    ensure_local_schema(engine)
    with Session(engine) as session:
        seed(session)
    print("Seed complete")
