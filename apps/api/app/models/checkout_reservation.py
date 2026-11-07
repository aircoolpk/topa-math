from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.entities import uuid_pk


class CheckoutReservation(Base):
    __tablename__ = 'billing_checkout_reservations'
    __table_args__ = (Index('uq_checkout_pending_user', 'user_id', unique=True, postgresql_where=text("status = 'PENDING'"), sqlite_where=text("status = 'PENDING'")),)
    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    provider: Mapped[str] = mapped_column(String(16))
    plan_code: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(24), default='PENDING')
    external_id: Mapped[str | None] = mapped_column(String(160), unique=True)
    checkout_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

