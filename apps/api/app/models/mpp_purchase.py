from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.entities import uuid_pk


class MppPackagePrice(Base):
    __tablename__ = 'mpp_package_prices'
    plan_code: Mapped[str] = mapped_column(String(80), primary_key=True)
    amount_minor: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default='THB')
    duration_days: Mapped[int] = mapped_column(Integer, default=30)
    entitlement_plan: Mapped[str] = mapped_column(String(40))
    program_type: Mapped[str] = mapped_column(String(3))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class MppPurchaseOrder(Base):
    __tablename__ = 'mpp_purchase_orders'
    __table_args__ = (Index('uq_mpp_pending_child', 'child_id', unique=True, postgresql_where=text("status = 'PENDING'"), sqlite_where=text("status = 'PENDING'")),)
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    child_id: Mapped[str] = mapped_column(ForeignKey('child_profiles.id'), index=True)
    plan_code: Mapped[str] = mapped_column(ForeignKey('mpp_package_prices.plan_code'))
    amount_minor: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3))
    duration_days: Mapped[int] = mapped_column(Integer)
    entitlement_plan: Mapped[str] = mapped_column(String(40))
    program_type: Mapped[str] = mapped_column(String(3))
    merchant_order_id: Mapped[str] = mapped_column(String(120), unique=True)
    idempotency_key: Mapped[str] = mapped_column(String(120), unique=True)
    api_origin: Mapped[str] = mapped_column(String(200))
    merchant_name: Mapped[str] = mapped_column(String(160))
    project_name: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(30), default='PENDING')
    remote_status: Mapped[str | None] = mapped_column(String(40))
    payment_id: Mapped[str | None] = mapped_column(String(120), unique=True)
    session_token: Mapped[str | None] = mapped_column(Text)
    session_url: Mapped[str | None] = mapped_column(Text)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    granted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(String(80))
    last_rechecked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MppPurchaseEvent(Base):
    __tablename__ = 'mpp_purchase_events'
    event_id: Mapped[str] = mapped_column(String(160), primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey('mpp_purchase_orders.id'), index=True)
    body_digest: Mapped[str] = mapped_column(String(64))
    outcome: Mapped[str] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
