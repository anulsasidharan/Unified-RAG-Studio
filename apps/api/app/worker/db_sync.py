"""Synchronous SQLAlchemy engine/session helpers for Celery workers."""

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings

_engine = None
_SessionLocal: sessionmaker[Session] | None = None


def get_sync_engine():
    """Lazily create a singleton sync engine (one per worker process)."""
    global _engine, _SessionLocal
    if _engine is None:
        settings = get_settings()
        _engine = create_engine(
            settings.database_url_sync,
            pool_pre_ping=True,
            echo=settings.is_development,
        )
        _SessionLocal = sessionmaker(
            bind=_engine,
            class_=Session,
            autoflush=False,
            expire_on_commit=False,
        )
    return _engine


def get_sync_session_factory() -> sessionmaker[Session]:
    get_sync_engine()
    assert _SessionLocal is not None
    return _SessionLocal


@contextmanager
def sync_session_scope() -> Generator[Session, None, None]:
    """Yield a session and commit / rollback deterministically."""
    factory = get_sync_session_factory()
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
