import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import Base, engine
from app.main import app
from app.models import ChildProfile, User
from app.models.payment_integration import MppTestTransaction
from app.routers import billing
from app.services import payment_integration
from app.services.foundation import is_paid


@pytest.fixture()
def checkout_client(monkeypatch):
    monkeypatch.setenv('PAYMENT_GATEWAY_DEFAULT', 'mpp')
    monkeypatch.setenv('MPP_CHECKOUT_ENABLED', 'true')
    for key, value in {"ENVIRONMENT": "test", "MPP_PROJECT_API_KEY": "", "MPP_WEBHOOK_SIGNING_SECRET": "", "MPP_API_BASE_URL": "https://staging-api.mmerchat.cc/api/v1", "MPP_PAYMENT_BASE_URL": "https://staging-pay.mmerchat.cc"}.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    def unexpected(*args, **kwargs):
        pytest.fail("Blocked checkout must not call Stripe or MPP")
    monkeypatch.setattr(billing, "_require_stripe", unexpected)
    monkeypatch.setattr(billing, "_legacy_stripe_checkout_session", unexpected)
    monkeypatch.setattr(billing, "_manual_pending_checkout", unexpected)
    monkeypatch.setattr(payment_integration, "mpp_request", unexpected)
    with TestClient(app) as client:
        registered = client.post("/auth/register", json={"email": "checkout-boundary@example.com", "password": "password123"})
        headers = {"Authorization": "Bearer " + registered.json()["access_token"]}
        with Session(engine) as db:
            user = db.scalar(select(User).where(User.email == 'checkout-boundary@example.com'))
            monkeypatch.setenv('MPP_CHECKOUT_TEST_USER_IDS', user.id)
        get_settings.cache_clear()
        yield client, headers
    get_settings.cache_clear()


@pytest.mark.parametrize("endpoint", ["/billing/mpp/checkout", "/billing/create-checkout-session"])
@pytest.mark.parametrize("plan_code", list(billing.PLAN_CATALOG))
def test_new_and_old_entry_points_never_call_stripe(checkout_client, endpoint, plan_code):
    client, headers = checkout_client
    response = client.post(endpoint, headers=headers, json={"plan_code": plan_code})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "MPP_CHECKOUT_BLOCKED"
    assert "missing_project_api_key" in response.json()["detail"]["blockers"]
    assert "checkout_url" not in response.text
    with Session(engine) as db:
        assert db.scalars(select(MppTestTransaction)).all() == []


def test_keys_alone_cannot_checkout_without_approved_project_identity(checkout_client, monkeypatch):
    client, headers = checkout_client
    monkeypatch.setenv("MPP_PROJECT_API_KEY", "test-only-private-key")
    monkeypatch.setenv("MPP_WEBHOOK_SIGNING_SECRET", "test-only-private-secret")
    get_settings.cache_clear()
    response = client.post("/billing/mpp/checkout", headers=headers, json={"plan_code": "th_plus_monthly"})
    assert response.status_code == 503
    assert "missing_expected_merchant_project" in response.json()["detail"]["blockers"]
    assert "test-only-private" not in response.text


@pytest.mark.parametrize("paid", [False, True])
def test_blocked_checkout_and_retry_preserve_existing_entitlements(checkout_client, paid):
    client, headers = checkout_client
    with Session(engine) as db:
        user = db.scalar(select(User).where(User.email == "checkout-boundary@example.com"))
        child = ChildProfile(parent_user_id=user.id, nickname="Checkout test", grade_level=1, membership_status="plus" if paid else "free", plan_code="th_plus" if paid else "free", subscription_status="active" if paid else "none", stripe_customer_id="legacy-customer" if paid else None, stripe_subscription_id="legacy-subscription" if paid else None)
        db.add(child)
        db.commit()
        child_id = child.id
        before = (child.membership_status, child.plan_code, child.subscription_status, child.stripe_customer_id, child.stripe_subscription_id, child.current_period_end, child.access_ends_at)
    before_status = client.get("/billing/status", headers=headers).json()
    for _ in range(2):
        response = client.post("/billing/mpp/checkout", headers=headers, json={"plan_code": "ep_plus_monthly", "amount": 1, "user_id": "another-user"})
        assert response.status_code == 503
    assert client.get("/billing/status", headers=headers).json() == before_status
    with Session(engine) as db:
        child = db.get(ChildProfile, child_id)
        assert (child.membership_status, child.plan_code, child.subscription_status, child.stripe_customer_id, child.stripe_subscription_id, child.current_period_end, child.access_ends_at) == before
        assert is_paid(child) is paid


def test_auth_and_invalid_plan_are_rejected(checkout_client):
    client, headers = checkout_client
    client.cookies.clear()
    assert client.post("/billing/mpp/checkout", json={"plan_code": "th_plus_monthly"}).status_code == 401
    assert client.post("/billing/mpp/checkout", headers=headers, json={"plan_code": "unknown"}).status_code == 400


def test_production_host_cannot_enable_checkout(checkout_client, monkeypatch):
    client, headers = checkout_client
    monkeypatch.setenv("MPP_API_BASE_URL", "https://api.mmerchat.cc/api/v1")
    get_settings.cache_clear()
    response = client.post("/billing/mpp/checkout", headers=headers, json={"plan_code": "th_plus_monthly"})
    assert "staging_hosts_required" in response.json()["detail"]["blockers"]
