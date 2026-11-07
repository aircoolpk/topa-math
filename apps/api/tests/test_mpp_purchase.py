"""Offline adapter/domain tests. Fixtures are not evidence of live MPP UAT."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta
import importlib.util
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, func, inspect, select
from sqlalchemy.orm import Session

from test_api import client, seeded_client, register_and_login_as, create_child
from app.core.config import get_settings
from app.core.database import engine
from app.models import ChildProfile, User
from app.models.mpp_purchase import MppPackagePrice, MppPurchaseOrder, MppPurchaseEvent
from app.services import mpp_checkout as service
from app.services.foundation import is_paid, is_ep_plus
from app.routers import billing


@pytest.fixture()
def ready(seeded_client, monkeypatch):
    monkeypatch.setenv('PAYMENT_GATEWAY_DEFAULT', 'mpp')
    monkeypatch.setenv('MPP_CHECKOUT_ENABLED', 'true')
    monkeypatch.setenv('MPP_AMOUNT_UNIT', 'minor')
    for key, value in {'ENVIRONMENT': 'test', 'MPP_API_BASE_URL': 'https://staging-api.mmerchant.cc/api/v1', 'MPP_PAYMENT_BASE_URL': 'https://staging-pay.mmerchant.cc', 'MPP_PROJECT_API_KEY': 'offline-fixture-only', 'MPP_EXPECTED_MERCHANT_NAME': 'TOPA fixture merchant', 'MPP_EXPECTED_PROJECT_NAME': 'TOPA fixture project'}.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    service.validate_openapi.cache_clear()
    monkeypatch.setattr(service, 'validate_openapi', lambda base: None)
    headers = register_and_login_as(seeded_client, 'mpp-purchase-test@example.com')
    with Session(engine) as db:
        user = db.scalar(select(User).where(User.email == 'mpp-purchase-test@example.com'))
        monkeypatch.setenv('MPP_CHECKOUT_TEST_USER_IDS', user.id)
    get_settings.cache_clear()
    child = create_child(seeded_client, headers)
    calls = []
    def transport(method, path, body=None, *, key=None):
        calls.append((method, path, body, key))
        return {'payment_id': 'fixture-' + body['merchant_order_id'], 'merchant_order_id': body['merchant_order_id'], 'amount': body['amount'], 'currency': 'THB', 'status': 'PENDING', 'expires_at': (datetime.now(UTC) + timedelta(minutes=15)).isoformat(), 'payment_session_token': 'private-session-fixture', 'payment_session_url': 'https://staging-pay.mmerchant.cc/pay/private-session-fixture', 'merchant': {'display_name': 'TOPA fixture merchant'}, 'project': {'name': 'TOPA fixture project'}}
    monkeypatch.setattr(service.transport, 'mpp_request', transport)
    monkeypatch.setattr(billing, '_legacy_stripe_checkout_session', lambda *args, **kwargs: pytest.fail('Stripe called'))
    yield seeded_client, headers, child, calls
    get_settings.cache_clear()


def purchase(ready):
    client, headers, _, _ = ready
    response = client.post('/billing/mpp/checkout', headers=headers, json={'plan_code': 'th_founder_monthly', 'amount': 1, 'user_id': 'attacker'})
    assert response.status_code == 200, response.text
    return response.json()


def evidence(row, event_id='evt-fixture-1', outcome='CONFIRMED'):
    return service.VerifiedPaymentEvidence(event_id=event_id, body_digest='a' * 64, payment_id=row.payment_id, merchant_order_id=row.merchant_order_id, customer_reference=row.user_id, amount_minor=row.amount_minor, currency=row.currency, merchant_name=row.merchant_name, project_name=row.project_name, outcome=outcome)


def test_database_price_identity_and_checkout_reuse(ready):
    client, headers, child, calls = ready
    result = purchase(ready)
    assert result['amount_minor'] == 19900 and result['auto_renew'] is False
    second = client.post('/billing/create-checkout-session', headers=headers, json={'plan_code': 'th_founder_monthly'})
    assert second.json()['order_id'] == result['order_id']
    assert len(calls) == 1
    assert calls[0][2]['amount'] == 19900 and calls[0][3]
    with Session(engine) as db:
        assert db.get(ChildProfile, child['id']).membership_status == 'free'
        assert db.scalar(select(func.count()).select_from(MppPurchaseOrder)) == 1
        price = db.get(MppPackagePrice, 'th_founder_monthly')
        price.amount_minor = 29900
        db.commit()
    assert client.post('/billing/mpp/checkout', headers=headers, json={'plan_code': 'th_founder_monthly'}).json()['amount_minor'] == 19900


def test_unverified_amount_unit_blocks_remote_payment(ready, monkeypatch):
    client, headers, _, calls = ready
    monkeypatch.delenv('MPP_AMOUNT_UNIT'); get_settings.cache_clear()
    response = client.post('/billing/mpp/checkout', headers=headers, json={'plan_code': 'th_founder_monthly'})
    assert response.status_code == 503
    assert 'amount_unit_unverified' in response.json()['detail']['blockers']
    assert not calls


def test_network_timeout_retry_uses_same_key_and_exact_payload(ready, monkeypatch):
    client, headers, _, _ = ready
    sent = []
    def failing(method, path, body=None, *, key=None):
        sent.append((body, key))
        raise HTTPException(502, 'provider timeout')
    monkeypatch.setattr(service.transport, 'mpp_request', failing)
    first = client.post('/billing/mpp/checkout', headers=headers, json={'plan_code': 'th_founder_monthly'})
    assert first.status_code == 502
    order_id = first.json()['detail']['order_id']
    assert client.post(f'/billing/mpp/orders/{order_id}/retry', headers=headers).status_code == 502
    assert sent[0] == sent[1]


@pytest.mark.parametrize('field,value', [('amount', 199), ('currency', 'USD'), ('merchant_order_id', 'wrong'), ('merchant', {'display_name': 'wrong'}), ('project', {'name': 'wrong'}), ('payment_session_url', 'https://checkout.stripe.com/forbidden')])
def test_remote_mismatch_never_exposes_checkout_or_grants(ready, monkeypatch, field, value):
    client, headers, child, _ = ready
    original = service.transport.mpp_request
    monkeypatch.setattr(service.transport, 'mpp_request', lambda *args, **kwargs: {**original(*args, **kwargs), field: value})
    response = client.post('/billing/mpp/checkout', headers=headers, json={'plan_code': 'th_founder_monthly'})
    assert response.status_code == 502
    with Session(engine) as db:
        assert db.get(ChildProfile, child['id']).membership_status == 'free'
        row = db.scalar(select(MppPurchaseOrder))
        assert row.status == 'PENDING' and row.session_url is None


def test_signed_webhook_contract_is_not_guessed_and_recheck_stays_pending(ready, monkeypatch):
    client, headers, child, _ = ready
    result = purchase(ready)
    with Session(engine) as db:
        row = db.get(MppPurchaseOrder, result['order_id'])
        status = {'payment_id': row.payment_id, 'merchant_order_id': row.merchant_order_id, 'customer_reference': row.user_id, 'amount': row.amount_minor, 'currency': row.currency, 'merchant_display_name': row.merchant_name, 'project_name': row.project_name, 'status': 'CONFIRMED'}
    monkeypatch.setattr(service.transport, 'mpp_request', lambda *args, **kwargs: status)
    assert client.post(f"/billing/mpp/orders/{result['order_id']}/recheck", headers=headers).json()['status'] == 'PENDING'
    assert client.post('/webhooks/mpp/payments', content=b'{}', headers={'X-Webhook-Signature': 'invented'}).status_code == 503
    with Session(engine) as db:
        assert db.get(ChildProfile, child['id']).membership_status == 'free'
        assert db.scalar(select(func.count()).select_from(MppPurchaseEvent)) == 0


def test_verified_domain_evidence_grants_once_and_renewal_extends_30_days(ready):
    result = purchase(ready)
    with Session(engine) as db:
        row = db.get(MppPurchaseOrder, result['order_id'])
        proof = evidence(row)
        service.apply_verified_evidence(db, row.id, proof); db.commit()
        child = db.get(ChildProfile, row.child_id)
        end = child.mpp_access_ends_at
        assert is_paid(child)
        service.apply_verified_evidence(db, row.id, proof); db.commit()
        service.apply_verified_evidence(db, row.id, replace(proof, event_id='evt-fixture-second-id')); db.commit()
        assert child.mpp_access_ends_at == end
    next_result = purchase(ready)
    with Session(engine) as db:
        row = db.get(MppPurchaseOrder, next_result['order_id'])
        service.apply_verified_evidence(db, row.id, evidence(row, 'evt-renewal')); db.commit()
        child = db.get(ChildProfile, row.child_id)
        assert child.mpp_access_ends_at == end + timedelta(days=30)
        assert child.stripe_subscription_id is None
        child.mpp_access_ends_at = datetime.now(UTC) - timedelta(seconds=1)
        assert not is_paid(child)


@pytest.mark.parametrize('outcome', ['FAILED', 'EXPIRED'])
def test_verified_terminal_outcomes_allow_new_logical_order_without_grant(ready, outcome):
    result = purchase(ready)
    with Session(engine) as db:
        row = db.get(MppPurchaseOrder, result['order_id'])
        service.apply_verified_evidence(db, row.id, evidence(row, outcome=outcome)); db.commit()
        assert row.status == outcome
        assert not is_paid(db.get(ChildProfile, row.child_id))
    assert purchase(ready)['order_id'] != result['order_id']


def test_existing_stripe_and_other_user_order_are_protected(ready):
    client, headers, child, _ = ready
    order = purchase(ready)
    other = register_and_login_as(client, 'other-purchase-user@example.com')
    assert client.get(f"/billing/mpp/orders/{order['order_id']}", headers=other).status_code == 404
    assert client.post(f"/billing/mpp/orders/{order['order_id']}/retry", headers=other).status_code == 404
    with Session(engine) as db:
        profile = db.get(ChildProfile, child['id']); profile.stripe_subscription_id = 'legacy-subscription'; profile.subscription_status = 'active'; db.commit()
    response = client.post('/billing/mpp/checkout', headers=headers, json={'plan_code': 'th_founder_monthly'})
    assert response.status_code == 409
    assert response.json()['detail']['code'] == 'EXISTING_STRIPE_SUBSCRIPTION'


def test_wrong_verified_identity_cannot_grant(ready):
    result = purchase(ready)
    with Session(engine) as db:
        row = db.get(MppPurchaseOrder, result['order_id'])
        with pytest.raises(HTTPException):
            service.apply_verified_evidence(db, row.id, replace(evidence(row), amount_minor=1))
        assert row.granted_at is None


def test_pending_founder_reservation_prevents_overselling(ready, monkeypatch):
    client, _, _, calls = ready
    monkeypatch.setenv('FOUNDER_USER_LIMIT', '1'); get_settings.cache_clear()
    first = purchase(ready)
    assert purchase(ready)['order_id'] == first['order_id']
    other = register_and_login_as(client, 'founder-reservation-test@example.com')
    with Session(engine) as db:
        user = db.scalar(select(User).where(User.email == 'founder-reservation-test@example.com'))
        user.role = 'admin'; db.commit()
    create_child(client, other)
    response = client.post('/billing/mpp/checkout', headers=other, json={'plan_code': 'th_founder_monthly'})
    assert response.status_code == 409
    assert len(calls) == 1


def test_active_founder_can_renew_when_quota_full(ready, monkeypatch):
    monkeypatch.setenv('FOUNDER_USER_LIMIT', '1'); get_settings.cache_clear()
    first = purchase(ready)
    with Session(engine) as db:
        row = db.get(MppPurchaseOrder, first['order_id'])
        service.apply_verified_evidence(db, row.id, evidence(row)); db.commit()
    assert purchase(ready)['order_id'] != first['order_id']


def test_purchase_migration_up_down_preserves_member_table():
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    path = Path(__file__).parents[1] / 'alembic/versions/20261015_0003_mpp_purchases.py'
    spec = importlib.util.spec_from_file_location('mpp_purchase_migration', path)
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    temporary = create_engine('sqlite:///:memory:')
    with temporary.begin() as connection:
        connection.exec_driver_sql('CREATE TABLE users (id VARCHAR(36) PRIMARY KEY)')
        connection.exec_driver_sql('CREATE TABLE child_profiles (id VARCHAR(36) PRIMARY KEY)')
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert connection.exec_driver_sql("SELECT amount_minor FROM mpp_package_prices WHERE plan_code='th_founder_monthly'").scalar_one() == 19900
            migration.downgrade()
            assert set(inspect(connection).get_table_names()) == {'users', 'child_profiles'}
