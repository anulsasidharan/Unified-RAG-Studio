"""Alembic environment — async SQLAlchemy + DATABASE_URL from pydantic-settings."""

import asyncio
import logging
from logging.config import fileConfig
from pathlib import Path
import sys

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# Ensure apps/api is on sys.path when Alembic runs from CI or repo root
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from app.config import get_settings  # noqa: E402
from app.models import Base  # noqa: E402  # registers all ORM models with Base.metadata

alembic_config = context.config
if alembic_config.config_file_name:
    fileConfig(alembic_config.config_file_name)

logger = logging.getLogger("alembic.env")
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (generates SQL to stdout)."""
    url = get_settings().database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations against a live async engine."""
    engine = create_async_engine(get_settings().database_url)
    async with engine.connect() as conn:
        await conn.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
