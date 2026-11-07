"""Isolated Merchant Platform staging UAT tables."""
from alembic import op
import sqlalchemy as sa

revision = "20261014_0002"
down_revision = "20260617_0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "mpp_test_transactions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("merchant_order_id", sa.String(120), nullable=False, unique=True),
        sa.Column("idempotency_key", sa.String(120), nullable=False, unique=True),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("remote_status", sa.String(40)),
        sa.Column("payment_id", sa.String(120), unique=True),
        sa.Column("payment_session_token", sa.Text()),
        sa.Column("payment_session_url", sa.Text()),
        sa.Column("withdrawal_id", sa.String(120), unique=True),
        sa.Column("status_token", sa.Text()),
        sa.Column("checks", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "mpp_test_webhook_events",
        sa.Column("event_id", sa.String(160), primary_key=True),
        sa.Column("body_sha256", sa.String(64), nullable=False),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("transaction_id", sa.String(36), sa.ForeignKey("mpp_test_transactions.id")),
        sa.Column("outcome", sa.String(30), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_table("mpp_test_webhook_events")
    op.drop_table("mpp_test_transactions")
