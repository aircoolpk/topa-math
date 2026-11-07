"""Persist provider ownership for in-flight Stripe checkouts."""
from alembic import op
import sqlalchemy as sa

revision = '20261015_0004'
down_revision = '20261015_0003'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('billing_checkout_reservations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('provider', sa.String(16), nullable=False),
        sa.Column('plan_code', sa.String(80), nullable=False),
        sa.Column('status', sa.String(24), nullable=False),
        sa.Column('external_id', sa.String(160), unique=True),
        sa.Column('checkout_url', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_index('ix_billing_checkout_reservations_user_id', 'billing_checkout_reservations', ['user_id'])
    op.create_index('uq_checkout_pending_user', 'billing_checkout_reservations', ['user_id'], unique=True, postgresql_where=sa.text("status = 'PENDING'"), sqlite_where=sa.text("status = 'PENDING'"))


def downgrade():
    op.drop_table('billing_checkout_reservations')
