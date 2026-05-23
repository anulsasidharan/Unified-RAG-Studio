"""Integration test fixtures — auth bypass + test user seed."""

from __future__ import annotations

from collections.abc import Iterator
import uuid

from fastapi import Header, HTTPException, status
from fastapi.testclient import TestClient
import pytest

from app.dependencies import get_request_user_id
from app.main import app

TEST_USER_ID = uuid.UUID("c0dec0de-c0de-4c0d-8c0d-c0dec0dec0de")


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
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid X-User-ID"
        ) from exc


@pytest.fixture(scope="session", autouse=True)
def _seed_test_user():
    """Insert the hardcoded test user into the DB so service lookups succeed."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.config import get_settings
    from app.core.security.auth import hash_password
    from app.models.user import User

    settings = get_settings()
    engine = create_engine(settings.database_url_sync, echo=False)
    with Session(engine) as session:
        existing = session.get(User, TEST_USER_ID)
        if existing is None:
            session.add(
                User(
                    id=TEST_USER_ID,
                    email="test-integration@ragstudio.test",
                    name="Test Integration User",
                    password_hash=hash_password("test-password"),
                    email_verified=True,
                    subscription_tier="pro",
                    role="user",
                    is_active=True,
                )
            )
            session.commit()
    engine.dispose()
    yield


@pytest.fixture
def sync_client(_seed_test_user: None) -> Iterator[TestClient]:
    """Integration test client with X-User-ID header auth bypass."""
    app.dependency_overrides[get_request_user_id] = _user_id_from_header
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_request_user_id, None)
