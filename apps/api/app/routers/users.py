"""User profile management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.core.security.auth import hash_password, verify_password
from app.dependencies import CurrentPrincipal, DbSession
from app.models.user import User
from app.schemas.user import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    UpdateProfileRequest,
    UsageResponse,
    UserProfileResponse,
)

router = APIRouter(prefix="/api/users", tags=["users"])

_TIER_LIMITS = {
    "free": {"max_documents": 100, "api_calls_limit": 1000, "storage_limit_mb": 50},
    "pro": {"max_documents": 1000, "api_calls_limit": 10000, "storage_limit_mb": 500},
    "enterprise": {"max_documents": -1, "api_calls_limit": -1, "storage_limit_mb": -1},
}


def _user_to_profile(user: User) -> UserProfileResponse:
    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role,
        subscription_tier=user.subscription_tier,
        email_verified=user.email_verified,
        is_active=user.is_active,
        profile_image_url=user.profile_image_url,
        last_login=user.last_login,
        created_at=user.created_at,
    )


@router.get("/me", response_model=UserProfileResponse, summary="Get detailed user profile")
async def get_profile(principal: CurrentPrincipal, session: DbSession) -> UserProfileResponse:
    user = await session.get(User, principal.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _user_to_profile(user)


@router.put("/me", response_model=UserProfileResponse, summary="Update user profile")
async def update_profile(
    body: UpdateProfileRequest,
    principal: CurrentPrincipal,
    session: DbSession,
) -> UserProfileResponse:
    user = await session.get(User, principal.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if body.name is not None:
        user.name = body.name
    if body.profile_image_url is not None:
        user.profile_image_url = body.profile_image_url

    await session.commit()
    await session.refresh(user)
    return _user_to_profile(user)


@router.post(
    "/me/change-password",
    response_model=ChangePasswordResponse,
    summary="Change current user password",
)
async def change_password(
    body: ChangePasswordRequest,
    principal: CurrentPrincipal,
    session: DbSession,
) -> ChangePasswordResponse:
    user = await session.get(User, principal.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )

    user.password_hash = hash_password(body.new_password)
    await session.commit()
    return ChangePasswordResponse(message="Password changed successfully")


@router.get("/me/usage", response_model=UsageResponse, summary="Get usage statistics")
async def get_usage(principal: CurrentPrincipal) -> UsageResponse:
    limits = _TIER_LIMITS.get(principal.subscription_tier, _TIER_LIMITS["free"])
    return UsageResponse(
        documents_processed=0,
        api_calls_used=0,
        storage_used_mb=0.0,
        limits=limits,
        usage_percentage={"documents": 0, "api_calls": 0, "storage": 0},
    )
