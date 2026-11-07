"""Offline gateway routing tests; never evidence of a live provider payment."""
import json
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import Settings, get_settings
from app.core.database import engine
from app.models import User
from app.models.checkout_reservation import CheckoutReservation
from app.routers import billing
from test_api import client, seeded_client, stripe_env, register_and_login_as, create_child
from test_mpp_purchase import ready, purchase


@pytest.fixture()
def gateway(seeded_client, stripe_env, monkeypatch):
    monkeypatch.setenv('PAYMENT_GATEWAY_DEFAULT', 'stripe')
    monkeypatch.setenv('MPP_CHECKOUT_ENABLED', 'false')
    monkeypatch.setenv('MPP_CHECKOUT_TEST_USER_IDS', '')
    get_settings.cache_clear()
    headers = register_and_login_as(seeded_client, 'gateway-routing@example.com')
    create_child(seeded_client, headers)
    with Session(engine) as db:
        uid = db.scalar(select(User.id).where(User.email == 'gateway-routing@example.com'))
    yield seeded_client, headers, uid, stripe_env
    get_settings.cache_clear()


def submit(client, headers, endpoint='/billing/create-checkout-session', **extra):
    return client.post(endpoint, headers=headers, json={'plan_code': 'th_founder_monthly', **extra})


def test_defaults_are_stripe_and_mpp_off():
    settings = Settings(_env_file=None, environment='test')
    assert settings.payment_gateway_default == 'stripe'
    assert settings.mpp_checkout_enabled is False


def test_default_checkout_stripe_and_repeat_reuses_session(gateway):
    client, headers, _, stripe = gateway
    first = submit(client, headers)
    assert first.status_code == 200 and first.json()['provider'] == 'stripe'
    assert stripe.last_checkout_kwargs['idempotency_key']
    assert submit(client, headers).json()['checkout_url'] == first.json()['checkout_url']
    with Session(engine) as db:
        assert len(db.scalars(select(CheckoutReservation)).all()) == 1


def test_client_cannot_choose_gateway_or_enable_mpp(gateway):
    client, headers, _, _ = gateway
    assert submit(client, headers, provider='mpp', mpp_checkout_enabled=True).json()['provider'] == 'stripe'
    response = submit(client, headers, '/billing/mpp/checkout', mpp_checkout_enabled=True)
    assert response.status_code == 503 and response.json()['detail']['code'] == 'MPP_CHECKOUT_DISABLED'


@pytest.mark.parametrize('role,allowlisted,expected', [('parent', False, 403), ('parent', True, 503), ('admin', False, 503)])
def test_enabled_mpp_requires_server_account_authorization(gateway, monkeypatch, role, allowlisted, expected):
    client, headers, uid, stripe = gateway
    with Session(engine) as db:
        db.get(User, uid).role = role; db.commit()
    monkeypatch.setenv('PAYMENT_GATEWAY_DEFAULT', 'mpp')
    monkeypatch.setenv('MPP_CHECKOUT_ENABLED', 'true')
    monkeypatch.setenv('MPP_PROJECT_API_KEY', '')
    monkeypatch.setenv('MPP_CHECKOUT_TEST_USER_IDS', uid if allowlisted else '')
    get_settings.cache_clear()
    response = submit(client, headers)
    assert response.status_code == expected
    assert stripe.last_checkout_kwargs is None
    if expected == 503:
        assert response.json()['detail']['code'] == 'MPP_CHECKOUT_BLOCKED'


def test_flag_change_does_not_switch_pending_stripe_to_mpp(gateway, monkeypatch):
    client, headers, _, _ = gateway
    first = submit(client, headers).json()
    monkeypatch.setenv('PAYMENT_GATEWAY_DEFAULT', 'mpp')
    get_settings.cache_clear()
    second = submit(client, headers)
    assert second.json()['provider'] == 'stripe'
    assert second.json()['checkout_url'] == first['checkout_url']
    status = client.get('/billing/checkouts/' + first['order_id'], headers=headers)
    assert status.json()['provider'] == 'stripe'
    other = register_and_login_as(client, 'other-checkout-owner@example.com')
    assert client.get('/billing/checkouts/' + first['order_id'], headers=other).status_code == 404


def test_unknown_stripe_create_failure_never_falls_back(gateway, monkeypatch):
    client, headers, _, stripe = gateway
    def timeout(**kwargs):
        raise TimeoutError('offline fixture')
    monkeypatch.setattr(stripe.checkout.Session, 'create', timeout)
    first = submit(client, headers)
    assert first.json()['provider'] == 'stripe'
    monkeypatch.setenv('PAYMENT_GATEWAY_DEFAULT', 'mpp'); get_settings.cache_clear()
    second = submit(client, headers)
    assert second.status_code == 409
    assert second.json()['detail']['provider'] == 'stripe'


def test_verified_stripe_expiration_releases_reservation(gateway):
    client, headers, uid, _ = gateway
    submit(client, headers)
    with Session(engine) as db:
        row = db.scalar(select(CheckoutReservation))
        rid, external = row.id, row.external_id
    event = {'id': 'evt-offline-expired', 'type': 'checkout.session.expired', 'data': {'object': {'id': external, 'metadata': {'user_id': uid, 'topa_checkout_reservation_id': rid}}}}
    assert client.post('/webhooks/stripe', content=json.dumps(event), headers={'stripe-signature': 'offline'}).status_code == 200
    with Session(engine) as db:
        assert db.get(CheckoutReservation, rid).status == 'EXPIRED'


def test_pending_mpp_retry_keeps_original_provider_when_disabled(ready, monkeypatch):
    client, headers, _, calls = ready
    first = purchase(ready)
    monkeypatch.setenv('PAYMENT_GATEWAY_DEFAULT', 'stripe')
    monkeypatch.setenv('MPP_CHECKOUT_ENABLED', 'false'); get_settings.cache_clear()
    second = submit(client, headers)
    assert second.json()['provider'] == 'mpp'
    assert second.json()['order_id'] == first['order_id']
    assert client.post('/billing/mpp/orders/' + first['order_id'] + '/retry', headers=headers).json()['provider'] == 'mpp'
    assert len(calls) == 1


def test_pending_stripe_blocks_explicit_mpp(ready, monkeypatch):
    client, headers, _, calls = ready
    with Session(engine) as db:
        uid = db.scalar(select(User.id).where(User.email == 'mpp-purchase-test@example.com'))
        db.add(CheckoutReservation(user_id=uid, provider='stripe', plan_code='th_founder_monthly')); db.commit()
    response = submit(client, headers, '/billing/mpp/checkout')
    assert response.status_code == 409 and response.json()['detail']['provider'] == 'stripe'
    assert not calls


def test_invalid_gateway_fails_closed(gateway, monkeypatch):
    client, headers, _, stripe = gateway
    monkeypatch.setenv('PAYMENT_GATEWAY_DEFAULT', 'typo'); get_settings.cache_clear()
    assert submit(client, headers).status_code == 503
    assert stripe.last_checkout_kwargs is None
