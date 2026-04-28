"""FastAPI dependency injection factories.

Each function is a FastAPI dependency — use via Depends() in route handlers.
Clients are created once per request (or shared via module-level singletons
where the client itself is thread/async safe).
"""

from collections.abc import AsyncGenerator
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import Depends
from qdrant_client import AsyncQdrantClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import Settings, get_settings

# ─── Database ────────────────────────────────────────────────────────────────

def _make_engine(settings: Settings):
    """Create SQLAlchemy async engine from settings."""
    return create_async_engine(
        settings.database_url,
        echo=settings.is_development,   # Log SQL only in dev
        pool_pre_ping=True,             # Detect stale connections before use
        pool_size=10,
        max_overflow=20,
    )


def _make_session_factory(settings: Settings) -> async_sessionmaker[AsyncSession]:
    engine = _make_engine(settings)
    return async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )


# Module-level session factory — reused across requests
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_session_factory(
    settings: Annotated[Settings, Depends(get_settings)],
) -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = _make_session_factory(settings)
    return _session_factory


async def get_db_session(
    factory: Annotated[async_sessionmaker[AsyncSession], Depends(get_session_factory)],
) -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session and commit/rollback on exit."""
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ─── Redis ───────────────────────────────────────────────────────────────────

_redis_client: aioredis.Redis | None = None


async def get_redis(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AsyncGenerator[aioredis.Redis, None]:
    """Yield a Redis client. Reuses a module-level pool."""
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=50,
        )
    yield _redis_client


# ─── Qdrant ──────────────────────────────────────────────────────────────────

_qdrant_client: AsyncQdrantClient | None = None


async def get_qdrant(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AsyncGenerator[AsyncQdrantClient, None]:
    """Yield an async Qdrant client. Reuses a module-level singleton."""
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = AsyncQdrantClient(url=settings.qdrant_url)
    yield _qdrant_client


# ─── Convenience type aliases (use in route signatures) ──────────────────────

DbSession = Annotated[AsyncSession, Depends(get_db_session)]
RedisClient = Annotated[aioredis.Redis, Depends(get_redis)]
QdrantDB = Annotated[AsyncQdrantClient, Depends(get_qdrant)]
AppSettings = Annotated[Settings, Depends(get_settings)]
