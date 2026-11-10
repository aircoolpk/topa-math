from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def _connect_args(url: str) -> dict:
    return {"check_same_thread": False} if url.startswith("sqlite") else {}


_database_url = get_settings().database_url
_engine_options = {"connect_args": _connect_args(_database_url)}
if _database_url == "sqlite:///:memory:":
    _engine_options["poolclass"] = StaticPool
else:
    # A pooled Postgres endpoint closes idle connections on its own schedule.
    # Without the pre-ping the application hands out a connection that the
    # server already closed, and the request fails with "consuming input
    # failed: SSL connection has been closed unexpectedly". The pre-ping
    # validates the connection before it is used, and the recycle interval
    # keeps the pool from handing out connections that are about to expire.
    _engine_options["pool_pre_ping"] = True
    _engine_options["pool_recycle"] = 300
    _engine_options["pool_size"] = 5
    _engine_options["max_overflow"] = 10

engine = create_engine(_database_url, **_engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
