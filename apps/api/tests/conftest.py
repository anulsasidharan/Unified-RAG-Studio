"""Shared pytest fixtures for the RAG Studio API test suite."""

from collections.abc import AsyncIterator, Iterator
import os
import uuid

from fastapi import Header, HTTPException, status
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security.auth import AuthPrincipal, hash_password
from app.dependencies import get_current_principal, get_request_user_id
from app.main import app
from app.models import Base
from app.models.user import User

# All static user UUIDs referenced across unit test files — must exist in the SQLite DB.
_TEST_USERS = [
    (
        "22222222-2222-4222-8222-222222222222",
        "unit-test-auto@ragstudio.test",
        "Autopilot Test User",
    ),
    ("11111111-1111-4111-8111-111111111111", "unit-test-a@ragstudio.test", "Test User A"),
    (
        "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        "unit-test-designer@ragstudio.test",
        "Designer Test User",
    ),
    ("bbbbbbbb-cccc-4ddd-8eee-ffffffffffff", "unit-test-other@ragstudio.test", "Other Test User"),
    (
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "unit-test-deploy@ragstudio.test",
        "Deployment Test User",
    ),
    (
        "dddddddd-dddd-4ddd-addd-dddddddddddd",
        "unit-test-other2@ragstudio.test",
        "Other Test User 2",
    ),
]


def pytest_configure() -> None:
    """Establish test environment before app imports use cached settings."""
    os.environ.setdefault("APP_ENV", "test")
    os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
    os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
    os.environ.setdefault("SECRET_KEY", "test-secret-key")
    os.environ.setdefault("OPENAI_API_KEY", "sk-test-placeholder")
    os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test-placeholder")


@pytest.fixture(scope="session", autouse=True)
def _sqlite_schema():
    """Create ORM tables and seed test users for the session SQLite DB."""
    get_settings.cache_clear()
    url = get_settings().database_url_sync
    engine = create_engine(url, echo=False)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    pw = hash_password("test-password")
    with Session(engine) as session:
        for uid_str, email, name in _TEST_USERS:
            uid = uuid.UUID(uid_str)
            if session.get(User, uid) is None:
                session.add(
                    User(
                        id=uid,
                        email=email,
                        name=name,
                        password_hash=pw,
                        email_verified=True,
                        subscription_tier="pro",
                        role="user",
                        is_active=True,
                    )
                )
        session.commit()
    engine.dispose()
    get_settings.cache_clear()
    yield


@pytest.fixture(scope="session", autouse=True)
def override_settings():
    """Reset cached Settings between sessions (inherits env from module load time)."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


_TEST_USER_MAP: dict[str, tuple[str, str]] = {
    uid: (email, name) for uid, email, name in _TEST_USERS
}


async def _user_id_from_header(
    x_user_id: str | None = Header(default=None),
) -> uuid.UUID:
    """Auth override: accept X-User-ID header instead of JWT Bearer token."""
    if not x_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-User-ID")
    try:
        return uuid.UUID(x_user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-User-ID"
        ) from exc


async def _principal_from_header(
    x_user_id: str | None = Header(default=None),
) -> AuthPrincipal:
    """Auth override: return an admin AuthPrincipal derived from X-User-ID header."""
    if not x_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-User-ID")
    try:
        uid = uuid.UUID(x_user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid X-User-ID"
        ) from exc
    email, name = _TEST_USER_MAP.get(x_user_id, ("test@ragstudio.test", "Test User"))
    return AuthPrincipal(
        user_id=uid,
        email=email,
        role="admin",
        name=name,
        subscription_tier="pro",
        email_verified=True,
    )


@pytest.fixture
def sync_client() -> Iterator[TestClient]:
    """Synchronous test client — for simple route tests."""
    app.dependency_overrides[get_request_user_id] = _user_id_from_header
    app.dependency_overrides[get_current_principal] = _principal_from_header
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_request_user_id, None)
    app.dependency_overrides.pop(get_current_principal, None)


@pytest.fixture
async def async_client() -> AsyncIterator[AsyncClient]:
    """Async test client — for async route + dependency tests."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client
