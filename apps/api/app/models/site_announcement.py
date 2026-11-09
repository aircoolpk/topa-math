"""Site announcements for the public homepage news card.

These rows live in Postgres on purpose: ``app/content/site/homepage.json`` is
baked into the Docker image (``COPY app ./app``), so any admin edit made to
that file is lost on the next image rebuild. Announcements therefore stay in
the database and are merged into the homepage payload at request time.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.entities import TimestampMixin, uuid_pk


class SiteAnnouncement(Base, TimestampMixin):
    """A single news/announcement card shown on the public homepage."""

    __tablename__ = "site_announcements"
    __table_args__ = (
        Index("ix_site_announcements_published_sort", "published", "sort_order"),
    )

    id: Mapped[str] = uuid_pk()
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text, default="")
    link_url: Mapped[str | None] = mapped_column(String(500))
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
