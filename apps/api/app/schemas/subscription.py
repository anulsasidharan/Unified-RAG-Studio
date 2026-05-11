"""Subscription plan schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SubscriptionPlanResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    price_monthly: float
    price_yearly: float
    features: dict
    is_active: bool


class PlansListResponse(BaseModel):
    plans: list[SubscriptionPlanResponse]


class UserSubscriptionResponse(BaseModel):
    id: str
    plan_id: str
    status: str
    billing_cycle: Optional[str] = None
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool


class UpgradeSubscriptionRequest(BaseModel):
    plan_id: str
    billing_cycle: str = Field(default="monthly", pattern="^(monthly|yearly)$")
