"""Pipe to the running API's python stdin. Structural SELECT-only audit, no DDL."""
import json
import os
from sqlalchemy import create_engine, inspect, text


def main():
    url = os.environ.get('DATABASE_URL', '')
    if not url.startswith('postgresql'):
        raise SystemExit('Explicit PostgreSQL runtime DATABASE_URL required')
    engine = create_engine(url)
    required = {
        'affiliate_payout_accounts': {'id', 'user_id', 'payout_method'},
        'affiliate_withdrawal_requests': {'id', 'user_id', 'amount_minor', 'status'},
        'affiliate_commission_ledger': {'id', 'affiliate_user_id', 'payment_reference_id', 'status'},
        'mpp_test_transactions': {'id', 'merchant_order_id', 'payment_id'},
        'mpp_test_webhook_events': {'event_id', 'body_sha256'},
        'child_profiles': {'membership_provider', 'mpp_access_ends_at'},
        'mpp_package_prices': {'plan_code', 'amount_minor', 'currency', 'duration_days'},
        'mpp_purchase_orders': {'id', 'user_id', 'payment_id', 'idempotency_key', 'granted_at'},
        'mpp_purchase_events': {'event_id', 'body_digest'},
        'billing_checkout_reservations': {'id', 'user_id', 'provider', 'status', 'external_id'},
    }
    with engine.connect() as connection:
        with connection.begin():
            connection.execute(text('SET TRANSACTION READ ONLY'))
            inspector = inspect(connection)
            tables = set(inspector.get_table_names())
            snapshot = {}
            for table, expected in required.items():
                actual = {column['name'] for column in inspector.get_columns(table)} if table in tables else set()
                snapshot[table] = {'exists': table in tables, 'missing_required_columns': sorted(expected - actual)}
            revision = connection.execute(text('SELECT version_num FROM alembic_version')).scalars().all() if 'alembic_version' in tables else []
            print(json.dumps({'read_only': True, 'alembic_revision': revision, 'required_schema': snapshot, 'warning': 'Structural inventory only; NOT authorization to stamp or upgrade'}, indent=2))


if __name__ == '__main__':
    main()
