"""Shared pytest fixtures for the RAG Studio API test suite."""

import os
from collections.abc import AsyncIterator, Iterator

# Environment must be established before importing the app stack (cached Settings + Celery).
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-placeholder")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test-placeholder")

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from app.config import get_settings
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def override_settings():
    """Reset cached Settings between sessions (inherits env from module load time)."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def sync_client() -> Iterator[TestClient]:
    """Synchronous test client — for simple route tests."""
    with TestClient(app) as client:
        yield client


@pytest.fixture
async def async_client() -> AsyncIterator[AsyncClient]:
    """Async test client — for async route + dependency tests."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client
