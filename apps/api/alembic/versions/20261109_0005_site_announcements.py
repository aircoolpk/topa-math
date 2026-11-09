"""add site announcements table for the homepage news card

Announcements live in Postgres because app/content/site/homepage.json is
baked into the Docker image and admin edits to that file are lost on every
image rebuild.

Revision ID: 20261109_0005
Revises: 20261015_0004
Create Date: 2026-11-09
"""

from alembic import op
import sqlalchemy as sa

revision = "20261109_0005"
down_revision = "20261015_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "site_announcements",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("link_url", sa.String(500), nullable=True),
        sa.Column("published", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_site_announcements_published_sort",
        "site_announcements",
        ["published", "sort_order"],
    )


def downgrade() -> None:
    op.drop_index("ix_site_announcements_published_sort", table_name="site_announcements")
    op.drop_table("site_announcements")
