"""MPP price catalog, owned purchase orders, event ledger and expiring access."""
from alembic import op
import sqlalchemy as sa

revision = '20261015_0003'
down_revision = '20261014_0002'
branch_labels = None
depends_on = None


def upgrade():
    # if_not_exists keeps this migration usable on a database whose schema was
    # created from the Drizzle models, where these columns already exist.
    op.add_column(
        'child_profiles',
        sa.Column('membership_provider', sa.String(20)),
        if_not_exists=True,
    )
    op.add_column(
        'child_profiles',
        sa.Column('mpp_access_ends_at', sa.DateTime(timezone=True)),
        if_not_exists=True,
    )
    prices = op.create_table('mpp_package_prices', sa.Column('plan_code', sa.String(80), primary_key=True), sa.Column('amount_minor', sa.Integer(), nullable=False), sa.Column('currency', sa.String(3), nullable=False), sa.Column('duration_days', sa.Integer(), nullable=False), sa.Column('entitlement_plan', sa.String(40), nullable=False), sa.Column('program_type', sa.String(3), nullable=False), sa.Column('active', sa.Boolean(), nullable=False))
    op.bulk_insert(prices, [{'plan_code': code, 'amount_minor': amount, 'currency': 'THB', 'duration_days': 30, 'entitlement_plan': entitlement, 'program_type': program, 'active': True} for code, amount, entitlement, program in [('th_founder_monthly', 19900, 'th_plus', 'TH'), ('ep_founder_monthly', 39900, 'ep_plus', 'EP'), ('th_plus_monthly', 29900, 'th_plus', 'TH'), ('ep_plus_monthly', 59900, 'ep_plus', 'EP')]])
    op.create_table('mpp_purchase_orders',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('child_id', sa.String(36), sa.ForeignKey('child_profiles.id'), nullable=False),
        sa.Column('plan_code', sa.String(80), sa.ForeignKey('mpp_package_prices.plan_code'), nullable=False),
        sa.Column('amount_minor', sa.Integer(), nullable=False), sa.Column('currency', sa.String(3), nullable=False),
        sa.Column('duration_days', sa.Integer(), nullable=False), sa.Column('entitlement_plan', sa.String(40), nullable=False), sa.Column('program_type', sa.String(3), nullable=False),
        sa.Column('merchant_order_id', sa.String(120), nullable=False, unique=True), sa.Column('idempotency_key', sa.String(120), nullable=False, unique=True),
        sa.Column('api_origin', sa.String(200), nullable=False), sa.Column('merchant_name', sa.String(160), nullable=False), sa.Column('project_name', sa.String(160), nullable=False),
        sa.Column('status', sa.String(30), nullable=False), sa.Column('remote_status', sa.String(40)), sa.Column('payment_id', sa.String(120), unique=True),
        sa.Column('session_token', sa.Text()), sa.Column('session_url', sa.Text()), sa.Column('expires_at', sa.DateTime(timezone=True)), sa.Column('granted_at', sa.DateTime(timezone=True)), sa.Column('last_error', sa.String(80)), sa.Column('last_rechecked_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_index('ix_mpp_purchase_orders_user_id', 'mpp_purchase_orders', ['user_id'])
    op.create_index('ix_mpp_purchase_orders_child_id', 'mpp_purchase_orders', ['child_id'])
    op.create_index('uq_mpp_pending_child', 'mpp_purchase_orders', ['child_id'], unique=True, postgresql_where=sa.text("status = 'PENDING'"), sqlite_where=sa.text("status = 'PENDING'"))
    op.create_table('mpp_purchase_events', sa.Column('event_id', sa.String(160), primary_key=True), sa.Column('order_id', sa.String(36), sa.ForeignKey('mpp_purchase_orders.id'), nullable=False), sa.Column('body_digest', sa.String(64), nullable=False), sa.Column('outcome', sa.String(30), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_index('ix_mpp_purchase_events_order_id', 'mpp_purchase_events', ['order_id'])


def downgrade():
    op.drop_table('mpp_purchase_events')
    op.drop_table('mpp_purchase_orders')
    op.drop_table('mpp_package_prices')
    op.drop_column('child_profiles', 'mpp_access_ends_at')
    op.drop_column('child_profiles', 'membership_provider')
