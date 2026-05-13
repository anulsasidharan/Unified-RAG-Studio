"""Admin panel schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class AdminUserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    subscription_tier: str
    is_active: bool
    email_verified: bool
    created_at: datetime
    last_login: datetime | None = None


class AdminUsersListResponse(BaseModel):
    users: list[AdminUserResponse]
    total: int
    page: int
    pages: int
    per_page: int


class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=6, max_length=256)
    role: str = "user"
    subscription_tier: str = "free"


class UpdateUserRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    role: str | None = None
    subscription_tier: str | None = None
    is_active: bool | None = None


class ActivityLogResponse(BaseModel):
    id: str
    action: str
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime


class UserActivityResponse(BaseModel):
    activities: list[ActivityLogResponse]
    total: int


class AnalyticsResponse(BaseModel):
    total_users: int
    active_users: int
    new_registrations_30d: int
    plan_distribution: dict
    role_distribution: dict


class CreatePlanRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    price_monthly: float = 0.0
    price_yearly: float = 0.0
    features: dict = {}


class UpdatePlanRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    price_monthly: float | None = None
    price_yearly: float | None = None
    features: dict | None = None
    is_active: bool | None = None
