"""add affiliate commission ledger and withdrawals

Revision ID: 20260617_0001
Revises:
Create Date: 2026-06-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260617_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "affiliate_payout_accounts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payout_method", sa.String(length=20), nullable=False),
        sa.Column("account_holder_name", sa.String(length=160), nullable=False),
        sa.Column("bank_name", sa.String(length=120), nullable=True),
        sa.Column("account_last4", sa.String(length=8), nullable=True),
        sa.Column("promptpay_last4", sa.String(length=8), nullable=True),
        sa.Column("payout_details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_affiliate_payout_accounts_user_id"),
    )
    op.create_index("ix_affiliate_payout_accounts_user_id", "affiliate_payout_accounts", ["user_id"])

    op.create_table(
        "affiliate_withdrawal_requests",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payout_account_id", sa.String(length=36), sa.ForeignKey("affiliate_payout_accounts.id"), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="THB", nullable=False),
        sa.Column("status", sa.String(length=30), server_default="pending_review", nullable=False),
        sa.Column("reviewed_by_admin_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_affiliate_withdrawal_requests_user_id", "affiliate_withdrawal_requests", ["user_id"])
    op.create_index("ix_affiliate_withdrawal_requests_status", "affiliate_withdrawal_requests", ["status"])

    op.create_table(
        "affiliate_commission_ledger",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("affiliate_user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("referred_user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payment_reference_id", sa.String(length=160), nullable=False),
        sa.Column("source_event_id", sa.String(length=160), nullable=True),
        sa.Column("amount_paid_minor", sa.Integer(), nullable=False),
        sa.Column("commission_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="THB", nullable=False),
        sa.Column("rate_bps", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reversed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("withdrawal_request_id", sa.String(length=36), sa.ForeignKey("affiliate_withdrawal_requests.id", ondelete="SET NULL"), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("payment_reference_id", name="uq_affiliate_commission_payment_reference"),
    )
    op.create_index("ix_affiliate_commission_ledger_affiliate_user_id", "affiliate_commission_ledger", ["affiliate_user_id"])
    op.create_index("ix_affiliate_commission_ledger_referred_user_id", "affiliate_commission_ledger", ["referred_user_id"])
    op.create_index("ix_affiliate_commission_ledger_status", "affiliate_commission_ledger", ["status"])
    op.create_index("ix_affiliate_commission_ledger_available_at", "affiliate_commission_ledger", ["available_at"])


def downgrade() -> None:
    op.drop_table("affiliate_commission_ledger")
    op.drop_table("affiliate_withdrawal_requests")
    op.drop_table("affiliate_payout_accounts")
