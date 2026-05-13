"""User profile schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class UserProfileResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    subscription_tier: str
    email_verified: bool
    is_active: bool = True
    profile_image_url: str | None = None
    last_login: datetime | None = None
    created_at: datetime


class UpdateProfileRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    profile_image_url: str | None = Field(None, max_length=500)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=6, max_length=256)


class ChangePasswordResponse(BaseModel):
    message: str


class UsageResponse(BaseModel):
    documents_processed: int = 0
    api_calls_used: int = 0
    storage_used_mb: float = 0.0
    limits: dict = {}
    usage_percentage: dict = {}
