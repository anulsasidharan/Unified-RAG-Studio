"""Authentication API endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status

from app.config import get_settings
from app.core.security.auth import AuthPrincipal, create_access_token
from app.dependencies import CurrentPrincipal
from app.schemas.auth import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _bootstrap_lookup(email: str) -> tuple[str, str, uuid.UUID] | None:
    settings = get_settings()
    for row in settings.auth_bootstrap_users.split(","):
        cell = row.strip()
        if not cell:
            continue
        parts = cell.split(":")
        if len(parts) != 4:
            continue
        row_email, row_password, row_role, row_user_id = parts
        if row_email.lower() != email.lower():
            continue
        try:
            uid = uuid.UUID(row_user_id)
        except ValueError:
            continue
        return row_password, row_role, uid
    return None


@router.post("/login", response_model=LoginResponse, summary="Issue JWT access token")
async def login(body: LoginRequest) -> LoginResponse:
    settings = get_settings()
    found = _bootstrap_lookup(body.email)
    if found is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    expected_password, role, user_id = found
    if body.password != expected_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(
        settings=settings,
        subject=AuthPrincipal(user_id=user_id, email=body.email, role=role),
    )
    return LoginResponse(
        access_token=token,
        expires_in_seconds=settings.auth_access_token_ttl_minutes * 60,
        user_id=str(user_id),
        role=role,
    )


@router.get("/me", summary="Get authenticated principal")
async def me(principal: CurrentPrincipal) -> dict[str, str]:
    return {
        "user_id": str(principal.user_id),
        "email": principal.email,
        "role": principal.role,
    }
