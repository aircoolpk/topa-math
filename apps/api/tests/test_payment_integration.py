import hashlib
import hmac
import json
import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import Base, engine
from app.main import app
from app.models import User
from app.models.payment_integration import MppTestTransaction, MppTestWebhookEvent
from app.services import payment_integration as service

PREFIX = "/admin/payment-integration-test"


@pytest.fixture()
def uat(monkeypatch):
    for key, value in {"ENVIRONMENT": "test", "MPP_PROJECT_API_KEY": "test-key", "MPP_WEBHOOK_SIGNING_SECRET": "test-signing-secret", "MPP_API_BASE_URL": "https://staging-api.mmerchat.cc/api/v1", "MPP_PAYMENT_BASE_URL": "https://staging-pay.mmerchat.cc"}.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as client:
        response = client.post("/auth/register", json={"email": "mpp-admin@example.com", "password": "password123"})
        headers = {"Authorization": "Bearer " + response.json()["access_token"]}
        with Session(engine) as db:
            user = db.scalar(select(User).where(User.email == "mpp-admin@example.com"))
            user.role = "admin"
            db.commit()
        yield client, headers
    get_settings.cache_clear()


def create_payment(uat, monkeypatch):
    client, headers = uat
    order = client.post(PREFIX + "/orders", headers=headers).json()
    calls = []

    def fake(method, path, payload=None, *, key=None):
        calls.append((method, path, payload, key))
        return {"payment_id": "pay-uat", "merchant_order_id": order["merchant_order_id"], "amount": 1500, "currency": "THB", "status": "PENDING", "payment_session_token": "session-sensitive", "payment_session_url": "https://staging-pay.mmerchat.cc/pay/session-sensitive", "recipient": {"bank_account_number": "sensitive"}}

    monkeypatch.setattr(service, "mpp_request", fake)
    response = client.post(PREFIX + "/" + order["id"] + "/payment", headers=headers)
    assert response.status_code == 200
    assert response.json()["checks"]["payment"]["state"] == "PASS"
    assert "session-sensitive" not in response.text
    assert "bank_account_number" not in response.text
    return order, calls


def signed(client, payload, raw=None):
    raw = raw or json.dumps(payload).encode()
    signature = hmac.new(b"test-signing-secret", raw, hashlib.sha256).hexdigest()
    return client.post("/webhooks/mpp/staging", content=raw, headers={"X-Webhook-Signature": "sha256=" + signature})


def event(order, event_id="evt-confirm"):
    return {"event_id": event_id, "event_type": "payment.confirmed", "data": {"payment_id": "pay-uat", "merchant_order_id": order["merchant_order_id"], "amount": 1500, "currency": "THB", "status": "CONFIRMED"}}


def test_payment_retry_and_signed_webhook_are_idempotent(uat, monkeypatch):
    order, calls = create_payment(uat, monkeypatch)
    client, headers = uat
    retry = client.post(PREFIX + "/" + order["id"] + "/retry", headers=headers)
    assert retry.json()["checks"]["idempotency"]["state"] == "PASS"
    assert calls[0][2:] == calls[1][2:]
    assert signed(client, event(order)).json()["duplicate"] is False
    assert signed(client, event(order)).json()["duplicate"] is True
    with Session(engine) as db:
        assert db.get(MppTestTransaction, order["id"]).status == "PAID"
        assert db.scalar(select(func.count()).select_from(MppTestWebhookEvent)) == 1
    altered = event(order)
    altered["data"]["amount"] = 2000
    assert signed(client, altered).status_code == 409


def test_webhook_rejects_bad_signature_raw_body_and_amount(uat, monkeypatch):
    order, _ = create_payment(uat, monkeypatch)
    client, _ = uat
    raw = json.dumps(event(order)).encode()
    signature = hmac.new(b"test-signing-secret", raw, hashlib.sha256).hexdigest()
    assert client.post("/webhooks/mpp/staging", content=raw + b" ", headers={"X-Webhook-Signature": signature}).status_code == 401
    bad = event(order)
    bad["data"]["amount"] = 15.0
    assert signed(client, bad).status_code == 400
    with Session(engine) as db:
        assert db.get(MppTestTransaction, order["id"]).status == "PENDING_PAYMENT"
        assert db.scalar(select(func.count()).select_from(MppTestWebhookEvent)) == 0


def test_recheck_confirms_without_downgrading_paid(uat, monkeypatch):
    order, _ = create_payment(uat, monkeypatch)
    client, headers = uat
    status = {**event(order)["data"]}
    monkeypatch.setattr(service, "mpp_request", lambda *args, **kwargs: status)
    response = client.post(PREFIX + "/" + order["id"] + "/recheck", headers=headers)
    assert response.json()["status"] == "PAID"
    status["status"] = "PENDING"
    assert client.post(PREFIX + "/" + order["id"] + "/recheck", headers=headers).json()["status"] == "PAID"


def test_remote_failure_persists_order_for_same_key_retry(uat, monkeypatch):
    client, headers = uat
    order = client.post(PREFIX + "/orders", headers=headers).json()
    from fastapi import HTTPException
    def fail(*args, **kwargs):
        raise HTTPException(502, "MPP staging request failed or timed out")
    monkeypatch.setattr(service, "mpp_request", fail)
    result = client.post(PREFIX + "/" + order["id"] + "/payment", headers=headers)
    assert result.json()["checks"]["payment"]["state"] == "FAIL"
    with Session(engine) as db:
        assert db.get(MppTestTransaction, order["id"]).idempotency_key
        assert db.scalar(select(func.count()).select_from(MppTestTransaction)) == 1


def test_admin_and_staging_guards(uat, monkeypatch):
    client, headers = uat
    client.cookies.clear()
    assert client.get(PREFIX).status_code == 401
    response = client.post("/auth/register", json={"email": "mpp-user@example.com", "password": "password123"})
    assert client.get(PREFIX, headers={"Authorization": "Bearer " + response.json()["access_token"]}).status_code == 403
    monkeypatch.setenv("MPP_API_BASE_URL", "https://api.mmerchat.cc/api/v1")
    get_settings.cache_clear()
    assert client.post(PREFIX + "/orders", headers=headers).status_code == 403


def test_withdrawal_webhook_and_public_status_keep_recipient_private(uat, monkeypatch):
    client, headers = uat
    def fake(method, path, payload=None, **kwargs):
        if method == "POST":
            return {"public_id": "wd-uat", "status_token": "wd-sensitive", "merchant_withdrawal_reference": payload["merchant_withdrawal_reference"], "amount": 1500, "currency": "THB", "status": "PENDING", "recipient": payload}
        assert path == "/withdrawals/status/wd-uat?token=wd-sensitive"
        return {"withdrawal_id": "wd-uat", "amount": 1500, "currency": "THB", "status": "PAID"}
    monkeypatch.setattr(service, "mpp_request", fake)
    payload = {"merchant_customer_id": "uat-recipient", "first_name": "UAT", "last_name": "Test", "phone": "0000000000", "bank_code": "TEST", "bank_name": "Test bank", "bank_account_number": "0000000000", "bank_account_name": "UAT Test"}
    response = client.post(PREFIX + "/withdrawals", headers=headers, json=payload)
    order = response.json()
    assert order["checks"]["withdrawal"]["state"] == "PASS"
    assert "0000000000" not in response.text and "wd-sensitive" not in response.text
    body = {"event_id": "evt-wd", "event_type": "withdrawal.paid", "data": {"withdrawal_id": "wd-uat", "merchant_withdrawal_reference": order["merchant_order_id"], "amount": 1500, "currency": "THB", "status": "PAID"}}
    assert signed(client, body).status_code == 200
    assert signed(client, body).json()["duplicate"] is True
    rechecked = client.post(PREFIX + "/" + order["id"] + "/recheck", headers=headers)
    assert rechecked.json()["status"] == "PAID"
    assert rechecked.json()["checks"]["recheck"]["state"] == "PASS"


def test_bad_remote_id_or_host_fails_without_overwriting_payment(uat, monkeypatch):
    order, _ = create_payment(uat, monkeypatch)
    client, headers = uat
    result = {**event(order)["data"], "payment_id": "different-payment", "payment_session_token": "private", "payment_session_url": "https://production.example/pay/private"}
    monkeypatch.setattr(service, "mpp_request", lambda *args, **kwargs: result)
    response = client.post(PREFIX + "/" + order["id"] + "/retry", headers=headers)
    assert response.json()["checks"]["idempotency"]["state"] == "FAIL"
    assert response.json()["payment_id"] == "pay-uat"


def test_missing_signature_secret_and_unknown_payment_are_rejected(uat, monkeypatch):
    client, _ = uat
    body = event({"merchant_order_id": "unknown"})
    assert signed(client, body).status_code == 409
    monkeypatch.setenv("MPP_WEBHOOK_SIGNING_SECRET", "")
    get_settings.cache_clear()
    assert signed(client, body).status_code == 503


def test_server_client_sends_key_and_idempotency_header_only_on_create(uat, monkeypatch):
    captured = []
    class Response:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def read(self, size): return b'{"status":"PENDING"}'
    class Opener:
        def open(self, request, timeout):
            captured.append(request)
            assert timeout == 10
            return Response()
    monkeypatch.setattr(service, "build_opener", lambda *args: Opener())
    service.mpp_request("POST", "/payments", {"amount": 1500}, key="stable-key")
    service.mpp_request("GET", "/pay/private-session")
    assert captured[0].get_header("X-api-key") == "test-key"
    assert captured[0].get_header("Idempotency-key") == "stable-key"
    assert captured[1].get_header("X-api-key") is None


def test_invalid_webhook_envelope_is_rejected(uat):
    client, _ = uat
    assert signed(client, ["invalid"]).status_code == 400
    assert client.post("/webhooks/mpp/staging", content=b'{}', headers={"X-Webhook-Signature": "invalid"}).status_code == 401


def test_uat_migration_round_trip_preserves_existing_tables():
    import importlib.util
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import create_engine, inspect
    migration_path = Path(__file__).parents[1] / "alembic/versions/20261014_0002_mpp_uat.py"
    spec = importlib.util.spec_from_file_location("mpp_migration", migration_path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    temporary = create_engine("sqlite:///:memory:")
    with temporary.begin() as connection:
        User.__table__.create(connection)
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert {"users", "mpp_test_transactions", "mpp_test_webhook_events"}.issubset(inspect(connection).get_table_names())
            migration.downgrade()
            assert inspect(connection).get_table_names() == ["users"]
