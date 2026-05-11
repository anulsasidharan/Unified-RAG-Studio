"""Subscription and plan management endpoints."""

from __future__ import annotations

import uuid as uuid_lib

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import CurrentPrincipal, DbSession
from app.models.subscription_plan import SubscriptionPlan
from app.models.user import User
from app.schemas.subscription import (
    PlansListResponse,
    SubscriptionPlanResponse,
    UpgradeSubscriptionRequest,
)

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

_BUILTIN_PLANS: list[SubscriptionPlanResponse] = [
    SubscriptionPlanResponse(
        id="plan-free",
        name="Free",
        description="Get started with RAG Studio",
        price_monthly=0.0,
        price_yearly=0.0,
        features={"max_documents": 100, "api_calls_limit": 1000, "storage_limit_mb": 50},
        is_active=True,
    ),
    SubscriptionPlanResponse(
        id="plan-pro",
        name="Pro",
        description="For growing teams",
        price_monthly=29.99,
        price_yearly=299.99,
        features={"max_documents": 1000, "api_calls_limit": 10000, "storage_limit_mb": 500},
        is_active=True,
    ),
    SubscriptionPlanResponse(
        id="plan-enterprise",
        name="Enterprise",
        description="For large organizations",
        price_monthly=99.99,
        price_yearly=999.99,
        features={
            "max_documents": -1,
            "api_calls_limit": -1,
            "storage_limit_mb": -1,
            "priority_support": True,
        },
        is_active=True,
    ),
]

_BUILTIN_TIER_MAP = {
    "plan-free": "free",
    "plan-pro": "pro",
    "plan-enterprise": "enterprise",
}


@router.get("/plans", response_model=PlansListResponse, summary="List available subscription plans")
async def list_plans(session: DbSession, principal: CurrentPrincipal) -> PlansListResponse:
    result = await session.execute(
        select(SubscriptionPlan)
        .where(SubscriptionPlan.is_active == True)  # noqa: E712
        .order_by(SubscriptionPlan.price_monthly)
    )
    plans = result.scalars().all()

    if not plans:
        return PlansListResponse(plans=_BUILTIN_PLANS)

    return PlansListResponse(
        plans=[
            SubscriptionPlanResponse(
                id=str(p.id),
                name=p.name,
                description=p.description,
                price_monthly=float(p.price_monthly),
                price_yearly=float(p.price_yearly),
                features=p.features or {},
                is_active=p.is_active,
            )
            for p in plans
        ]
    )


@router.post("/upgrade", summary="Upgrade or change subscription plan")
async def upgrade_subscription(
    body: UpgradeSubscriptionRequest,
    principal: CurrentPrincipal,
    session: DbSession,
) -> dict:
    plan_name: str | None = None

    # Try built-in plan IDs first
    plan_name = _BUILTIN_TIER_MAP.get(body.plan_id)

    if plan_name is None:
        # Try as UUID for DB-managed plans
        try:
            plan_uuid = uuid_lib.UUID(body.plan_id)
            plan = await session.get(SubscriptionPlan, plan_uuid)
            if plan is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
            plan_name = plan.name.lower()
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid plan ID")

    user = await session.get(User, principal.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.subscription_tier = plan_name
    await session.commit()

    return {"message": f"Subscription updated to {plan_name}", "subscription_tier": plan_name}


@router.post("/cancel", summary="Cancel subscription (revert to Free)")
async def cancel_subscription(principal: CurrentPrincipal, session: DbSession) -> dict:
    user = await session.get(User, principal.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.subscription_tier = "free"
    await session.commit()

    return {"message": "Subscription cancelled. You are now on the Free plan."}
