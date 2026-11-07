from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.entities import JsonDict, uuid_pk


class MppTestTransaction(Base):
    __tablename__ = "mpp_test_transactions"

    id: Mapped[str] = uuid_pk()
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(20))
    merchant_order_id: Mapped[str] = mapped_column(String(120), unique=True)
    idempotency_key: Mapped[str] = mapped_column(String(120), unique=True)
    amount: Mapped[int] = mapped_column(Integer, default=1500)
    status: Mapped[str] = mapped_column(String(30), default="PENDING_PAYMENT")
    remote_status: Mapped[str | None] = mapped_column(String(40))
    payment_id: Mapped[str | None] = mapped_column(String(120), unique=True)
    payment_session_token: Mapped[str | None] = mapped_column(Text)
    payment_session_url: Mapped[str | None] = mapped_column(Text)
    withdrawal_id: Mapped[str | None] = mapped_column(String(120), unique=True)
    status_token: Mapped[str | None] = mapped_column(Text)
    checks: Mapped[dict] = mapped_column(JsonDict, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MppTestWebhookEvent(Base):
    __tablename__ = "mpp_test_webhook_events"

    event_id: Mapped[str] = mapped_column(String(160), primary_key=True)
    body_sha256: Mapped[str] = mapped_column(String(64))
    event_type: Mapped[str] = mapped_column(String(80))
    transaction_id: Mapped[str | None] = mapped_column(ForeignKey("mpp_test_transactions.id"))
    outcome: Mapped[str] = mapped_column(String(30))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
