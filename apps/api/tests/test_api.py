import json
import os
from datetime import UTC, date, datetime, timedelta

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SMTP_HOST"] = ""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, inspect, select, text
from sqlalchemy.orm import Session

from app.core.database import Base, engine
from app.core.config import get_settings
from app.core.security import create_access_token
from app.core.schema_maintenance import ensure_local_schema
from app.main import app
from app.models import AffiliateCommissionLedger, AffiliateWithdrawalRequest, AdminAuditLog, Badge, CheckInEvent, ChildBadge, ChildProfile, LearningQuest, Lesson, LessonActivity, LessonVariantView, Question, QuestionAttemptHistory, QuizAnswer, Skill, Subject, TestResult as DbTestResult, TestSession as DbTestSession, User
from app.scripts.set_user_plus import set_user_plus
from app.seeds.import_content import import_content
from app.seeds.import_question_banks import import_question_banks
from app.seeds.seed import seed
from app.services.lesson_content import validate_lesson_content


@pytest.fixture()
def client() -> TestClient:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def seeded_client(client: TestClient) -> TestClient:
    with Session(engine) as session:
        seed(session)
        from app.models.mpp_purchase import MppPackagePrice
        from app.routers.billing import PLAN_CATALOG
        for plan in PLAN_CATALOG.values():
            if plan.billing_interval == 'month':
                session.add(MppPackagePrice(plan_code=plan.plan_code, amount_minor=plan.amount_thb * 100, currency='THB', duration_days=30, entitlement_plan=plan.entitlement_plan_code, program_type=plan.program_type, active=True))
        session.commit()
    return client


@pytest.fixture()
def content_client(seeded_client: TestClient) -> TestClient:
    with Session(engine) as session:
        import_content(session)
    return seeded_client


def register_and_login(client: TestClient) -> dict[str, str]:
    return register_and_login_as(client, "parent@example.com")


def register_and_login_as(client: TestClient, email: str) -> dict[str, str]:
    register_response = client.post(
        "/auth/register",
        json={"email": email, "password": "password123"},
    )
    assert register_response.status_code == 200
    assert register_response.json()["access_token"]

    login_response = client.post(
        "/auth/login",
        json={"email": email, "password": "password123"},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_login_sets_http_only_cookie_and_cookie_auth_persists(seeded_client: TestClient) -> None:
    response = seeded_client.post(
        "/auth/login",
        json={"email": "demo@4-craft.com", "password": "demo1234"},
        headers={
            "Origin": "https://topamath.com",
            "User-Agent": "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1",
        },
    )
    assert response.status_code == 200
    cookie_header = response.headers["set-cookie"]
    assert "topa_session=" in cookie_header
    assert "HttpOnly" in cookie_header
    assert "SameSite=lax" in cookie_header
    assert "Path=/" in cookie_header

    seeded_client.headers.pop("Authorization", None)
    me_response = seeded_client.get("/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "demo@4-craft.com"

    logout_response = seeded_client.post("/auth/logout")
    assert logout_response.status_code == 204
    assert seeded_client.get("/auth/me").status_code == 401


def test_expired_cookie_can_be_replaced_by_fresh_login(seeded_client: TestClient) -> None:
    with Session(engine) as session:
        user = session.scalar(select(User).where(User.email == "demo@4-craft.com"))
        assert user is not None
        settings = get_settings()
        original_expiry = settings.access_token_expire_minutes
        settings.access_token_expire_minutes = -1
        try:
            expired_token = create_access_token(user.id, user.role)
        finally:
            settings.access_token_expire_minutes = original_expiry

    seeded_client.cookies.set("topa_session", expired_token)
    assert seeded_client.get("/auth/me").status_code == 401

    login_response = seeded_client.post(
        "/auth/login",
        json={"email": "demo@4-craft.com", "password": "demo1234"},
    )
    assert login_response.status_code == 200
    assert seeded_client.get("/auth/me").status_code == 200


def create_child(client: TestClient, headers: dict[str, str]) -> dict:
    child_response = client.post(
        "/children",
        headers=headers,
        json={
            "nickname": "Little Star",
            "first_name": "Lina",
            "last_name": "Demo",
            "grade_level": 2,
            "province": "Bangkok",
            "district": "Phaya Thai",
            "school_name": "Demo Primary School",
            "school_province": "Bangkok",
            "school_district": "Phaya Thai",
            "avatar_gender": "girl",
            "avatar_config": {
                "hair": "hair_style-1",
                "eyes": "eye_style-1",
                "outfit": "outfit-1",
                "accessory": "accessory-1",
                "background": "background-1",
            },
            "program_type": "THP",
        },
    )
    assert child_response.status_code == 200
    child = child_response.json()
    assert child["nickname"] == "Little Star"
    assert child["first_name"] == "Lina"
    assert child["grade_level"] == 2
    assert child["school_name"] == "Demo Primary School"
    assert child["school_province"] == "Bangkok"
    assert child["school_district"] == "Phaya Thai"
    assert child["avatar_gender"] == "girl"
    assert child["avatar_config"]["hair"] == "hair_style-1"
    assert child["program_type"] == "THP"
    assert child["coins"] == 0
    return child


def seed_founder_children(count: int, *, th_count: int | None = None) -> None:
    th_count = count if th_count is None else th_count
    with Session(engine) as session:
        for index in range(count):
            user = User(email=f"founder-{index}@example.com", password_hash="x", role="parent")
            session.add(user)
            session.flush()
            is_th = index < th_count
            session.add(
                ChildProfile(
                    parent_user_id=user.id,
                    nickname=f"Founder {index}",
                    grade_level=1,
                    program_type="THP",
                    membership_status="plus",
                    plan_code="th_plus" if is_th else "ep_plus",
                    active_price_code="th_founder_monthly" if is_th else "ep_founder_monthly",
                    price_type="founder",
                    billing_program_type="TH" if is_th else "EP",
                    subscription_status="active",
                    stripe_customer_id=f"cus_founder_{index}",
                    stripe_subscription_id=f"sub_founder_{index}",
                )
            )
        session.commit()


class FakeStripe:
    api_key = None
    customer_created = False
    invalid_signature = False
    last_checkout_kwargs = None
    subscription_price_id = "price_th_founder_test"

    class Customer:
        @staticmethod
        def create(**_kwargs):
            FakeStripe.customer_created = True
            return {"id": "cus_test_123"}

    class checkout:
        class Session:
            @staticmethod
            def create(**kwargs):
                assert kwargs["mode"] == "subscription"
                FakeStripe.last_checkout_kwargs = kwargs
                return {"id": "cs_test_123", "url": "https://checkout.stripe.com/c/pay/cs_test_123"}

    class billing_portal:
        class Session:
            @staticmethod
            def create(**kwargs):
                assert kwargs["customer"] == "cus_test_123"
                return {"id": "bps_test_123", "url": "https://billing.stripe.com/p/session/test"}

    class Webhook:
        @staticmethod
        def construct_event(payload, _signature, _secret):
            if FakeStripe.invalid_signature:
                raise ValueError("invalid")
            return json.loads(payload.decode("utf-8"))

    class Subscription:
        @staticmethod
        def retrieve(subscription_id):
            return {
                "id": subscription_id,
                "customer": "cus_test_123",
                "status": "active",
                "current_period_end": 1893456000,
                "cancel_at_period_end": False,
                "items": {"data": [{"price": {"id": FakeStripe.subscription_price_id}}]},
            }


@pytest.fixture()
def stripe_env(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_not_real")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_not_real")
    monkeypatch.setenv("STRIPE_PRICE_EP_FOUNDER_MONTHLY", "price_ep_founder_test")
    monkeypatch.setenv("STRIPE_PRICE_TH_FOUNDER_MONTHLY", "price_th_founder_test")
    monkeypatch.setenv("STRIPE_PRICE_EP_PLUS_MONTHLY", "price_ep_monthly_test")
    monkeypatch.setenv("STRIPE_PRICE_TH_PLUS_MONTHLY", "price_th_monthly_test")
    monkeypatch.setenv("STRIPE_PRICE_EP_PLUS_YEARLY_PROMO", "price_ep_yearly_test")
    monkeypatch.setenv("STRIPE_PRICE_TH_PLUS_YEARLY_PROMO", "price_th_yearly_test")
    monkeypatch.setenv('STRIPE_PRICE_TH_PLUS_YEARLY', 'price_th_yearly_test')
    monkeypatch.setenv('STRIPE_PRICE_EP_PLUS_YEARLY', 'price_ep_yearly_test')
    monkeypatch.setenv("FRONTEND_BASE_URL", "http://127.0.0.1:3000")
    get_settings.cache_clear()
    import app.routers.billing as billing

    FakeStripe.customer_created = False
    FakeStripe.invalid_signature = False
    FakeStripe.last_checkout_kwargs = None
    FakeStripe.subscription_price_id = "price_th_founder_test"
    monkeypatch.setattr(billing, "stripe", FakeStripe)
    yield FakeStripe
    get_settings.cache_clear()


def register_with_referral(client: TestClient, email: str, referral_token: str) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={"email": email, "password": "password123", "referral_token": referral_token},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def stripe_invoice_paid_event(invoice_id: str = "in_aff_123", amount_paid: int = 100000) -> dict:
    return {
        "id": f"evt_{invoice_id}",
        "type": "invoice.paid",
        "data": {
            "object": {
                "id": invoice_id,
                "subscription": "sub_aff_123",
                "customer": "cus_test_123",
                "amount_paid": amount_paid,
                "currency": "thb",
                "payment_intent": f"pi_{invoice_id}",
            }
        },
    }


def create_ratio_lesson_bank(grade_level: int, *, topic_code: str, core_count: int, challenge_count: int) -> str:
    with Session(engine) as session:
        subject = session.scalar(select(Subject).where(Subject.code == "math"))
        if not subject:
            subject = Subject(code="math", name="Mathematics")
            session.add(subject)
            session.flush()
        skill = Skill(
            subject_id=subject.id,
            grade_level=grade_level,
            code=topic_code,
            name=topic_code,
            difficulty_order=grade_level * 100,
        )
        session.add(skill)
        session.flush()
        lesson = Lesson(
            skill_id=skill.id,
            title=topic_code,
            content={
                "content_id": topic_code,
                "lesson_id": topic_code,
                "title_th": topic_code,
                "grade_level": grade_level,
                "topic_code": topic_code,
                "skill_code": topic_code,
                "objective_th": "ratio test",
                "explanation_steps": ["step"],
            },
            source="test",
            status="approved",
        )
        session.add(lesson)
        session.flush()
        lesson_id = lesson.id
        for index in range(core_count + challenge_count):
            is_challenge = index >= core_count
            answer = str(index)
            session.add(
                Question(
                    skill_id=skill.id,
                    grade_level=grade_level,
                    question_type="multiple_choice",
                    difficulty="hard" if is_challenge else "easy",
                    question_text=f"{topic_code} question {index}",
                    choices=[answer, f"wrong-{index}", f"wrong-b-{index}", f"wrong-c-{index}"],
                    correct_answer=answer,
                    explanation="ok",
                    hint="hint",
                    source="test",
                    status="approved",
                    metadata_json={
                        "topic_code": topic_code,
                        "skill_code": topic_code,
                        "question_type": "challenge" if is_challenge else "core",
                        "routine_level": "non_routine" if is_challenge else "routine",
                        "confidence_role": "stretch_thinking" if is_challenge else "build_confidence",
                    },
                )
            )
        session.commit()
    return lesson_id


def create_variant_lesson(grade_level: int = 2, *, topic_code: str = "variant_lesson") -> str:
    with Session(engine) as session:
        subject = session.scalar(select(Subject).where(Subject.code == "math"))
        if not subject:
            subject = Subject(code="math", name="Mathematics")
            session.add(subject)
            session.flush()
        skill = Skill(
            subject_id=subject.id,
            grade_level=grade_level,
            code=topic_code,
            name=topic_code,
            difficulty_order=grade_level * 100,
        )
        session.add(skill)
        session.flush()
        lesson = Lesson(
            skill_id=skill.id,
            title=topic_code,
            content={
                "content_id": topic_code,
                "lesson_id": topic_code,
                "title_th": "Variant Lesson",
                "objective_th": "Learn with variants",
                "grade_level": grade_level,
                "topic_code": topic_code,
                "skill_code": topic_code,
                "estimated_minutes": 10,
                "has_test": True,
                "lesson_variants": [
                    {"variant_id": "v01", "variant_title_th": "Variant 1", "story_theme_th": "theme_1", "visual_blocks": [{"type": "image"}]},
                    {"variant_id": "v02", "variant_title_th": "Variant 2", "story_theme_th": "theme_2", "visual_blocks": []},
                    {"variant_id": "v03", "variant_title_th": "Variant 3", "story_theme_th": "theme_3", "visual_blocks": []},
                ],
            },
            source="test",
            status="approved",
        )
        session.add(lesson)
        session.commit()
    return topic_code


def create_visual_block_lesson(*, topic_code: str, visual_blocks) -> str:
    with Session(engine) as session:
        subject = session.scalar(select(Subject).where(Subject.code == "math"))
        if not subject:
            subject = Subject(code="math", name="Mathematics")
            session.add(subject)
            session.flush()
        skill = Skill(
            subject_id=subject.id,
            grade_level=2,
            code=topic_code,
            name=topic_code,
            difficulty_order=200,
        )
        session.add(skill)
        session.flush()
        lesson = Lesson(
            skill_id=skill.id,
            title=topic_code,
            content={
                "content_id": topic_code,
                "lesson_id": topic_code,
                "title_th": "Visual Block Lesson",
                "objective_th": "Normalize blocks",
                "grade_level": 2,
                "topic_code": topic_code,
                "skill_code": topic_code,
                "estimated_minutes": 10,
                "has_test": True,
                "lesson_variants": [
                    {
                        "variant_id": "v01",
                        "variant_title_th": "Visual Variant",
                        "story_theme_th": "visual_theme",
                        "visual_blocks": visual_blocks,
                    }
                ],
            },
            source="test",
            status="approved",
        )
        session.add(lesson)
        session.commit()
    return topic_code


def test_root_and_health(client: TestClient):
    root_response = client.get("/")
    assert root_response.status_code == 200
    assert root_response.json() == {
        "name": "4-craft Adaptive Learning API",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
    }

    health_response = client.get("/health")
    assert health_response.status_code == 200
    assert health_response.json() == {"status": "ok"}


def test_register_login_and_create_child(seeded_client: TestClient):
    headers = register_and_login(seeded_client)

    me = seeded_client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["role"] == "parent"

    child = create_child(seeded_client, headers)

    fetched_child = seeded_client.get(f"/children/{child['id']}", headers=headers)
    assert fetched_child.status_code == 200
    assert fetched_child.json()["school_name"] == "Demo Primary School"
    assert fetched_child.json()["school_province"] == "Bangkok"
    assert fetched_child.json()["school_district"] == "Phaya Thai"
    assert fetched_child.json()["avatar_gender"] == "girl"

    children = seeded_client.get("/children", headers=headers)
    assert children.status_code == 200
    assert children.json()[0]["id"] == child["id"]
    assert children.json()[0]["school_name"] == "Demo Primary School"
    assert children.json()[0]["school_province"] == "Bangkok"
    assert children.json()[0]["school_district"] == "Phaya Thai"
    assert children.json()[0]["avatar_gender"] == "girl"


def test_create_child_with_full_registration_fields(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    child_response = seeded_client.post(
        "/children",
        headers=headers,
        json={
            "first_name": "Mali",
            "last_name": "Jaidee",
            "nickname": "Mali",
            "grade_level": 6,
            "program_type": "EP",
            "school_name": "Demo International School",
            "school_province": "Bangkok",
            "school_district": "Pathum Wan",
            "province": "Bangkok",
            "district": "Pathum Wan",
            "avatar_gender": "boy",
            "avatar_config": {"hair": "short", "outfit": "blue"},
            "student_photo_url": "https://example.com/student.png",
        },
    )

    assert child_response.status_code == 200
    child = child_response.json()
    assert child["first_name"] == "Mali"
    assert child["last_name"] == "Jaidee"
    assert child["grade_level"] == 6
    assert child["program_type"] == "EP"
    assert child["avatar_gender"] == "boy"
    assert child["avatar_config"] == {"hair": "short", "outfit": "blue"}
    assert child["student_photo_url"] == "https://example.com/student.png"
    assert child["total_xp"] == 0
    assert child["current_level"] == 1
    assert child["streak_count"] == 0
    assert child["coins"] == 0
    assert child["total_score"] == 0
    assert child["days_active"] == 0

    fetched_child = seeded_client.get(f"/children/{child['id']}", headers=headers)
    assert fetched_child.status_code == 200
    assert fetched_child.json()["avatar_config"] == {"hair": "short", "outfit": "blue"}


def test_create_child_accepts_missing_optional_registration_fields(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    child_response = seeded_client.post(
        "/children",
        headers=headers,
        json={"nickname": "Optional Fields", "grade_level": 1},
    )

    assert child_response.status_code == 200
    child = child_response.json()
    assert child["first_name"] is None
    assert child["school_name"] is None
    assert child["avatar_gender"] is None
    assert child["avatar_config"] == {}
    assert child["program_type"] == "THP"


def test_billing_status_returns_free_by_default(seeded_client: TestClient, stripe_env):
    headers = register_and_login_as(seeded_client, "billing-status@example.com")
    create_child(seeded_client, headers)

    response = seeded_client.get("/billing/status", headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "membership_status": "free",
        "plan_code": "free",
        "active_price_code": None,
        "price_type": None,
        "program_type": None,
        "subscription_status": "none",
        "current_period_end": None,
        "cancel_at_period_end": False,
    }


def test_billing_prices_returns_free_plus_six_paid_plans(seeded_client: TestClient, stripe_env):
    response = seeded_client.get("/billing/prices")

    assert response.status_code == 200
    plans = response.json()["plans"]
    assert len(plans) == 7
    assert {plan["plan_code"] for plan in plans} == {
        "free",
        "th_founder_monthly",
        "ep_founder_monthly",
        "th_plus_monthly",
        "ep_plus_monthly",
        "th_plus_yearly_promo",
        "ep_plus_yearly_promo",
    }
    assert all(plan["available"] is True for plan in plans)
    free = plans[0]
    assert free == {
        "plan_code": "free",
        "display_name": "ทดลองใช้ฟรี",
        "program_type": "FREE",
        "price_thb": 0,
        "billing_interval": "none",
        "price_type": "free",
        "available": True,
    }
    by_code = {plan["plan_code"]: plan for plan in plans}
    assert by_code["th_plus_monthly"]["display_name"] == "Plus TH"
    assert by_code["ep_plus_monthly"]["display_name"] == "Plus EP"
    assert by_code["th_plus_yearly_promo"]["display_name"] == "Plus TH Year Promotion"
    assert by_code["ep_plus_yearly_promo"]["display_name"] == "Plus EP Year Promotion"
    founder = [plan for plan in plans if plan["price_type"] == "founder"]
    assert len(founder) == 2
    assert {plan["founder_limit"] for plan in founder} == {100}
    assert {plan["founder_used"] for plan in founder} == {0}
    assert {plan["founder_slots_remaining"] for plan in founder} == {100}
    assert all(plan["founder_shared_pool"] is True for plan in founder)


def test_billing_prices_shared_founder_remaining_slots(seeded_client: TestClient, stripe_env):
    seed_founder_children(100, th_count=70)

    response = seeded_client.get("/billing/prices")

    assert response.status_code == 200
    plans = response.json()["plans"]
    founder = [plan for plan in plans if plan["plan_code"] in {"th_founder_monthly", "ep_founder_monthly"}]
    assert {plan["founder_used"] for plan in founder} == {100}
    assert {plan["founder_slots_remaining"] for plan in founder} == {0}
    assert all(plan["available"] is False for plan in founder)
    normal = {plan["plan_code"]: plan for plan in plans if plan["price_type"] != "founder"}
    assert normal["th_plus_monthly"]["available"] is True
    assert normal["ep_plus_monthly"]["available"] is True


def test_billing_prices_ignores_abandoned_checkout_customer_without_paid_subscription(seeded_client: TestClient, stripe_env):
    headers = register_and_login_as(seeded_client, "abandoned@example.com")
    child = create_child(seeded_client, headers)
    with Session(engine) as session:
        profile = session.get(ChildProfile, child["id"])
        profile.stripe_customer_id = "cus_abandoned"
        profile.active_price_code = "th_founder_monthly"
        profile.price_type = "founder"
        profile.subscription_status = "none"
        profile.membership_status = "free"
        session.commit()

    response = seeded_client.get("/billing/prices")

    assert response.status_code == 200
    founder = [plan for plan in response.json()["plans"] if plan["price_type"] == "founder"]
    assert {plan["founder_used"] for plan in founder} == {0}
    assert all(plan["available"] is True for plan in founder)


@pytest.mark.parametrize(
    "plan_code",
    [
        "th_founder_monthly",
        "ep_founder_monthly",
        "th_plus_monthly",
        "ep_plus_monthly",
        "th_plus_yearly_promo",
        "ep_plus_yearly_promo",
    ],
)
def test_create_checkout_session_defaults_to_stripe_for_each_plan(seeded_client: TestClient, stripe_env, plan_code):
    headers = register_and_login_as(seeded_client, f"{plan_code}@example.com")
    child = create_child(seeded_client, headers)

    response = seeded_client.post("/billing/create-checkout-session", headers=headers, json={"plan_code": plan_code})

    assert response.status_code == 200
    assert response.json()['provider'] == 'stripe'
    assert stripe_env.last_checkout_kwargs is not None
    assert stripe_env.customer_created is True
    with Session(engine) as session:
        profile = session.get(ChildProfile, child["id"])
        assert profile.stripe_customer_id == 'cus_test_123'
        assert profile.membership_status == "free"


def test_founder_checkout_blocked_when_founder_full(seeded_client: TestClient, stripe_env):
    seed_founder_children(100, th_count=50)
    headers = register_and_login_as(seeded_client, "founder-full@example.com")
    create_child(seeded_client, headers)

    response = seeded_client.post("/billing/create-checkout-session", headers=headers, json={"plan_code": "th_founder_monthly"})

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "FOUNDER_FULL"
    assert stripe_env.last_checkout_kwargs is None


def test_create_normal_checkout_uses_stripe_when_founder_full(seeded_client: TestClient, stripe_env):
    seed_founder_children(100, th_count=50)
    headers = register_and_login_as(seeded_client, "normal-when-full@example.com")
    create_child(seeded_client, headers)

    response = seeded_client.post("/billing/create-checkout-session", headers=headers, json={"plan_code": "th_plus_monthly"})

    assert response.status_code == 200
    assert response.json()['provider'] == 'stripe'
    assert stripe_env.last_checkout_kwargs is not None


def test_unauthenticated_checkout_returns_401(seeded_client: TestClient, stripe_env):
    response = seeded_client.post("/billing/create-checkout-session", json={"plan_code": "th_founder_monthly"})

    assert response.status_code == 401


def test_create_checkout_session_invalid_plan_code_returns_400(seeded_client: TestClient, stripe_env):
    headers = register_and_login_as(seeded_client, "invalid-plan@example.com")
    create_child(seeded_client, headers)

    response = seeded_client.post("/billing/create-checkout-session", headers=headers, json={"plan_code": "not_a_plan"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid plan_code"
    assert stripe_env.last_checkout_kwargs is None


def test_create_checkout_session_does_not_fall_back_when_stripe_price_missing(seeded_client: TestClient, stripe_env, monkeypatch):
    headers = register_and_login_as(seeded_client, "missing-price@example.com")
    create_child(seeded_client, headers)
    monkeypatch.setenv("STRIPE_PRICE_TH_FOUNDER_MONTHLY", "")
    get_settings.cache_clear()

    response = seeded_client.post("/billing/create-checkout-session", headers=headers, json={"plan_code": "th_founder_monthly"})

    assert response.status_code == 200
    assert response.json()['provider'] == 'stripe'
    assert response.json()['mode'] == 'manual_pending'
    assert stripe_env.last_checkout_kwargs is None


def test_create_checkout_session_without_child_profile_preserves_legacy_stripe(seeded_client: TestClient, stripe_env):
    headers = register_and_login_as(seeded_client, "checkout-before-child@example.com")

    response = seeded_client.post("/billing/create-checkout-session", headers=headers, json={"plan_code": "th_plus_monthly"})

    assert response.status_code == 200
    assert response.json()['provider'] == 'stripe'
    assert stripe_env.last_checkout_kwargs is not None
    assert stripe_env.customer_created is True


def test_create_portal_session_returns_portal_url(seeded_client: TestClient, stripe_env):
    headers = register_and_login_as(seeded_client, "portal@example.com")
    child = create_child(seeded_client, headers)
    with Session(engine) as session:
        profile = session.get(ChildProfile, child["id"])
        profile.stripe_customer_id = "cus_test_123"
        session.commit()

    response = seeded_client.post("/billing/create-portal-session", headers=headers)

    assert response.status_code == 200
    assert response.json() == {"portal_url": "https://billing.stripe.com/p/session/test"}


def test_create_portal_session_requires_stripe_customer_id(seeded_client: TestClient, stripe_env):
    headers = register_and_login_as(seeded_client, "portal-missing-customer@example.com")
    create_child(seeded_client, headers)

    response = seeded_client.post("/billing/create-portal-session", headers=headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "ยังไม่พบข้อมูลลูกค้า Stripe"


@pytest.mark.parametrize(
    ("selected_plan_code", "price_id", "entitlement_plan", "program_type", "price_type"),
    [
        ("th_founder_monthly", "price_th_founder_test", "th_plus", "TH", "founder"),
        ("ep_plus_monthly", "price_ep_monthly_test", "ep_plus", "EP", "normal"),
    ],
)
def test_stripe_webhook_checkout_completed_activates_plus(seeded_client: TestClient, stripe_env, selected_plan_code, price_id, entitlement_plan, program_type, price_type):
    stripe_env.subscription_price_id = price_id
    headers = register_and_login_as(seeded_client, f"webhook-{selected_plan_code}@example.com")
    child = create_child(seeded_client, headers)
    token_user_id = None
    with Session(engine) as session:
        profile = session.get(ChildProfile, child["id"])
        token_user_id = profile.parent_user_id
    event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "mode": "subscription",
                "payment_status": "paid",
                "customer": "cus_test_123",
                "subscription": "sub_test_123",
                "client_reference_id": token_user_id,
                "metadata": {
                    "user_id": token_user_id,
                    "child_id": child["id"],
                    "plan_code": selected_plan_code,
                    "program_type": program_type,
                    "price_type": price_type,
                },
            }
        },
    }

    response = seeded_client.post("/webhooks/stripe", content=json.dumps(event), headers={"stripe-signature": "valid"})

    assert response.status_code == 200
    with Session(engine) as session:
        profile = session.get(ChildProfile, child["id"])
        assert profile.membership_status == "plus"
        assert profile.plan_code == entitlement_plan
        assert profile.active_price_code == selected_plan_code
        assert profile.price_type == price_type
        assert profile.billing_program_type == program_type
        assert profile.subscription_status == "active"
        assert profile.stripe_customer_id == "cus_test_123"
        assert profile.stripe_subscription_id == "sub_test_123"
        assert profile.paid_at is not None


def test_webhook_successful_founder_subscription_increments_used_count(seeded_client: TestClient, stripe_env):
    stripe_env.subscription_price_id = "price_th_founder_test"
    headers = register_and_login_as(seeded_client, "founder-webhook-count@example.com")
    child = create_child(seeded_client, headers)
    with Session(engine) as session:
        user_id = session.get(ChildProfile, child["id"]).parent_user_id
    before = seeded_client.get("/billing/prices")
    assert [plan for plan in before.json()["plans"] if plan["plan_code"] == "th_founder_monthly"][0]["founder_used"] == 0
    event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "mode": "subscription",
                "payment_status": "paid",
                "customer": "cus_test_123",
                "subscription": "sub_test_123",
                "client_reference_id": user_id,
                "metadata": {
                    "user_id": user_id,
                    "child_id": child["id"],
                    "plan_code": "th_founder_monthly",
                    "program_type": "TH",
                    "price_type": "founder",
                },
            }
        },
    }

    response = seeded_client.post("/webhooks/stripe", content=json.dumps(event), headers={"stripe-signature": "valid"})

    assert response.status_code == 200
    after = seeded_client.get("/billing/prices")
    founder = [plan for plan in after.json()["plans"] if plan["plan_code"] in {"th_founder_monthly", "ep_founder_monthly"}]
    assert {plan["founder_used"] for plan in founder} == {1}
    assert {plan["founder_slots_remaining"] for plan in founder} == {99}


def test_stripe_webhook_subscription_deleted_sets_membership_free(seeded_client: TestClient, stripe_env):
    headers = register_and_login_as(seeded_client, "webhook-delete@example.com")
    child = create_child(seeded_client, headers)
    with Session(engine) as session:
        profile = session.get(ChildProfile, child["id"])
        profile.membership_status = "plus"
        profile.plan_code = "th_plus"
        profile.active_price_code = "th_founder_monthly"
        profile.price_type = "founder"
        profile.billing_program_type = "TH"
        profile.subscription_status = "active"
        profile.stripe_customer_id = "cus_test_123"
        profile.stripe_subscription_id = "sub_test_123"
        session.commit()
    event = {
        "type": "customer.subscription.deleted",
        "data": {"object": {"id": "sub_test_123", "customer": "cus_test_123", "status": "canceled"}},
    }

    response = seeded_client.post("/webhooks/stripe", content=json.dumps(event), headers={"stripe-signature": "valid"})

    assert response.status_code == 200
    with Session(engine) as session:
        profile = session.get(ChildProfile, child["id"])
        assert profile.membership_status == "free"
        assert profile.plan_code == "free"
        assert profile.active_price_code is None
        assert profile.price_type is None
        assert profile.billing_program_type is None
        assert profile.subscription_status == "canceled"
        assert profile.canceled_at is not None


def test_stripe_webhook_invalid_signature_rejected(seeded_client: TestClient, stripe_env):
    stripe_env.invalid_signature = True

    response = seeded_client.post(
        "/webhooks/stripe",
        content=json.dumps({"type": "checkout.session.completed", "data": {"object": {}}}),
        headers={"stripe-signature": "invalid"},
    )

    assert response.status_code == 400


def test_affiliate_registration_attribution(seeded_client: TestClient):
    affiliate_headers = register_and_login_as(seeded_client, "affiliate-owner@example.com")
    token = seeded_client.get("/me/affiliate", headers=affiliate_headers).json()["referral_token"]
    referred_headers = register_with_referral(seeded_client, "affiliate-referred@example.com", token)

    affiliate_summary = seeded_client.get("/me/affiliate", headers=affiliate_headers)
    referred_summary = seeded_client.get("/me/affiliate", headers=referred_headers)

    assert affiliate_summary.status_code == 200
    assert affiliate_summary.json()["registered_count"] == 1
    assert referred_summary.status_code == 200
    assert referred_summary.json()["registered_count"] == 0
    with Session(engine) as session:
        referred = session.scalar(select(User).where(User.email == "affiliate-referred@example.com"))
        referrer = session.scalar(select(User).where(User.email == "affiliate-owner@example.com"))
        assert referred.referred_by_user_id == referrer.id


def test_invoice_paid_creates_affiliate_commission_once(seeded_client: TestClient, stripe_env, monkeypatch):
    monkeypatch.setenv("AFFILIATE_COMMISSION_HOLD_DAYS", "0")
    get_settings.cache_clear()
    affiliate_headers = register_and_login_as(seeded_client, "affiliate-pay-owner@example.com")
    token = seeded_client.get("/me/affiliate", headers=affiliate_headers).json()["referral_token"]
    referred_headers = register_with_referral(seeded_client, "affiliate-pay-referred@example.com", token)
    child = create_child(seeded_client, referred_headers)
    with Session(engine) as session:
        profile = session.get(ChildProfile, child["id"])
        profile.stripe_customer_id = "cus_test_123"
        profile.stripe_subscription_id = "sub_aff_123"
        session.commit()
    event = stripe_invoice_paid_event(invoice_id="in_once", amount_paid=100000)

    first = seeded_client.post("/webhooks/stripe", content=json.dumps(event), headers={"stripe-signature": "valid"})
    duplicate = seeded_client.post("/webhooks/stripe", content=json.dumps(event), headers={"stripe-signature": "valid"})

    assert first.status_code == 200
    assert duplicate.status_code == 200
    with Session(engine) as session:
        rows = session.scalars(select(AffiliateCommissionLedger)).all()
        assert len(rows) == 1
        assert rows[0].amount_paid_minor == 100000
        assert rows[0].commission_minor == 3000
        assert rows[0].status == "available"
    summary = seeded_client.get("/me/affiliate", headers=affiliate_headers).json()
    assert summary["paid_member_count"] == 1
    assert summary["total_referred_paid_minor"] == 100000
    assert summary["available_balance_minor"] == 3000


def test_affiliate_refund_reverses_commission(seeded_client: TestClient, stripe_env, monkeypatch):
    monkeypatch.setenv("AFFILIATE_COMMISSION_HOLD_DAYS", "0")
    get_settings.cache_clear()
    affiliate_headers = register_and_login_as(seeded_client, "affiliate-refund-owner@example.com")
    token = seeded_client.get("/me/affiliate", headers=affiliate_headers).json()["referral_token"]
    referred_headers = register_with_referral(seeded_client, "affiliate-refund-referred@example.com", token)
    child = create_child(seeded_client, referred_headers)
    with Session(engine) as session:
        profile = session.get(ChildProfile, child["id"])
        profile.stripe_customer_id = "cus_test_123"
        profile.stripe_subscription_id = "sub_aff_123"
        session.commit()
    seeded_client.post("/webhooks/stripe", content=json.dumps(stripe_invoice_paid_event(invoice_id="in_refund", amount_paid=50000)), headers={"stripe-signature": "valid"})

    refund = seeded_client.post(
        "/webhooks/stripe",
        content=json.dumps({"id": "evt_refund", "type": "charge.refunded", "data": {"object": {"id": "ch_123", "invoice": "in_refund"}}}),
        headers={"stripe-signature": "valid"},
    )

    assert refund.status_code == 200
    with Session(engine) as session:
        row = session.scalar(select(AffiliateCommissionLedger).where(AffiliateCommissionLedger.payment_reference_id == "stripe_invoice:in_refund"))
        assert row.status == "reversed"
        assert row.reversed_at is not None
    summary = seeded_client.get("/me/affiliate", headers=affiliate_headers).json()
    assert summary["available_balance_minor"] == 0


def test_affiliate_withdrawal_cannot_exceed_available_balance(seeded_client: TestClient, stripe_env, monkeypatch):
    monkeypatch.setenv("AFFILIATE_COMMISSION_HOLD_DAYS", "0")
    monkeypatch.setenv("AFFILIATE_MIN_WITHDRAWAL_MINOR", "500")
    get_settings.cache_clear()
    affiliate_headers = register_and_login_as(seeded_client, "affiliate-withdraw-owner@example.com")
    token = seeded_client.get("/me/affiliate", headers=affiliate_headers).json()["referral_token"]
    referred_headers = register_with_referral(seeded_client, "affiliate-withdraw-referred@example.com", token)
    child = create_child(seeded_client, referred_headers)
    with Session(engine) as session:
        profile = session.get(ChildProfile, child["id"])
        profile.stripe_customer_id = "cus_test_123"
        profile.stripe_subscription_id = "sub_aff_123"
        session.commit()
    seeded_client.post("/webhooks/stripe", content=json.dumps(stripe_invoice_paid_event(invoice_id="in_withdraw", amount_paid=100000)), headers={"stripe-signature": "valid"})
    account = seeded_client.put(
        "/me/affiliate/payout-account",
        headers=affiliate_headers,
        json={"payout_method": "bank", "account_holder_name": "Owner", "bank_name": "Demo Bank", "account_number": "1234567890"},
    )
    assert account.status_code == 200

    too_much = seeded_client.post("/me/affiliate/withdrawals", headers=affiliate_headers, json={"amount_minor": 4000})
    ok = seeded_client.post("/me/affiliate/withdrawals", headers=affiliate_headers, json={"amount_minor": 3000})
    second = seeded_client.post("/me/affiliate/withdrawals", headers=affiliate_headers, json={"amount_minor": 500})

    assert too_much.status_code == 409
    assert ok.status_code == 200
    assert second.status_code == 409


def _prepare_affiliate_withdrawable_balance(client: TestClient, monkeypatch, *, owner_email: str, referred_email: str, invoice_id: str = "in_withdraw_ready") -> dict[str, str]:
    monkeypatch.setenv("AFFILIATE_COMMISSION_HOLD_DAYS", "0")
    monkeypatch.setenv("AFFILIATE_MIN_WITHDRAWAL_MINOR", "500")
    get_settings.cache_clear()
    affiliate_headers = register_and_login_as(client, owner_email)
    token = client.get("/me/affiliate", headers=affiliate_headers).json()["referral_token"]
    referred_headers = register_with_referral(client, referred_email, token)
    child = create_child(client, referred_headers)
    with Session(engine) as session:
        profile = session.get(ChildProfile, child["id"])
        profile.stripe_customer_id = "cus_test_123"
        profile.stripe_subscription_id = "sub_aff_123"
        session.commit()
    paid = client.post(
        "/webhooks/stripe",
        content=json.dumps(stripe_invoice_paid_event(invoice_id=invoice_id, amount_paid=100000)),
        headers={"stripe-signature": "valid"},
    )
    assert paid.status_code == 200
    account = client.put(
        "/me/affiliate/payout-account",
        headers=affiliate_headers,
        json={"payout_method": "bank", "account_holder_name": "Owner", "bank_name": "Demo Bank", "account_number": "1234567890"},
    )
    assert account.status_code == 200
    return affiliate_headers


def test_affiliate_withdrawal_request_reserves_balance_audits_and_sends_notifications(seeded_client: TestClient, stripe_env, monkeypatch):
    monkeypatch.setenv("AFFILIATE_ADMIN_NOTIFICATION_EMAIL", "affiliate-admin@example.com")
    monkeypatch.setenv("EMAIL_FROM", "no-reply@example.com")
    sent = []

    def fake_send_email(message):
        sent.append(message)
        return True

    monkeypatch.setattr("app.services.affiliates.send_email", fake_send_email)
    affiliate_headers = _prepare_affiliate_withdrawable_balance(
        seeded_client,
        monkeypatch,
        owner_email="affiliate-notify-owner@example.com",
        referred_email="affiliate-notify-referred@example.com",
        invoice_id="in_notify",
    )

    response = seeded_client.post("/me/affiliate/withdrawals", headers=affiliate_headers, json={"amount_minor": 3000})

    assert response.status_code == 200
    withdrawal_id = response.json()["withdrawal"]["id"]
    assert {message.to_email for message in sent} == {"affiliate-admin@example.com", "affiliate-notify-owner@example.com"}
    assert all(message.from_email == "no-reply@example.com" for message in sent)
    with Session(engine) as session:
        withdrawal = session.get(AffiliateWithdrawalRequest, withdrawal_id)
        assert withdrawal
        assert withdrawal.status == "pending_review"
        assert session.scalar(select(func.count()).select_from(AffiliateCommissionLedger).where(AffiliateCommissionLedger.withdrawal_request_id == withdrawal_id, AffiliateCommissionLedger.status == "withdrawn")) == 1
        audit = session.scalar(select(AdminAuditLog).where(AdminAuditLog.action == "affiliate_withdrawal_requested"))
        assert audit
        assert audit.target_user_id == withdrawal.user_id
        assert audit.new_value["withdrawal_id"] == withdrawal_id


def test_affiliate_withdrawal_insufficient_balance_does_not_create_request(seeded_client: TestClient, stripe_env, monkeypatch):
    affiliate_headers = _prepare_affiliate_withdrawable_balance(
        seeded_client,
        monkeypatch,
        owner_email="affiliate-low-owner@example.com",
        referred_email="affiliate-low-referred@example.com",
        invoice_id="in_low",
    )

    response = seeded_client.post("/me/affiliate/withdrawals", headers=affiliate_headers, json={"amount_minor": 4000})

    assert response.status_code == 409
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(AffiliateWithdrawalRequest)) == 0
        assert session.scalar(select(func.count()).select_from(AffiliateCommissionLedger).where(AffiliateCommissionLedger.status == "available")) == 1


def test_affiliate_withdrawal_duplicate_active_request_rejected(seeded_client: TestClient, stripe_env, monkeypatch):
    affiliate_headers = _prepare_affiliate_withdrawable_balance(
        seeded_client,
        monkeypatch,
        owner_email="affiliate-duplicate-owner@example.com",
        referred_email="affiliate-duplicate-referred@example.com",
        invoice_id="in_duplicate",
    )

    first = seeded_client.post("/me/affiliate/withdrawals", headers=affiliate_headers, json={"amount_minor": 1000})
    second = seeded_client.post("/me/affiliate/withdrawals", headers=affiliate_headers, json={"amount_minor": 500})

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["detail"] == "Withdrawal request already pending"
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(AffiliateWithdrawalRequest)) == 1


def test_affiliate_withdrawal_email_failure_keeps_request_visible_to_admin(seeded_client: TestClient, stripe_env, monkeypatch):
    monkeypatch.setenv("AFFILIATE_ADMIN_NOTIFICATION_EMAIL", "affiliate-admin@example.com")
    monkeypatch.setenv("EMAIL_FROM", "no-reply@example.com")

    def failing_send_email(_message):
        raise RuntimeError("smtp down")

    monkeypatch.setattr("app.services.affiliates.send_email", failing_send_email)
    affiliate_headers = _prepare_affiliate_withdrawable_balance(
        seeded_client,
        monkeypatch,
        owner_email="affiliate-email-fail-owner@example.com",
        referred_email="affiliate-email-fail-referred@example.com",
        invoice_id="in_email_fail",
    )

    response = seeded_client.post("/me/affiliate/withdrawals", headers=affiliate_headers, json={"amount_minor": 3000})
    admin_response = seeded_client.get("/admin/affiliates", headers=_admin_headers(seeded_client, "affiliate-admin-view@example.com"))

    assert response.status_code == 200
    withdrawal_id = response.json()["withdrawal"]["id"]
    assert admin_response.status_code == 200
    assert any(row["id"] == withdrawal_id for row in admin_response.json()["withdrawals"])
    with Session(engine) as session:
        assert session.get(AffiliateWithdrawalRequest, withdrawal_id)


def test_user_cannot_view_other_affiliate_data(seeded_client: TestClient, stripe_env, monkeypatch):
    monkeypatch.setenv("AFFILIATE_COMMISSION_HOLD_DAYS", "0")
    get_settings.cache_clear()
    owner_headers = register_and_login_as(seeded_client, "affiliate-private-owner@example.com")
    other_headers = register_and_login_as(seeded_client, "affiliate-private-other@example.com")
    token = seeded_client.get("/me/affiliate", headers=owner_headers).json()["referral_token"]
    referred_headers = register_with_referral(seeded_client, "affiliate-private-referred@example.com", token)
    child = create_child(seeded_client, referred_headers)
    with Session(engine) as session:
        profile = session.get(ChildProfile, child["id"])
        profile.stripe_customer_id = "cus_test_123"
        profile.stripe_subscription_id = "sub_aff_123"
        session.commit()
    seeded_client.post("/webhooks/stripe", content=json.dumps(stripe_invoice_paid_event(invoice_id="in_private", amount_paid=100000)), headers={"stripe-signature": "valid"})

    owner_summary = seeded_client.get("/me/affiliate", headers=owner_headers).json()
    other_summary = seeded_client.get("/me/affiliate", headers=other_headers).json()

    assert owner_summary["registered_count"] == 1
    assert owner_summary["total_commission_minor"] == 3000
    assert other_summary["registered_count"] == 0
    assert other_summary["total_commission_minor"] == 0


def test_sqlite_schema_maintenance_adds_registration_columns():
    legacy_engine = create_engine("sqlite:///:memory:")
    with legacy_engine.begin() as connection:
        connection.execute(text("CREATE TABLE child_profiles (id VARCHAR(36) PRIMARY KEY)"))

    ensure_local_schema(legacy_engine)

    columns = {column["name"] for column in inspect(legacy_engine).get_columns("child_profiles")}
    assert {
        "first_name",
        "last_name",
        "nickname",
        "grade_level",
        "province",
        "district",
        "school_name",
        "school_province",
        "school_district",
        "avatar_gender",
        "avatar_config",
        "program_type",
        "student_photo_url",
        "total_xp",
        "current_level",
        "streak_count",
        "coins",
        "total_score",
        "days_active",
    } <= columns


def test_update_child_school_fields(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    child = create_child(seeded_client, headers)

    updated = seeded_client.patch(
        f"/children/{child['id']}",
        headers=headers,
        json={
            "school_name": "Updated School",
            "school_province": "Chiang Mai",
            "school_district": "Mueang Chiang Mai",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["school_name"] == "Updated School"
    assert updated.json()["school_province"] == "Chiang Mai"
    assert updated.json()["school_district"] == "Mueang Chiang Mai"


def test_update_child_avatar_fields(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    child = create_child(seeded_client, headers)

    updated = seeded_client.patch(
        f"/children/{child['id']}",
        headers=headers,
        json={
            "avatar_gender": "boy",
            "avatar_config": {
                "hair": "hair_style-2",
                "eyes": "eye_style-2",
                "outfit": "outfit-2",
                "accessory": "accessory-2",
                "background": "background-2",
            },
        },
    )
    assert updated.status_code == 200
    assert updated.json()["avatar_gender"] == "boy"
    assert updated.json()["avatar_config"]["outfit"] == "outfit-2"


def test_one_user_one_profile_and_me_profile_update(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    child = create_child(seeded_client, headers)

    duplicate = seeded_client.post(
        "/children",
        headers=headers,
        json={"nickname": "Second", "grade_level": 2},
    )
    assert duplicate.status_code == 409

    profile = seeded_client.get("/me/profile", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["id"] == child["id"]

    updated = seeded_client.patch(
        "/me/profile",
        headers=headers,
        json={"program_type": "EP", "first_name": "Mali", "membership_status": "paid"},
    )
    assert updated.status_code == 200
    assert updated.json()["program_type"] == "EP"
    assert updated.json()["first_name"] == "Mali"
    assert updated.json()["membership_status"] == "paid"


def test_rankings_do_not_expose_school_fields(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    rankings = seeded_client.get("/rankings?grade_level=2&scope=province&province=Bangkok", headers=headers)
    assert rankings.status_code == 200
    assert rankings.json()
    for row in rankings.json():
        assert "nickname" in row
        assert "school_name" not in row
        assert "school_province" not in row
        assert "school_district" not in row


def test_import_content_and_idempotency(seeded_client: TestClient):
    with Session(engine) as session:
        first = import_content(session)
        counts_after_first = {
            "skills": session.scalar(select(func.count()).select_from(Skill)),
            "lessons": session.scalar(select(func.count()).select_from(Lesson)),
            "questions": session.scalar(select(func.count()).select_from(Question)),
            "quests": session.scalar(select(func.count()).select_from(LearningQuest)),
        }
        second = import_content(session)
        counts_after_second = {
            "skills": session.scalar(select(func.count()).select_from(Skill)),
            "lessons": session.scalar(select(func.count()).select_from(Lesson)),
            "questions": session.scalar(select(func.count()).select_from(Question)),
            "quests": session.scalar(select(func.count()).select_from(LearningQuest)),
        }
    assert first == second
    assert first["grades"] == 6
    assert first["quests"] >= 8
    assert counts_after_first == counts_after_second


def test_question_bank_import_idempotency(seeded_client: TestClient):
    with Session(engine) as session:
        first = import_question_banks(session)
        count_after_first = session.scalar(select(func.count()).select_from(Question))
        second = import_question_banks(session)
        count_after_second = session.scalar(select(func.count()).select_from(Question))
    assert "2" in first["grades"]
    assert "3" in first["grades"]
    assert first["grades"]["2"]["questions"] > 0
    assert second["grades"]["2"]["questions"] == first["grades"]["2"]["questions"]
    assert count_after_first == count_after_second


def test_question_bank_import_supports_grade_1_to_6_shape(seeded_client: TestClient, tmp_path):
    for grade in (1, 6):
        grade_dir = tmp_path / f"grade_{grade}"
        grade_dir.mkdir(parents=True)
        (grade_dir / "manifest.json").write_text('{"topics":[]}', encoding="utf-8")
        payload = {
            "question_id": f"g{grade}_sample_q1",
            "grade_level": grade,
            "topic_code": f"g{grade}_sample",
            "skill_code": f"g{grade}_sample",
            "question_type": "multiple_choice",
            "question_text_th": "1 + 1 = ?",
            "choices": ["1", "2", "3", "4"],
            "correct_answer": "2",
            "difficulty": "easy",
        }
        import json

        (grade_dir / f"g{grade}_sample.jsonl").write_text(json.dumps(payload, ensure_ascii=False) + "\n", encoding="utf-8")
    with Session(engine) as session:
        summary = import_question_banks(session, tmp_path)
    assert summary["grades"]["1"]["questions"] == 1
    assert summary["grades"]["6"]["questions"] == 1


def test_quest_lists_and_completion_awards_xp(content_client: TestClient):
    headers = register_and_login(content_client)
    child = create_child(content_client, headers)

    quests = content_client.get(f"/children/{child['id']}/quests", headers=headers)
    assert quests.status_code == 200
    assert any(quest["recurrence_type"] == "none" for quest in quests.json())

    daily = content_client.get(f"/children/{child['id']}/daily-quests", headers=headers)
    weekly = content_client.get(f"/children/{child['id']}/weekly-quests", headers=headers)
    monthly = content_client.get(f"/children/{child['id']}/monthly-quests", headers=headers)
    assert daily.status_code == 200
    assert weekly.status_code == 200
    assert monthly.status_code == 200
    assert daily.json()[0]["recurrence_type"] == "daily"
    assert "progress_current" in daily.json()[0]
    assert "progress_total" in daily.json()[0]
    assert "progress_percent" in daily.json()[0]
    assert "can_claim_reward" in daily.json()[0]
    assert weekly.json()[0]["recurrence_type"] == "weekly"
    assert monthly.json()[0]["recurrence_type"] == "monthly"

    quest_id = next(quest["quest_id"] for quest in quests.json() if quest["recurrence_type"] == "none")
    started = content_client.post(f"/children/{child['id']}/quests/{quest_id}/start", headers=headers)
    assert started.status_code == 200
    assert started.json()["quest"]["child_status"] == "in_progress"

    completed = content_client.post(f"/children/{child['id']}/quests/{quest_id}/complete", headers=headers)
    assert completed.status_code == 200
    assert completed.json()["quest"]["child_status"] == "completed"
    assert completed.json()["total_xp"] > 0
    assert completed.json()["coins"] > 0

    completed_again = content_client.post(f"/children/{child['id']}/quests/{quest_id}/complete", headers=headers)
    assert completed_again.status_code == 200
    assert completed_again.json()["total_xp"] == completed.json()["total_xp"]
    assert completed_again.json()["coins"] == completed.json()["coins"]


def test_rank_badges_course_map_and_recommended_quest(content_client: TestClient):
    headers = register_and_login(content_client)
    child = create_child(content_client, headers)

    badges = content_client.get(f"/children/{child['id']}/badges", headers=headers)
    assert badges.status_code == 200
    # /children/{id}/badges returns ONLY earned badges (not the whole catalogue)
    assert badges.json() == []
    with Session(engine) as session:
        badge = session.scalar(select(Badge).where(Badge.code == "addition-hero"))
        assert badge is not None
        session.add(ChildBadge(child_profile_id=child["id"], badge_id=badge.id))
        session.commit()
    earned = content_client.get(f"/children/{child['id']}/badges", headers=headers)
    assert earned.status_code == 200
    assert len(earned.json()) == 1
    assert {"id", "code", "name", "name_th", "description", "icon", "icon_url", "category", "earned"} <= set(earned.json()[0])
    assert earned.json()[0]["code"] == "addition-hero"
    assert earned.json()[0]["earned"] is True
    assert earned.json()[0]["name_th"] == "ผู้เชี่ยวชาญการบวก"
    assert earned.json()[0]["icon"]

    rank = content_client.get(f"/children/{child['id']}/rank-summary", headers=headers)
    assert rank.status_code == 200
    assert {"province_rank", "country_rank", "rank_title", "total_score", "total_xp", "average_accuracy", "average_speed_seconds"} <= set(rank.json())
    # frontend contract (lib/api/children.ts)
    assert {"current_rank", "xp_to_next_rank", "next_rank", "level", "xp_into_level"} <= set(rank.json())
    assert rank.json()["current_rank"] == rank.json()["rank_title"]
    assert rank.json()["xp_to_next_rank"] > 0
    assert rank.json()["level"] >= 1

    course_map = content_client.get(f"/children/{child['id']}/course-map", headers=headers)
    assert course_map.status_code == 200
    items = course_map.json()["items"]
    assert any(item["grade_level"] == 2 and item["lesson_type"] == "current" for item in items)
    assert any(item["grade_level"] == 1 and item["lesson_type"] == "review" for item in items)
    assert any(item["is_locked"] and item["lock_reason"] for item in items if item["lesson_type"] == "current")
    # frontend aliases (lib/api/children.ts) must coexist with the legacy keys
    for item in items:
        assert {"grade", "title", "lesson_id", "quiz_id"} <= set(item)
        assert item["grade"] == item["grade_level"]
        assert item["title"] == item["title_th"]
        assert item["quiz_id"] == item["linked_quiz_id"]

    recommended = content_client.get(f"/children/{child['id']}/recommended-next-quest", headers=headers)
    assert recommended.status_code == 200
    assert {"quest_id", "title_th", "description_th", "quest_type", "reason_th", "xp_reward", "coin_reward", "progress_current", "progress_total", "status"} <= set(recommended.json())
    # frontend aliases
    assert {"title", "description"} <= set(recommended.json())
    assert recommended.json()["title"] == recommended.json()["title_th"]
    assert recommended.json()["description"] == recommended.json()["description_th"]


def test_me_quest_listing_check_in_and_dashboard(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    create_child(seeded_client, headers)

    daily = seeded_client.get("/me/quests/daily", headers=headers)
    weekly = seeded_client.get("/me/quests/weekly", headers=headers)
    monthly = seeded_client.get("/me/quests/monthly", headers=headers)
    assert daily.status_code == 200
    assert weekly.status_code == 200
    assert monthly.status_code == 200
    assert [quest["quest_id"] for quest in daily.json()] == ["daily-check-in", "daily-lesson", "daily-test-50"]
    assert weekly.json()[0]["progress_target"] == 2
    assert monthly.json()[0]["xp_reward"] == 7

    check_in = seeded_client.post("/me/check-in", headers=headers)
    assert check_in.status_code == 200
    assert check_in.json()["days_active"] == 1

    daily_after = seeded_client.get("/me/quests/daily", headers=headers)
    check_in_quest = next(quest for quest in daily_after.json() if quest["quest_id"] == "daily-check-in")
    assert check_in_quest["child_status"] == "claimable"
    assert check_in_quest["progress_current"] == 1

    dashboard = seeded_client.get("/me/dashboard", headers=headers)
    assert dashboard.status_code == 200
    payload = dashboard.json()
    assert payload["child"]["nickname"] == "Little Star"
    assert payload["status"]["remaining_free_tests"] == 5
    assert payload["foundation_test"]["recommended_grade_level"] == 1
    assert payload["foundation_test"]["is_locked"] is False
    assert payload["test_levels"]
    assert any(level["grade"] == 1 and level["status"] == "unlocked" for level in payload["test_levels"])
    assert {"daily_quests", "weekly_quests", "monthly_quests", "lessons"} <= set(payload)
    assert payload["daily_quests"]
    assert payload["weekly_quests"]
    assert payload["monthly_quests"]
    assert payload["lessons"]
    assert {"daily", "weekly", "monthly"} <= set(payload["quests"])
    assert {"free_lessons", "locked_lessons", "current_grade_lessons", "review_lessons"} <= set(payload["lesson_sections"])
    assert payload["profile"]["nickname"] == "Little Star"
    assert payload["program_type"] == "THP"
    assert payload["quest_summary"]["daily"] >= 3
    # BUG-06: child_summary must expose rank_title (frontend falls back to total_score without it)
    assert payload["child"]["rank_title"]
    assert payload["child"]["membership_status"] == "free"
    assert payload["child"]["membership"] == "free"
    # BUG-08: backend must send the counters the dashboard counts
    assert isinstance(payload["lesson_summary"]["completed"], int)
    assert isinstance(payload["profile"]["total_tests_completed"], int)
    assert payload["lesson_summary"]["available"] > 0


def test_me_rank_summary_returns_rank_position_and_total_in_grade(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    create_child(seeded_client, headers)

    rank = seeded_client.get("/me/rank-summary", headers=headers)
    assert rank.status_code == 200
    payload = rank.json()
    assert {"total_score", "rank_title", "grade_level", "leaderboard_scope", "rank_position", "total_in_grade"} <= set(payload)
    assert payload["leaderboard_scope"] == "grade"
    assert isinstance(payload["total_in_grade"], int)
    assert payload["total_in_grade"] >= 0
    if payload["rank_position"] is not None:
        assert 1 <= payload["rank_position"] <= max(1, payload["total_in_grade"])


def test_plus_membership_unlocks_current_grade_lessons(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "plus-contract@example.com")
    child = seeded_client.post("/children", headers=headers, json={"nickname": "Plus Kid", "grade_level": 2, "membership_status": "plus"})
    assert child.status_code == 200

    # BUG-05: frontend reads child.membership, backend must expose both names
    assert child.json()["membership"] == "plus"
    assert child.json()["membership_status"] == "plus"
    assert child.json()["rank_title"]

    course_map = seeded_client.get(f"/children/{child.json()['id']}/course-map", headers=headers)
    assert course_map.status_code == 200
    current = [i for i in course_map.json()["items"] if i["grade_level"] == 2]
    assert current
    assert all(item["is_locked"] is False for item in current)


def test_me_dashboard_without_child_returns_stable_setup_payload(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "dashboard-no-child@example.com")

    response = seeded_client.get("/me/dashboard?program_type=TH", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["child"] is None
    assert payload["grade_level"] is None
    assert payload["setup_required"] is True
    assert payload["current_grade_lessons"] == []
    assert payload["review_lessons"] == []
    assert payload["recommended_skills"] == []
    assert payload["status"]["level"] == 0
    assert payload["status"]["total_xp"] == 0
    assert payload["status"]["total_score"] == 0
    assert payload["affiliate_summary"]["registered_count"] == 0


def test_me_dashboard_optional_section_failures_return_200(seeded_client: TestClient, monkeypatch):
    headers = register_and_login_as(seeded_client, "dashboard-section-failure@example.com")
    create_child(seeded_client, headers)
    import app.routers.me as me_router

    def fail_section(*_args, **_kwargs):
        raise RuntimeError("simulated optional dashboard section failure")

    monkeypatch.setattr(me_router, "_dashboard_lessons", fail_section)
    monkeypatch.setattr(me_router, "_dashboard_weak_skills", fail_section)
    monkeypatch.setattr(me_router, "_recommendations", fail_section)
    monkeypatch.setattr(me_router, "affiliate_summary", fail_section)

    response = seeded_client.get("/me/dashboard?program_type=TH", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["child"]["nickname"] == "Little Star"
    assert payload["current_grade_lessons"] == []
    assert payload["review_lessons"] == []
    assert payload["recommended_skills"] == []
    assert payload["affiliate_summary"]["registered_count"] == 0


def test_lesson_access_free_vs_paid(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    create_child(seeded_client, headers)

    lessons = seeded_client.get("/me/lessons", headers=headers)
    assert lessons.status_code == 200
    payload = lessons.json()
    assert payload["current_grade"] == 2
    lesson_rows = payload["lessons"]
    assert lesson_rows[0]["is_free"] is True
    assert lesson_rows[0]["is_locked"] is False
    assert any(lesson["is_locked"] for lesson in lesson_rows[1:])

    locked_lesson = next(lesson for lesson in lesson_rows if lesson["is_locked"])
    locked_start = seeded_client.post(f"/me/tests/{locked_lesson['lesson_id']}/start", headers=headers)
    assert locked_start.status_code == 403

    paid = seeded_client.patch("/me/profile", headers=headers, json={"membership_status": "paid"})
    assert paid.status_code == 200
    paid_lessons = seeded_client.get("/me/lessons", headers=headers)
    assert paid_lessons.status_code == 200
    assert all(not lesson["is_locked"] for lesson in paid_lessons.json()["lessons"])


def test_me_lessons_returns_grade_3_dashboard_shape(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    child_response = seeded_client.post("/children", headers=headers, json={"nickname": "Grade 3", "grade_level": 3})
    assert child_response.status_code == 200

    lessons = seeded_client.get("/me/lessons", headers=headers)
    assert lessons.status_code == 200
    payload = lessons.json()
    assert payload["current_grade"] == 3
    assert payload["membership_status"] == "free"
    assert payload["remaining_free_tests"] == 5
    assert payload["current_grade_lessons"]
    assert payload["review_lessons"]
    assert all(lesson["grade_level"] == 3 for lesson in payload["current_grade_lessons"])
    assert all(lesson["grade_level"] < 3 for lesson in payload["review_lessons"])
    assert payload["current_grade_lessons"][0]["is_locked"] is False
    assert any(lesson["is_locked"] and lesson["lock_reason"] for lesson in payload["current_grade_lessons"][1:])
    assert {"lesson_id", "title_th", "description_th", "topic_code", "skill_code", "status"} <= set(payload["current_grade_lessons"][0])
    lesson_ids = [lesson["lesson_id"] for lesson in payload["current_grade_lessons"]]
    assert len(lesson_ids) >= 5
    assert len(set(lesson_ids)) == len(lesson_ids)
    assert len({lesson["skill_code"] for lesson in payload["current_grade_lessons"]}) >= 5


def test_grade3_th_dashboard_uses_canonical_topic_lessons_and_quizzes(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "grade3-canonical-dashboard@example.com")
    child_response = seeded_client.post("/children", headers=headers, json={"nickname": "Grade 3", "grade_level": 3})
    assert child_response.status_code == 200

    response = seeded_client.get("/me/dashboard?program_type=TH", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    rows = payload["current_grade_lessons"]
    assert len(rows) == 11
    assert all(row["grade_level"] == 3 for row in rows)
    assert all(row["program_type"] == "TH" for row in rows)
    assert all(not row["lesson_group_id"].endswith("_ep") for row in rows)
    addition = next(row for row in rows if row["lesson_group_id"] == "g3_addition_subtraction")
    assert addition["topic_folder"] == "addition_subtraction"
    assert addition["test_available"] is True
    assert addition["test_disabled_reason"] is None

    test_start = seeded_client.post(
        "/me/lessons/g3_addition_subtraction/test/start?program_type=TH",
        headers=headers,
    )
    assert test_start.status_code == 200
    assert len(test_start.json()["questions"]) == 10


def test_me_lesson_detail_and_lesson_test_start(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    seeded_client.post("/children", headers=headers, json={"nickname": "Grade 3", "grade_level": 3})
    lessons = seeded_client.get("/me/lessons", headers=headers)
    lesson = lessons.json()["current_grade_lessons"][0]

    detail = seeded_client.get(f"/me/lessons/{lesson['lesson_id']}", headers=headers)
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["lesson_id"] == lesson["lesson_id"]
    assert detail_payload["id"] == lesson["lesson_id"]
    assert {"title_th", "objective_th", "story_intro_th", "explanation_steps", "worked_examples", "common_mistakes", "hints", "topic_code", "skill_code", "grade_level"} <= set(detail_payload)
    assert detail_payload["is_locked"] is False

    started = seeded_client.post(f"/me/lessons/{lesson['lesson_id']}/test/start", headers=headers)
    assert started.status_code == 200
    start_payload = started.json()
    assert start_payload["session_id"]
    assert start_payload["mode"] == "lesson"
    assert start_payload["session_type"] == "quiz"
    assert start_payload["title_th"].startswith("แบบทดสอบ:")
    assert start_payload["time_limit_seconds"] == 900

    questions = seeded_client.get(f"/me/tests/{start_payload['session_id']}/questions", headers=headers)
    assert questions.status_code == 200
    question_payload = questions.json()
    assert len(question_payload["questions"]) >= 5
    assert all(question["skill_code"] == lesson["skill_code"] for question in question_payload["questions"])
    assert all(question["topic_code"] == lesson["topic_code"] for question in question_payload["questions"])


def test_me_lesson_detail_returns_selected_variant_and_tracks_cycle(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "variant-cycle@example.com")
    child = seeded_client.post("/children", headers=headers, json={"nickname": "Variant", "grade_level": 2, "membership_status": "paid"}).json()
    lesson_id = create_variant_lesson(topic_code="variant_cycle_lesson")

    first = seeded_client.get(f"/me/lessons/{lesson_id}", headers=headers)
    second = seeded_client.get(f"/me/lessons/{lesson_id}", headers=headers)
    third = seeded_client.get(f"/me/lessons/{lesson_id}", headers=headers)
    fourth = seeded_client.get(f"/me/lessons/{lesson_id}", headers=headers)

    assert first.status_code == 200
    assert {"lesson_id", "id", "grade_level", "title_th", "objective_th", "estimated_minutes", "topic_code", "skill_code", "has_test"} <= set(first.json())
    assert first.json()["selected_variant_id"] == "v01"
    assert first.json()["variant_title_th"] == "Variant 1"
    assert first.json()["story_theme_th"] == "theme_1"
    assert first.json()["visual_blocks"] == [{"type": "image", "data": {}}]
    assert [first.json()["selected_variant_id"], second.json()["selected_variant_id"], third.json()["selected_variant_id"]] == ["v01", "v02", "v03"]
    assert fourth.json()["selected_variant_id"] == "v01"
    assert fourth.json()["variant_cycle_number"] == 2

    with Session(engine) as session:
        views = session.scalars(select(LessonVariantView).where(LessonVariantView.child_id == child["id"], LessonVariantView.lesson_id == lesson_id)).all()
        assert len(views) == 4


def test_me_lesson_detail_normalizes_object_visual_blocks(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "visual-object@example.com")
    seeded_client.post("/children", headers=headers, json={"nickname": "Visual", "grade_level": 2, "membership_status": "paid"})
    lesson_id = create_visual_block_lesson(
        topic_code="visual_object_lesson",
        visual_blocks=[
            {"type": "story_intro", "data": {"text_th": "ready"}},
            {"block_type": "emoji_counter", "items": [{"emoji": "bag", "count": 41}]},
        ],
    )

    detail = seeded_client.get(f"/me/lessons/{lesson_id}", headers=headers)

    assert detail.status_code == 200
    assert detail.json()["visual_blocks"] == [
        {"type": "story_intro", "data": {"text_th": "ready"}},
        {"type": "emoji_counter", "data": {"items": [{"emoji": "bag", "count": 41}]}},
    ]


def test_me_lesson_detail_parses_stringified_visual_blocks(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "visual-string@example.com")
    seeded_client.post("/children", headers=headers, json={"nickname": "Visual", "grade_level": 2, "membership_status": "paid"})
    lesson_id = create_visual_block_lesson(
        topic_code="visual_string_lesson",
        visual_blocks=[
            json.dumps({"type": "story_intro", "data": {"text_th": "fruit market"}}),
            json.dumps({"type": "emoji_counter", "data": {"items": [{"emoji": "apple", "count": 4}]}}),
        ],
    )

    detail = seeded_client.get(f"/me/lessons/{lesson_id}", headers=headers)

    assert detail.status_code == 200
    assert detail.json()["visual_blocks"] == [
        {"type": "story_intro", "data": {"text_th": "fruit market"}},
        {"type": "emoji_counter", "data": {"items": [{"emoji": "apple", "count": 4}]}},
    ]


def test_me_lesson_detail_invalid_string_visual_block_does_not_crash(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "visual-invalid@example.com")
    seeded_client.post("/children", headers=headers, json={"nickname": "Visual", "grade_level": 2, "membership_status": "paid"})
    lesson_id = create_visual_block_lesson(topic_code="visual_invalid_lesson", visual_blocks=["not json"])

    detail = seeded_client.get(f"/me/lessons/{lesson_id}", headers=headers)

    assert detail.status_code == 200
    assert detail.json()["visual_blocks"] == [{"type": "text", "data": {"text": "not json"}}]


def test_me_lesson_detail_g2_add_two_digit_returns_visual_block_objects(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "visual-json-catalog@example.com")
    seeded_client.post("/children", headers=headers, json={"nickname": "JSON Visual", "grade_level": 2, "membership_status": "paid"})

    detail = seeded_client.get("/me/lessons/g2_add_two_digit", headers=headers)

    assert detail.status_code == 200
    visual_blocks = detail.json()["visual_blocks"]
    assert visual_blocks
    assert all(isinstance(block, dict) for block in visual_blocks)
    assert all({"type", "data"} <= set(block) for block in visual_blocks)
    assert not any(isinstance(block, str) for block in visual_blocks)


def test_me_lesson_details_are_unique_per_lesson(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    seeded_client.post("/children", headers=headers, json={"nickname": "Grade 3", "grade_level": 3})
    lessons = seeded_client.get("/me/lessons", headers=headers).json()["current_grade_lessons"]
    first, second = lessons[0], lessons[1]

    first_detail = seeded_client.get(f"/me/lessons/{first['lesson_id']}", headers=headers)
    second_detail = seeded_client.get(f"/me/lessons/{second['lesson_id']}", headers=headers)
    assert first_detail.status_code == 200
    assert second_detail.status_code == 200
    assert first_detail.json()["lesson_id"] != second_detail.json()["lesson_id"]
    assert first_detail.json()["title_th"] != second_detail.json()["title_th"]
    assert first_detail.json()["skill_code"] != second_detail.json()["skill_code"]


def test_me_lesson_detail_loads_real_json_lessons(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    seeded_client.post("/children", headers=headers, json={"nickname": "JSON Lessons", "grade_level": 1})

    g1 = seeded_client.get("/me/lessons/g1_add_within_20", headers=headers)
    g2 = seeded_client.get("/me/lessons/g2_shapes_2d", headers=headers)
    g3 = seeded_client.get("/me/lessons/g3_fractions_intro", headers=headers)
    g6 = seeded_client.get("/me/lessons/g6_gcf_lcm", headers=headers)
    missing = seeded_client.get("/me/lessons/not-a-real-lesson", headers=headers)

    assert g1.status_code == 200
    assert g1.json()["lesson_id"] == "g1_add_within_20"
    assert g1.json()["grade_level"] == 1
    assert g1.json()["title_th"]
    assert g1.json()["objective_th"]
    assert g1.json()["explanation_steps"]
    assert "เนื้อหาบทเรียนจะแสดงที่นี่" not in g1.json()["objective_th"]

    assert g2.status_code == 200
    assert g2.json()["lesson_id"] == "g2_shapes_2d"
    assert g2.json()["grade_level"] == 2
    assert g2.json()["topic_code"] == "g2_shapes_2d"
    assert g2.json()["skill_code"] == "g2_shapes_2d"
    assert g2.json()["explanation_steps"]
    assert g2.json()["worked_examples"]

    assert g3.status_code == 200
    assert g3.json()["lesson_id"] == "g3_fractions_intro"
    assert g3.json()["grade_level"] == 3
    assert g3.json()["story_intro_th"]
    assert g3.json()["is_locked"] is False
    assert g3.json()["title_th"] != g2.json()["title_th"]
    assert g2.json()["title_th"] != g1.json()["title_th"]

    assert g6.status_code == 200
    assert g6.json()["lesson_id"] == "g6_gcf_lcm"
    assert g6.json()["grade_level"] == 6
    assert g6.json()["title_th"] != g2.json()["title_th"]
    assert g6.json()["explanation_steps"]

    assert missing.status_code == 404
    assert missing.json()["detail"] == "ไม่พบบทเรียนนี้"


def test_me_lesson_detail_db_first_does_not_block_direct_json_id_for_lower_grade(content_client: TestClient):
    headers = register_and_login(content_client)
    content_client.post("/children", headers=headers, json={"nickname": "Lower Grade", "grade_level": 1})

    detail = content_client.get("/me/lessons/g3_fractions_intro", headers=headers)
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["lesson_id"] == "g3_fractions_intro"
    assert payload["grade_level"] == 3
    assert payload["title_th"]
    assert payload["objective_th"]
    assert payload["story_intro_th"]
    assert payload["explanation_steps"]
    assert payload["is_locked"] is False


def test_me_lessons_returns_ids_from_json_files(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    seeded_client.post("/children", headers=headers, json={"nickname": "JSON Catalog", "grade_level": 6, "membership_status": "paid"})

    lessons = seeded_client.get("/me/lessons", headers=headers)
    assert lessons.status_code == 200
    lesson_ids = {lesson["lesson_id"] for lesson in lessons.json()["lessons"]}
    assert {"g1_add_within_20", "g1_counting_numbers", "g2_shapes_2d", "g3_fractions_intro", "g6_gcf_lcm"} <= lesson_ids

    for lesson_id in list(lesson_ids)[:10]:
        detail = seeded_client.get(f"/me/lessons/{lesson_id}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["lesson_id"] == lesson_id


def test_lesson_tracks_are_separate_for_thp_and_ep(seeded_client: TestClient):
    thp_headers = register_and_login_as(seeded_client, "track-thp@example.com")
    seeded_client.post("/children", headers=thp_headers, json={"nickname": "THP", "grade_level": 3, "membership_status": "paid", "program_type": "THP"})
    thp_lessons = seeded_client.get("/me/lessons", headers=thp_headers)
    assert thp_lessons.status_code == 200
    thp_ids = {lesson["lesson_id"] for lesson in thp_lessons.json()["lessons"]}
    assert "g3_multiplication_area_model_thp" in thp_ids
    assert "g3_multiplication_area_model_ep" not in thp_ids

    ep_headers = register_and_login_as(seeded_client, "track-ep@example.com")
    seeded_client.post("/children", headers=ep_headers, json={"nickname": "EP", "grade_level": 3, "membership_status": "paid", "program_type": "EP"})
    ep_lessons = seeded_client.get("/me/lessons", headers=ep_headers)
    assert ep_lessons.status_code == 200
    ep_ids = {lesson["lesson_id"] for lesson in ep_lessons.json()["lessons"]}
    assert "g3_multiplication_area_model_ep" in ep_ids
    assert "g3_multiplication_area_model_thp" not in ep_ids

    ep_detail = seeded_client.get("/me/lessons/g3_multiplication_area_model_ep", headers=ep_headers)
    assert ep_detail.status_code == 200
    ep_payload = ep_detail.json()
    assert ep_payload["program_type"] == "EP"
    assert ep_payload["title_en"] == "Multiplication with an Area Model"
    assert ep_payload["vocabulary"]


def test_admin_content_quality_endpoint_reports_sample_lessons(seeded_client: TestClient):
    login = seeded_client.post("/auth/login", json={"email": "admin@4-craft.local", "password": "admin12345"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    response = seeded_client.get("/admin/content-quality", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["total_lessons"] >= 2
    sample = {
        lesson["lesson_id"]: lesson
        for lesson in payload["lessons"]
        if lesson["lesson_id"] in {"g3_multiplication_area_model_thp", "g3_multiplication_area_model_ep"}
    }
    assert sample["g3_multiplication_area_model_thp"]["publishable"] is True
    assert sample["g3_multiplication_area_model_ep"]["publishable"] is True


def test_non_admin_cannot_access_admin_metrics(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "not-admin@example.com")
    response = seeded_client.get("/admin/metrics", headers=headers)
    assert response.status_code == 403


def test_admin_metrics_endpoint_works(seeded_client: TestClient):
    login = seeded_client.post("/auth/login", json={"email": "admin@4-craft.local", "password": "admin12345"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = seeded_client.get("/admin/metrics", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_users"] >= 1
    assert "free_users" in payload
    assert "mrr" in payload
    assert isinstance(payload["users_by_plan"], dict)


def test_dev_owner_account_can_access_admin_metrics(seeded_client: TestClient):
    login = seeded_client.post("/auth/login", json={"email": "infomilliongarden@gmail.com", "password": "Admin123456!"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    me = seeded_client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["role"] == "owner"

    response = seeded_client.get("/admin/metrics", headers=headers)
    assert response.status_code == 200


def test_me_quests_return_frontend_shape(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    create_child(seeded_client, headers)

    for recurrence in ("daily", "weekly", "monthly"):
        response = seeded_client.get(f"/me/quests/{recurrence}", headers=headers)
        assert response.status_code == 200
        quests = response.json()
        assert quests
        assert {"quest_id", "title_th", "description_th", "progress_current", "progress_total", "progress_percent", "xp_reward", "coin_reward", "status", "can_claim_reward"} <= set(quests[0])


def test_fixed_passive_quest_templates_and_rewards(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    create_child(seeded_client, headers)

    daily = seeded_client.get("/me/quests/daily", headers=headers).json()
    weekly = seeded_client.get("/me/quests/weekly", headers=headers).json()
    monthly = seeded_client.get("/me/quests/monthly", headers=headers).json()

    assert len(daily) == 3
    assert len(weekly) == 11
    assert len(monthly) == 9
    assert [quest["title_th"] for quest in daily] == ["เช็กชื่อในระบบ", "เข้าเรียนเนื้อหา", "ทำเทส ตอบถูกเกิน 50%"]
    assert all(quest["xp_reward"] == 1 and quest["exp_reward"] == 1 for quest in daily)
    assert all(quest["xp_reward"] == 3 and quest["exp_reward"] == 3 for quest in weekly)
    assert all(quest["xp_reward"] == 7 and quest["exp_reward"] == 7 for quest in monthly)
    assert daily[0]["status"] == "active"
    assert daily[0]["can_claim_reward"] is False
    assert "reset_at" in daily[0]
    assert {quest["metric_type"] for quest in weekly} == {"check_in", "lesson", "friend", "test_50", "test_100"}


def test_quest_claim_rewards_and_duplicate_rejection(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    child = create_child(seeded_client, headers)

    checked_in = seeded_client.post("/me/check-in", headers=headers)
    assert checked_in.status_code == 200
    duplicate_check_in = seeded_client.post("/me/check-in", headers=headers)
    assert duplicate_check_in.status_code == 200
    assert duplicate_check_in.json()["already_checked_in"] is True

    daily = seeded_client.get("/me/quests/daily", headers=headers).json()
    check_in = next(quest for quest in daily if quest["quest_id"] == "daily-check-in")
    assert check_in["progress_current"] == 1
    assert check_in["status"] == "claimable"

    claimed = seeded_client.post("/me/quests/daily-check-in/claim", headers=headers)
    assert claimed.status_code == 200
    assert claimed.json()["status"] == "claimed"
    assert claimed.json()["exp_awarded"] == 1
    assert claimed.json()["updated_status"]["total_xp"] == 1
    daily_after_claim = seeded_client.get("/me/quests/daily", headers=headers).json()
    claimed_daily = next(quest for quest in daily_after_claim if quest["quest_id"] == "daily-check-in")
    assert claimed_daily["status"] == "claimed"
    assert claimed_daily["can_claim_reward"] is False
    assert claimed_daily["claimed_at"] is not None
    dashboard_after_claim = seeded_client.get("/me/dashboard", headers=headers)
    assert dashboard_after_claim.status_code == 200
    assert dashboard_after_claim.json()["status"]["total_xp"] == 1

    claimed_again = seeded_client.post("/me/quests/daily-check-in/claim", headers=headers)
    assert claimed_again.status_code == 409
    assert claimed_again.json()["detail"] == "รับรางวัลเควสนี้แล้ว"

    incomplete = seeded_client.post("/me/quests/daily-lesson/claim", headers=headers)
    assert incomplete.status_code == 400
    assert incomplete.json()["detail"] == "ยังทำเควสไม่สำเร็จ"

    missing = seeded_client.post("/me/quests/not-real/claim", headers=headers)
    assert missing.status_code == 404
    assert missing.json()["detail"] == "ไม่พบเควสนี้"

    with Session(engine) as session:
        today = date.today()
        profile = session.get(ChildProfile, child["id"])
        session.add(CheckInEvent(child_profile_id=profile.id, event_date=today, period_day=today.isoformat(), created_at=datetime.utcnow()))
        session.commit()

    weekly_claimable = seeded_client.get("/me/quests/weekly", headers=headers).json()[0]
    assert weekly_claimable["quest_id"] == "weekly-check-in-2"
    assert weekly_claimable["status"] == "claimable"
    weekly_claim = seeded_client.post("/me/quests/weekly-check-in-2/claim", headers=headers)
    assert weekly_claim.status_code == 200
    assert weekly_claim.json()["exp_awarded"] == 3

    monthly_claimable = seeded_client.get("/me/quests/monthly", headers=headers).json()[0]
    if monthly_claimable["status"] != "claimable":
        with Session(engine) as session:
            profile = session.get(ChildProfile, child["id"])
            for index in range(8):
                event_date = date.today()
                session.add(CheckInEvent(child_profile_id=profile.id, event_date=event_date, period_day=event_date.isoformat(), created_at=datetime.utcnow()))
            session.commit()
    monthly_claim = seeded_client.post("/me/quests/monthly-check-in-10/claim", headers=headers)
    assert monthly_claim.status_code == 200
    assert monthly_claim.json()["exp_awarded"] == 7


def test_activity_updates_lesson_and_test_quest_progress(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    create_child(seeded_client, headers)
    paid = seeded_client.patch("/me/profile", headers=headers, json={"membership_status": "paid"})
    assert paid.status_code == 200

    lesson_id = seeded_client.get("/me/lessons", headers=headers).json()["lessons"][0]["lesson_id"]
    started_lesson = seeded_client.post(f"/me/lessons/{lesson_id}/start", headers=headers)
    assert started_lesson.status_code == 200
    daily_lesson = next(quest for quest in seeded_client.get("/me/quests/daily", headers=headers).json() if quest["quest_id"] == "daily-lesson")
    assert daily_lesson["progress_current"] == 1
    assert daily_lesson["status"] == "claimable"

    started = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 2, "session_type": "quiz"})
    assert started.status_code == 200
    session_id = started.json()["session_id"]
    questions = seeded_client.get(f"/me/tests/{session_id}/questions", headers=headers).json()["questions"]
    with Session(engine) as session:
        db_session = session.get(DbTestSession, session_id)
        correct_by_id = {
            question.id: question.correct_answer
            for question in session.scalars(select(Question).where(Question.id.in_(db_session.question_ids))).all()
        }
    answers = [{"question_id": question["question_id"], "selected_answer": correct_by_id[question["question_id"]], "response_time_ms": 1000} for question in questions]
    finished = seeded_client.post(f"/me/tests/{session_id}/finish", headers=headers, json={"answers": answers, "total_time_ms": 10000})
    assert finished.status_code == 200
    assert finished.json()["score_percent"] == 100

    daily_quests = seeded_client.get("/me/quests/daily", headers=headers).json()
    assert next(quest for quest in daily_quests if quest["quest_id"] == "daily-test-50")["status"] == "claimable"
    weekly = seeded_client.get("/me/quests/weekly", headers=headers).json()
    assert next(quest for quest in weekly if quest["quest_id"] == "weekly-test-100-1")["status"] == "claimable"


def test_me_test_levels_foundation_and_membership_rules(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    create_child(seeded_client, headers)

    levels = seeded_client.get("/me/test-levels", headers=headers)
    assert levels.status_code == 200
    payload = levels.json()
    # /me/test-levels returns the plain TestLevel[] list (see lib/api/me.ts)
    assert isinstance(payload, list)
    assert [level for level in payload if not level["is_locked"]][0]["grade_level"] == 1
    blocked_level = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 2, "mode": "foundation"})
    assert blocked_level.status_code == 403
    assert blocked_level.json()["detail"] == "สมาชิกฟรีทำได้เฉพาะเทสที่ระบบแนะนำ"

    paid = seeded_client.patch("/me/profile", headers=headers, json={"membership_status": "paid"})
    assert paid.status_code == 200
    paid_levels = seeded_client.get("/me/test-levels", headers=headers)
    assert paid_levels.status_code == 200
    assert all(not level["is_locked"] for level in paid_levels.json())


def test_plus_user_can_access_all_test_levels_and_lessons(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "plus-access@example.com")
    seeded_client.post("/children", headers=headers, json={"nickname": "Plus", "grade_level": 3})

    before, after = set_user_plus("plus-access@example.com")
    assert before.membership_status == "free"
    assert after.membership_status == "paid"
    assert after.is_paid is True

    dashboard = seeded_client.get("/me/dashboard", headers=headers)
    assert dashboard.status_code == 200
    dashboard_payload = dashboard.json()
    assert dashboard_payload["child"]["membership_status"] == "paid"
    assert dashboard_payload["status"]["remaining_free_tests"] == 999999
    assert all(not level["is_locked"] for level in dashboard_payload["test_levels"])
    assert {level["grade_level"] for level in dashboard_payload["test_levels"]} == {1, 2, 3, 4, 5, 6}

    lessons = seeded_client.get("/me/lessons", headers=headers)
    assert lessons.status_code == 200
    lesson_rows = lessons.json()["lessons"]
    assert all(not lesson["is_locked"] for lesson in lesson_rows)
    assert {1, 6} <= {lesson["grade_level"] for lesson in lesson_rows}

    grade_1 = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 1, "mode": "foundation"})
    grade_6 = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 6, "mode": "foundation"})
    assert grade_1.status_code == 200
    assert grade_6.status_code == 200
    assert grade_1.json()["session_id"]
    assert grade_6.json()["session_id"]


@pytest.mark.parametrize(
    ("plan_code", "active_price_code", "billing_program_type"),
    [
        ("th_plus", "th_founder_monthly", "TH"),
        ("ep_plus", "ep_plus_monthly", "EP"),
    ],
)
def test_paid_plan_user_can_access_all_current_th_tests_and_lessons(seeded_client: TestClient, plan_code, active_price_code, billing_program_type):
    headers = register_and_login_as(seeded_client, f"{plan_code}-access@example.com")
    child = create_child(seeded_client, headers)
    with Session(engine) as session:
        profile = session.get(ChildProfile, child["id"])
        profile.membership_status = "plus"
        profile.plan_code = plan_code
        profile.active_price_code = active_price_code
        profile.billing_program_type = billing_program_type
        profile.price_type = "founder" if "founder" in active_price_code else "normal"
        profile.subscription_status = "active"
        session.commit()

    levels = seeded_client.get("/me/test-levels", headers=headers)
    assert levels.status_code == 200
    assert all(not level["is_locked"] for level in levels.json())

    lessons = seeded_client.get("/me/lessons", headers=headers)
    assert lessons.status_code == 200
    assert all(not lesson["is_locked"] for lesson in lessons.json()["lessons"])

    grade_6 = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 6, "mode": "foundation"})
    assert grade_6.status_code == 200


def test_lesson_test_uses_80_20_core_challenge_ratio(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "lesson-ratio@example.com")
    seeded_client.post("/children", headers=headers, json={"nickname": "Ratio", "grade_level": 3, "membership_status": "paid"})
    lesson_id = create_ratio_lesson_bank(3, topic_code="ratio_lesson_10", core_count=8, challenge_count=2)

    started = seeded_client.post(f"/me/lessons/{lesson_id}/test/start", headers=headers)
    assert started.status_code == 200
    payload = started.json()
    assert payload["ratio_policy"] == "80_core_20_challenge"
    assert payload["core_question_count"] == 8
    assert payload["challenge_question_count"] == 2

    questions = seeded_client.get(f"/me/tests/{payload['session_id']}/questions", headers=headers)
    assert questions.status_code == 200
    assert "question_type" not in questions.json()["questions"][0]


def test_five_question_review_test_uses_4_1_ratio(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "review-ratio@example.com")
    seeded_client.post("/children", headers=headers, json={"nickname": "Ratio", "grade_level": 3, "membership_status": "paid"})
    lesson_id = create_ratio_lesson_bank(3, topic_code="ratio_review_5", core_count=4, challenge_count=1)

    started = seeded_client.post(f"/me/tests/{lesson_id}/start", headers=headers)
    assert started.status_code == 200
    payload = started.json()
    assert payload["ratio_policy"] == "80_core_20_challenge"
    assert payload["core_question_count"] == 4
    assert payload["challenge_question_count"] == 1


def test_foundation_and_grade_level_tests_use_80_20_ratio(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "foundation-ratio@example.com")
    seeded_client.post("/children", headers=headers, json={"nickname": "Ratio", "grade_level": 4, "membership_status": "paid"})
    create_ratio_lesson_bank(4, topic_code="ratio_foundation_10", core_count=8, challenge_count=2)

    foundation = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 4, "mode": "foundation"})
    grade_level = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 4, "session_type": "quiz"})
    assert foundation.status_code == 200
    assert grade_level.status_code == 200
    assert foundation.json()["core_question_count"] == 8
    assert foundation.json()["challenge_question_count"] == 2
    assert grade_level.json()["core_question_count"] == 8
    assert grade_level.json()["challenge_question_count"] == 2


def test_ratio_fallback_fills_with_core_when_challenge_missing(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "ratio-fallback@example.com")
    seeded_client.post("/children", headers=headers, json={"nickname": "Ratio", "grade_level": 5, "membership_status": "paid"})
    create_ratio_lesson_bank(5, topic_code="ratio_core_only_10", core_count=10, challenge_count=0)

    started = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 5, "mode": "foundation"})
    assert started.status_code == 200
    payload = started.json()
    assert payload["core_question_count"] == 10
    assert payload["challenge_question_count"] == 0
    assert len(payload["questions"]) == 10


def test_question_rotation_does_not_repeat_core_until_exhausted_and_tracks_challenge_separately(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "rotation@example.com")
    seeded_client.post("/children", headers=headers, json={"nickname": "Rotation", "grade_level": 2, "membership_status": "paid"})
    lesson_id = create_ratio_lesson_bank(2, topic_code="rotation_bank", core_count=16, challenge_count=2)

    first = seeded_client.post(f"/me/lessons/{lesson_id}/test/start", headers=headers)
    assert first.status_code == 200
    first_questions = first.json()["questions"]
    first_core = {question["id"] for question in first_questions if question["difficulty"] != "hard"}
    first_challenge = {question["id"] for question in first_questions if question["difficulty"] == "hard"}
    assert first.json()["core_question_count"] == 8
    assert first.json()["challenge_question_count"] == 2
    assert first.json()["rotation_cycle"] == 1

    finished = seeded_client.post(
        f"/me/tests/{first.json()['session_id']}/finish",
        headers=headers,
        json={
            "answers": [{"question_id": question["question_id"], "selected_answer": "", "response_time_ms": 1000} for question in first_questions],
            "total_time_ms": 10000,
        },
    )
    assert finished.status_code == 200
    assert finished.json()["core_total"] == 8
    assert finished.json()["challenge_total"] == 2

    second = seeded_client.post(f"/me/lessons/{lesson_id}/test/start", headers=headers)
    assert second.status_code == 200
    second_questions = second.json()["questions"]
    second_core = {question["id"] for question in second_questions if question["difficulty"] != "hard"}
    second_challenge = {question["id"] for question in second_questions if question["difficulty"] == "hard"}

    assert first_core.isdisjoint(second_core)
    assert second_challenge == first_challenge
    with Session(engine) as session:
        history = session.scalars(select(QuestionAttemptHistory)).all()
        assert len(history) == 10
        assert {row.question_type for row in history} == {"core", "challenge"}
        assert {row.rotation_scope for row in history} == {"lesson"}


def test_foundation_test_start_creates_80_20_rotation_metadata(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "foundation-rotation@example.com")
    seeded_client.post("/children", headers=headers, json={"nickname": "Foundation Rotation", "grade_level": 2, "membership_status": "paid"})
    create_ratio_lesson_bank(1, topic_code="foundation_rotation_bank", core_count=20, challenge_count=5)

    started = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 1, "mode": "foundation"})

    assert started.status_code == 200
    payload = started.json()
    assert payload["core_question_count"] == 8
    assert payload["challenge_question_count"] == 2
    assert payload["ratio_policy"] == "80_core_20_challenge"
    assert payload["rotation_cycle"] == 1
    with Session(engine) as session:
        test_session = session.get(DbTestSession, payload["session_id"])
        assert test_session.metadata_json["rotation_scope"] == "foundation"
        assert test_session.metadata_json["rotation_key"] == "foundation:g1"


def test_finish_response_includes_core_challenge_breakdown(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "ratio-finish@example.com")
    seeded_client.post("/children", headers=headers, json={"nickname": "Ratio", "grade_level": 6, "membership_status": "paid"})
    create_ratio_lesson_bank(6, topic_code="ratio_finish_10", core_count=8, challenge_count=2)

    started = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 6, "mode": "foundation"})
    assert started.status_code == 200
    session_id = started.json()["session_id"]
    with Session(engine) as session:
        test_session = session.get(DbTestSession, session_id)
        questions = session.scalars(select(Question).where(Question.id.in_(test_session.question_ids))).all()
        by_id = {question.id: question for question in questions}
        ordered = [by_id[question_id] for question_id in test_session.question_ids]
        answers = [{"question_id": question.id, "selected_answer": question.correct_answer, "response_time_ms": 1000} for question in ordered]

    finished = seeded_client.post(f"/me/tests/{session_id}/finish", headers=headers, json={"answers": answers, "total_time_ms": 10000})
    assert finished.status_code == 200
    payload = finished.json()
    assert payload["core_total"] == 8
    assert payload["challenge_total"] == 2
    assert payload["core_correct_count"] == 8
    assert payload["challenge_correct_count"] == 2
    assert payload["core_accuracy"] == 100
    assert payload["challenge_accuracy"] == 100


def test_finish_records_raw_and_normalized_answers(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "normalized-store@example.com")
    child = seeded_client.post("/children", headers=headers, json={"nickname": "Normalize", "grade_level": 1, "membership_status": "paid"}).json()
    with Session(engine) as session:
        subject = session.scalar(select(Subject).where(Subject.code == "math")) or Subject(code="math", name="Math")
        session.add(subject)
        session.flush()
        skill = Skill(subject_id=subject.id, grade_level=1, code="normalize_skill", name="Normalize", difficulty_order=1)
        session.add(skill)
        session.flush()
        question = Question(
            skill_id=skill.id,
            grade_level=1,
            question_type="multiple_choice",
            difficulty="easy",
            question_text="27?",
            choices=["26", "27", "28", "29"],
            correct_answer="27",
            status="approved",
            metadata_json={"question_type": "core"},
        )
        session.add(question)
        session.flush()
        test_session = DbTestSession(child_profile_id=child["id"], question_ids=[question.id], quiz_id="normalize-test")
        session.add(test_session)
        session.commit()
        session_id = test_session.id
        question_id = question.id

    finished = seeded_client.post(
        f"/me/tests/{session_id}/finish",
        headers=headers,
        json={"answers": [{"question_id": question_id, "selected_answer": " ๒๗ ", "response_time_ms": 1000}]},
    )

    assert finished.status_code == 200
    assert finished.json()["correct_count"] == 1
    with Session(engine) as session:
        answer = session.scalar(select(QuizAnswer).where(QuizAnswer.question_id == question_id))
        assert answer.selected_answer == " ๒๗ "
        assert answer.selected_answer_raw == " ๒๗ "
        assert answer.selected_answer_normalized == "27"
        assert answer.correct_answer_normalized == "27"
        assert answer.is_correct is True


def test_me_dashboard_returns_compatible_foundation_grade(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    create_child(seeded_client, headers)

    dashboard = seeded_client.get("/me/dashboard", headers=headers)
    assert dashboard.status_code == 200
    payload = dashboard.json()
    assert {"child", "status", "foundation_test", "daily_quests", "weekly_quests", "monthly_quests", "lessons", "test_levels", "recommendations"} <= set(payload)
    assert isinstance(payload["daily_quests"], list)
    assert isinstance(payload["weekly_quests"], list)
    assert isinstance(payload["monthly_quests"], list)
    assert isinstance(payload["lessons"], list)
    foundation = payload["foundation_test"]
    assert foundation["recommended_grade"] == 1
    assert foundation["recommended_grade_level"] == 1
    assert foundation["is_locked"] is False
    assert foundation["reason_th"] == "ใช้ฟรีได้ 5 ครั้งสำหรับเทสที่ระบบแนะนำ"
    assert any(level["grade"] == foundation["recommended_grade"] for level in payload["test_levels"])


def test_me_test_flow_accepts_session_type_and_hides_answers(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    create_child(seeded_client, headers)

    started = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 1, "session_type": "quiz"})
    assert started.status_code == 200
    start_payload = started.json()
    assert start_payload["session_id"]
    assert start_payload["session_type"] == "quiz"
    assert start_payload["mode"] == "foundation"
    assert start_payload["title_th"] == "เทสพื้นฐาน ป.1"
    assert len(start_payload["questions"]) >= 5

    questions = seeded_client.get(f"/me/tests/{start_payload['session_id']}/questions", headers=headers)
    assert questions.status_code == 200
    question_payload = questions.json()
    assert len(question_payload["questions"]) >= 5
    first_question = question_payload["questions"][0]
    assert "question_id" in first_question
    assert "question_text_th" in first_question
    assert "correct_answer" not in first_question

    with Session(engine) as session:
        test_session = session.get(DbTestSession, start_payload["session_id"])
        first_answer = session.get(Question, test_session.question_ids[0]).correct_answer

    submitted = seeded_client.post(
        f"/me/tests/{start_payload['session_id']}/submit",
        headers=headers,
        json={
            "question_id": first_question["question_id"],
            "selected_answer": first_answer,
            "response_time_ms": 12000,
        },
    )
    assert submitted.status_code == 200
    assert submitted.json()["is_correct"] is True
    assert submitted.json()["correct_answer"] == first_answer

    answers = [
        {"question_id": question["question_id"], "selected_answer": "", "response_time_ms": 1000}
        for question in question_payload["questions"]
    ]
    finished = seeded_client.post(
        f"/me/tests/{start_payload['session_id']}/finish",
        headers=headers,
        json={"answers": answers, "total_time_ms": 300000},
    )
    assert finished.status_code == 200
    result = finished.json()
    assert result["score_percent"] == 0
    assert result["correct_count"] == 0
    assert result["total_questions"] == len(question_payload["questions"])
    assert result["xp_earned"] == 5
    assert result["score_earned"] == 0
    assert result["updated_status"]["total_xp"] == 5
    assert result["updated_status"]["total_score"] == 0
    assert result["updated_status"]["test_attempts_used"] == 1

    with Session(engine) as session:
        stored_result = session.scalar(select(DbTestResult).where(DbTestResult.test_session_id == start_payload["session_id"]))
        assert stored_result is not None
        assert stored_result.total_time_ms == 300000

    dashboard_after = seeded_client.get("/me/dashboard", headers=headers)
    assert dashboard_after.status_code == 200
    assert dashboard_after.json()["status"]["test_attempts_used"] == 1
    assert dashboard_after.json()["status"]["total_xp"] == 5
    assert dashboard_after.json()["status"]["total_score"] == 0


def test_foundation_grade_2_draws_multiple_topics_for_grade_3_paid_child(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    child_response = seeded_client.post("/children", headers=headers, json={"nickname": "Grade 3", "grade_level": 3, "membership_status": "paid"})
    assert child_response.status_code == 200

    started = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 2, "session_type": "quiz"})
    assert started.status_code == 200
    questions = seeded_client.get(f"/me/tests/{started.json()['session_id']}/questions", headers=headers)
    assert questions.status_code == 200
    question_payload = questions.json()
    assert len(question_payload["questions"]) >= 10
    topic_codes = {question["topic_code"] or question["skill_code"] for question in question_payload["questions"]}
    assert len(topic_codes) >= 3


def test_me_finish_scores_and_dashboard_reflects_score_xp(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    seeded_client.post("/children", headers=headers, json={"nickname": "Scorer", "grade_level": 3})

    started = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 2, "session_type": "quiz"})
    assert started.status_code == 200
    session_id = started.json()["session_id"]
    questions = seeded_client.get(f"/me/tests/{session_id}/questions", headers=headers).json()["questions"]

    with Session(engine) as session:
        db_session = session.get(DbTestSession, session_id)
        correct_by_id = {
            question.id: question.correct_answer
            for question in session.scalars(select(Question).where(Question.id.in_(db_session.question_ids))).all()
        }

    answers = [
        {
            "question_id": question["question_id"],
            "selected_answer": correct_by_id[question["question_id"]] if index < 7 else "",
            "response_time_ms": 12000,
        }
        for index, question in enumerate(questions)
    ]
    finished = seeded_client.post(
        f"/me/tests/{session_id}/finish",
        headers=headers,
        json={"answers": answers, "total_time_ms": 300000},
    )
    assert finished.status_code == 200
    payload = finished.json()
    assert payload["score_percent"] == 70
    assert payload["correct_count"] == 7
    assert payload["total_questions"] == 10
    assert payload["score_earned"] == 70
    assert payload["xp_earned"] == 20
    assert payload["updated_status"]["total_score"] >= 70
    assert payload["updated_status"]["total_xp"] >= 20

    dashboard = seeded_client.get("/me/dashboard", headers=headers)
    assert dashboard.status_code == 200
    status = dashboard.json()["status"]
    assert status["total_score"] == payload["updated_status"]["total_score"]
    assert status["total_xp"] == payload["updated_status"]["total_xp"]
    assert status["test_attempts_used"] == 1


def test_free_user_cannot_start_sixth_foundation_test(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    child = create_child(seeded_client, headers)
    with Session(engine) as session:
        profile = session.get(ChildProfile, child["id"])
        profile.test_attempts_used = 5
        session.commit()

    blocked = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 1, "mode": "foundation"})
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "ใช้สิทธิ์เทสฟรีครบแล้ว กรุณาอัปเกรดเพื่อทำเทสเพิ่มเติม"


def test_free_grade_3_child_can_start_recommended_grade_2_foundation_test(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    child_response = seeded_client.post("/children", headers=headers, json={"nickname": "Grade 3 Free", "grade_level": 3})
    assert child_response.status_code == 200

    dashboard = seeded_client.get("/me/dashboard", headers=headers)
    assert dashboard.status_code == 200
    foundation = dashboard.json()["foundation_test"]
    assert foundation["recommended_grade"] == 2
    assert foundation["recommended_grade_level"] == 2
    assert foundation["is_locked"] is False
    assert foundation["reason_th"] == "ใช้ฟรีได้ 5 ครั้งสำหรับเทสที่ระบบแนะนำ"
    assert any(level["grade"] == 2 and level["status"] == "unlocked" for level in dashboard.json()["test_levels"])

    started = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 2, "session_type": "quiz"})
    assert started.status_code == 200
    payload = started.json()
    assert payload["session_id"]
    assert payload["grade_level"] == 2
    assert payload["mode"] == "foundation"


def test_recommended_foundation_start_uses_fallback_when_grade_questions_missing(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    child_response = seeded_client.post("/children", headers=headers, json={"nickname": "Grade 3 Free", "grade_level": 3})
    assert child_response.status_code == 200
    with Session(engine) as session:
        for question in session.scalars(select(Question).where(Question.grade_level == 2)).all():
            session.delete(question)
        session.commit()

    started = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 2, "session_type": "quiz"})
    assert started.status_code == 200
    start_payload = started.json()
    assert start_payload["session_id"]
    assert start_payload["grade_level"] == 2

    questions = seeded_client.get(f"/me/tests/{start_payload['session_id']}/questions", headers=headers)
    assert questions.status_code == 200
    question_payload = questions.json()
    assert len(question_payload["questions"]) >= 10
    assert all(len(question["choices"]) == 4 for question in question_payload["questions"])
    assert "correct_answer" not in question_payload["questions"][0]
    topic_codes = {question["topic_code"] for question in question_payload["questions"]}
    assert len(topic_codes) >= 3


def test_free_grade_3_child_cannot_start_non_recommended_foundation_grade(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    seeded_client.post("/children", headers=headers, json={"nickname": "Grade 3 Free", "grade_level": 3})

    for grade in (1, 3, 4, 5, 6):
        blocked = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": grade, "session_type": "quiz"})
        assert blocked.status_code == 403
        assert blocked.json()["detail"] == "สมาชิกฟรีทำได้เฉพาะเทสที่ระบบแนะนำ"


def test_paid_user_can_start_grade_1_to_6_tests(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    create_child(seeded_client, headers)
    paid = seeded_client.patch("/me/profile", headers=headers, json={"membership_status": "paid"})
    assert paid.status_code == 200

    for grade in range(1, 7):
        started = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": grade, "mode": "foundation"})
        assert started.status_code == 200
        assert started.json()["grade_level"] == grade
        assert len(started.json()["questions"]) >= 5


def test_foundation_grade_logic_for_grades_1_to_6(seeded_client: TestClient):
    expected = {1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5}
    for grade, recommended in expected.items():
        headers = register_and_login_as(seeded_client, f"foundation-grade-{grade}@example.com")
        child_response = seeded_client.post("/children", headers=headers, json={"nickname": f"G{grade}", "grade_level": grade})
        assert child_response.status_code == 200
        dashboard = seeded_client.get("/me/dashboard", headers=headers)
        assert dashboard.status_code == 200
        assert dashboard.json()["foundation_test"]["recommended_grade_level"] == recommended


def test_free_user_test_limit_and_submission_recommendations(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    create_child(seeded_client, headers)

    last_result = None
    for _ in range(5):
        started = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 1, "mode": "foundation"})
        assert started.status_code == 200
        answers = [
            {"question_id": question["id"], "selected_answer": "0", "response_time_ms": 12000}
            for question in started.json()["questions"]
        ]
        submitted = seeded_client.post(
            f"/me/tests/{started.json()['session_id']}/submit",
            headers=headers,
            json={"answers": answers, "total_time_ms": 300000},
        )
        assert submitted.status_code == 200
        last_result = submitted.json()

    blocked = seeded_client.post("/me/tests/start", headers=headers, json={"grade_level": 1, "mode": "foundation"})
    assert blocked.status_code == 403
    assert last_result["score_percent"] == 0
    assert last_result["total_time_ms"] == 300000
    assert last_result["weak_skills"]
    assert last_result["recommendations"]


def test_grade_1_to_6_profiles_and_placement(content_client: TestClient):
    for grade in range(1, 7):
        headers = register_and_login_as(content_client, f"grade{grade}@example.com")
        child_response = content_client.post(
            "/children",
            headers=headers,
            json={"nickname": f"Grade {grade}", "grade_level": grade},
        )
        assert child_response.status_code == 200
        assert child_response.json()["grade_level"] == grade
        placement = content_client.post(f"/children/{child_response.json()['id']}/placement/start", headers=headers)
        assert placement.status_code == 200
        questions = placement.json()["questions"]
        assert len(questions) > 0
        assert len({question["id"] for question in questions}) == len(questions)
        assert all(question["grade_level"] == grade for question in questions)


def test_test_completion_updates_stats_rank_and_lesson_progress(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    create_child(seeded_client, headers)
    review_lessons = seeded_client.get("/me/review-lessons", headers=headers)
    assert review_lessons.status_code == 200
    lesson_id = review_lessons.json()[0]["id"]

    started = seeded_client.post(f"/me/tests/{lesson_id}/start", headers=headers)
    assert started.status_code == 200
    start_payload = started.json()
    answers = {}
    response_times = {}
    for question in start_payload["questions"]:
        answers[question["id"]] = "5"
        response_times[question["id"]] = 1000

    submitted = seeded_client.post(
        f"/me/tests/{start_payload['test_session_id']}/submit",
        headers=headers,
        json={"answers": answers, "response_times_ms": response_times},
    )
    assert submitted.status_code == 200
    result = submitted.json()
    assert result["accuracy"] == 100
    assert result["score_awarded"] == 100
    assert result["rank_title"] == "เด็กนักเรียน"

    stats = seeded_client.get("/me/stats", headers=headers)
    assert stats.status_code == 200
    assert stats.json()["test_count"] == 1
    assert stats.json()["lesson_count"] == 1
    assert stats.json()["rank_title"] == "เด็กนักเรียน"

    rank = seeded_client.get("/me/rank-summary", headers=headers)
    assert rank.status_code == 200
    assert rank.json()["total_score"] >= 100


def test_main_learning_flow(seeded_client: TestClient):
    headers = register_and_login(seeded_client)
    child = create_child(seeded_client, headers)

    subjects = seeded_client.get("/subjects", headers=headers)
    assert subjects.status_code == 200
    assert any(subject["code"] == "math" for subject in subjects.json())

    skills = seeded_client.get("/skills?subject=math&grade_level=2", headers=headers)
    assert skills.status_code == 200
    assert len(skills.json()) > 0

    placement = seeded_client.post(f"/children/{child['id']}/placement/start", headers=headers)
    assert placement.status_code == 200
    placement_payload = placement.json()
    assert placement_payload["session_id"]
    assert len(placement_payload["questions"]) > 0

    first_question = placement_payload["questions"][0]
    answer = seeded_client.post(
        f"/quiz-sessions/{placement_payload['session_id']}/answer",
        headers=headers,
        json={
            "question_id": first_question["id"],
            "selected_answer": first_question["correct_answer"],
            "response_time_ms": 5000,
            "hint_used": False,
            "attempt_count": 1,
        },
    )
    assert answer.status_code == 200
    assert answer.json()["is_correct"] is True

    complete = seeded_client.post(f"/quiz-sessions/{placement_payload['session_id']}/complete", headers=headers)
    assert complete.status_code == 200
    complete_payload = complete.json()
    assert complete_payload["correct_count"] == 1
    assert len(complete_payload["mastery"]) == 1

    mastery = seeded_client.get(f"/children/{child['id']}/skill-mastery", headers=headers)
    assert mastery.status_code == 200
    assert len(mastery.json()) == 1
    assert mastery.json()[0]["mastery_level"] in {"needs_help", "learning", "good", "mastered"}

    progress = seeded_client.get(f"/children/{child['id']}/progress", headers=headers)
    assert progress.status_code == 200
    assert progress.json()["total_xp"] == 5
    assert progress.json()["current_level"] == 1


def _admin_headers(client: TestClient, email: str = "admin-test@example.com") -> dict[str, str]:
    headers = register_and_login_as(client, email)
    with Session(engine) as session:
        user = session.scalar(select(User).where(User.email == email))
        assert user
        user.role = "admin"
        session.commit()
    return headers


def test_admin_can_grant_ep_manual_access_and_audit(seeded_client: TestClient):
    parent_headers = register_and_login_as(seeded_client, "review-parent@example.com")
    create_child(seeded_client, parent_headers)
    admin_headers = _admin_headers(seeded_client)

    with Session(engine) as session:
        target = session.scalar(select(User).where(User.email == "review-parent@example.com"))
        assert target
        target_id = target.id

    access_end = (datetime.now(UTC) + timedelta(days=30)).isoformat()
    response = seeded_client.patch(
        f"/admin/users/{target_id}/plan",
        headers=admin_headers,
        json={
            "plan_type": "ep",
            "program_type": "EP",
            "subscription_status": "manual_grant",
            "access_ends_at": access_end,
            "admin_note": "reviewer access",
            "manual_grant_reason": "reviewer access",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["plan_type"] == "ep"
    assert payload["program_type"] == "EP"
    assert payload["subscription_status"] == "manual_grant"
    assert payload["remaining_time"] != "expired"

    with Session(engine) as session:
        child = session.scalar(select(ChildProfile).where(ChildProfile.parent_user_id == target_id))
        assert child
        assert child.membership_status == "plus"
        assert child.plan_code == "ep_plus"
        assert session.scalar(select(func.count()).select_from(AdminAuditLog).where(AdminAuditLog.action == "change_plan")) == 1


def test_admin_auto_expires_overdue_manual_access_and_non_admin_forbidden(seeded_client: TestClient):
    parent_headers = register_and_login_as(seeded_client, "expired-parent@example.com")
    create_child(seeded_client, parent_headers)
    admin_headers = _admin_headers(seeded_client, "admin-expire@example.com")

    with Session(engine) as session:
        target = session.scalar(select(User).where(User.email == "expired-parent@example.com"))
        assert target
        target_id = target.id
        child = target.children[0]
        child.plan_type = "ep"
        child.plan_code = "ep_plus"
        child.program_type = "EP"
        child.billing_program_type = "EP"
        child.membership_status = "plus"
        child.subscription_status = "manual_grant"
        child.access_ends_at = datetime.now(UTC) - timedelta(days=1)
        child.current_period_end = child.access_ends_at
        session.commit()

    forbidden = seeded_client.get("/admin/users", headers=parent_headers)
    assert forbidden.status_code == 403

    expired = seeded_client.post("/admin/subscriptions/expire-overdue", headers=admin_headers)
    assert expired.status_code == 200
    assert expired.json()["expired_count"] == 1

    users = seeded_client.get("/admin/users", headers=admin_headers)
    assert users.status_code == 200
    row = next(user for user in users.json()["users"] if user["user_id"] == target_id)
    assert row["plan_type"] == "free"
    assert row["program_type"] == "FREE"
    assert row["subscription_status"] == "expired"


def test_me_lesson_detail_supports_th_program_and_object_visual_blocks(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "lesson-program-th@example.com")
    create_child(seeded_client, headers)

    response = seeded_client.get("/me/lessons/g3_division_intro?program_type=TH", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["program_type"] == "TH"
    assert payload["lesson_id"] == "g3_division_intro"
    assert isinstance(payload["visual_blocks"], list)
    assert payload["visual_blocks"]
    assert all(isinstance(block, dict) for block in payload["visual_blocks"])
    assert all(block["type"] in {"story_intro", "visual_thinking", "model_diagram", "number_sentence", "mini_quiz"} for block in payload["visual_blocks"])


def test_g3_division_mini_quiz_returns_consistent_answer_schema(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "lesson-mini-schema@example.com")
    create_child(seeded_client, headers)

    response = seeded_client.get("/me/lessons/g3_division_intro?program_type=TH", headers=headers)

    assert response.status_code == 200
    mini_quiz = next(block for block in response.json()["visual_blocks"] if block["type"] == "mini_quiz")
    data = mini_quiz["data"]
    assert set(data) >= {"question_th", "choices", "correct_answer", "answer", "explanation_th"}
    assert data["question_th"]
    assert data["choices"] == ["3", "4", "6", "9"]
    assert data["correct_answer"] == "4"
    assert data["answer"] == "4"
    assert data["correct_answer"] in data["choices"]
    assert "12" in data["explanation_th"]


def test_grouping_model_normalizes_to_sharing_groups_model_diagram(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "lesson-grouping-model@example.com")
    create_child(seeded_client, headers)

    response = seeded_client.get("/me/lessons/g3_division_intro?program_type=TH", headers=headers)

    assert response.status_code == 200
    model = next(block for block in response.json()["visual_blocks"] if block["type"] == "model_diagram")
    assert model["data"]["model_type"] == "sharing_groups"
    assert isinstance(model["data"]["groups"], list)
    assert model["data"]["groups"]
    assert model["data"]["groups"][0]["item_count"] == 6


def test_me_lesson_detail_ep_falls_back_to_th_when_ep_missing(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "lesson-program-ep@example.com")
    create_child(seeded_client, headers)

    response = seeded_client.get("/me/lessons/g3_division_intro?program_type=EP", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["program_type"] == "EP"
    assert payload["ep_fallback"] is True
    assert isinstance(payload["visual_blocks"], list)
    assert all(isinstance(block, dict) for block in payload["visual_blocks"])


def test_me_lesson_detail_filters_deprecated_visual_block_types(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "lesson-deprecated-blocks@example.com")
    create_child(seeded_client, headers)

    response = seeded_client.get("/me/lessons/g3_multiplication_area_model?program_type=EP", headers=headers)

    assert response.status_code == 200
    block_types = {block["type"] for block in response.json()["visual_blocks"]}
    assert "step_cards" not in block_types
    assert "worked_example" not in block_types
    assert "common_mistakes" not in block_types


def test_lesson_content_validator_checks_arithmetic_mini_quiz_answer():
    base_lesson = {
        "lesson_id": "division-mini-quiz",
        "grade_level": 3,
        "visual_blocks": [
            {
                "type": "mini_quiz",
                "data": {
                    "question": "12 ÷ 3 = ?",
                    "choices": ["2", "3", "4", "5"],
                    "correct_answer": "4",
                    "explanation": "12 divided by 3 is 4.",
                },
            }
        ],
    }

    assert validate_lesson_content(base_lesson)["valid"] is True
    invalid = dict(base_lesson)
    invalid["visual_blocks"] = [
        {
            "type": "mini_quiz",
            "data": {
                "question": "12 ÷ 3 = ?",
                "choices": ["2", "3", "4", "5"],
                "correct_answer": "3",
                "explanation": "This answer is intentionally wrong.",
            },
        }
    ]
    result = validate_lesson_content(invalid)
    assert result["valid"] is False
    assert any("arithmetic answer should be 4" in error for error in result["errors"])


def _write_temp_lesson(root, lesson_id: str = "admin_temp_lesson") -> None:
    lesson_dir = root / "grade_3" / "lessons"
    lesson_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "lesson_id": lesson_id,
        "grade_level": 3,
        "program_type": "TH",
        "title_th": "Admin temp lesson",
        "topic_code": lesson_id,
        "skill_code": lesson_id,
        "visual_blocks": [
            {
                "type": "story_intro",
                "title_th": "Story",
                "data": {"text_th": "Temp"},
            },
            {
                "type": "mini_quiz",
                "data": {
                    "question": "12 ÷ 3 = ?",
                    "choices": ["2", "3", "4", "5"],
                    "correct_answer": "4",
                    "explanation": "12 divided by 3 is 4.",
                },
            },
        ],
    }
    (lesson_dir / f"{lesson_id}.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def test_non_admin_cannot_access_admin_content_endpoints(seeded_client: TestClient):
    headers = register_and_login_as(seeded_client, "content-non-admin@example.com")

    response = seeded_client.get("/admin/content/lessons", headers=headers)

    assert response.status_code == 403


def test_admin_can_list_and_validate_content_lessons(seeded_client: TestClient, tmp_path, monkeypatch):
    root = tmp_path / "math"
    _write_temp_lesson(root)
    monkeypatch.setattr("app.services.lesson_content.CONTENT_ROOT", root)
    headers = _admin_headers(seeded_client, "content-admin@example.com")

    listed = seeded_client.get("/admin/content/lessons?grade_level=3", headers=headers)
    validated = seeded_client.post("/admin/content/lessons/admin_temp_lesson/validate?program_type=TH", headers=headers)

    assert listed.status_code == 200
    assert listed.json()["items"][0]["lesson_id"] == "admin_temp_lesson"
    assert listed.json()["items"][0]["validation_status"] == "valid"
    assert validated.status_code == 200
    assert validated.json()["valid"] is True


def test_admin_can_update_content_lesson_and_creates_backup(seeded_client: TestClient, tmp_path, monkeypatch):
    root = tmp_path / "math"
    _write_temp_lesson(root)
    monkeypatch.setattr("app.services.lesson_content.CONTENT_ROOT", root)
    headers = _admin_headers(seeded_client, "content-update-admin@example.com")
    updated_payload = json.loads((root / "grade_3" / "lessons" / "admin_temp_lesson.json").read_text(encoding="utf-8"))
    updated_payload["title_th"] = "Updated temp lesson"

    response = seeded_client.put("/admin/content/lessons/admin_temp_lesson?program_type=TH", headers=headers, json=updated_payload)

    assert response.status_code == 200
    payload = response.json()
    assert payload["saved"] is True
    assert payload["backup_path"]
    assert (root / "backups").exists()
    saved = json.loads((root / "grade_3" / "lessons" / "admin_temp_lesson.json").read_text(encoding="utf-8"))
    assert saved["title_th"] == "Updated temp lesson"


def test_admin_content_lesson_update_rejects_invalid_quiz_answer(seeded_client: TestClient, tmp_path, monkeypatch):
    root = tmp_path / "math"
    _write_temp_lesson(root)
    monkeypatch.setattr("app.services.lesson_content.CONTENT_ROOT", root)
    headers = _admin_headers(seeded_client, "content-invalid-admin@example.com")
    invalid_payload = json.loads((root / "grade_3" / "lessons" / "admin_temp_lesson.json").read_text(encoding="utf-8"))
    invalid_payload["visual_blocks"][1]["data"]["correct_answer"] = "3"

    response = seeded_client.put("/admin/content/lessons/admin_temp_lesson?program_type=TH", headers=headers, json=invalid_payload)

    assert response.status_code == 422
    assert any("arithmetic answer should be 4" in error for error in response.json()["detail"]["errors"])
