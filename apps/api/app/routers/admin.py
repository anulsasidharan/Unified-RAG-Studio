"""Admin-only endpoints: user management, analytics, and plan management."""

from __future__ import annotations

import math
import uuid as uuid_lib
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import func, or_, select

from app.core.security.auth import hash_password
from app.dependencies import AdminPrincipal, DbSession
from app.models.activity_log import UserActivityLog
from app.models.subscription_plan import SubscriptionPlan
from app.models.user import User
from app.schemas.admin import (
    ActivityLogResponse,
    AdminUserResponse,
    AdminUsersListResponse,
    AnalyticsResponse,
    CreatePlanRequest,
    CreateUserRequest,
    UpdatePlanRequest,
    UpdateUserRequest,
    UserActivityResponse,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _user_to_admin_response(u: User) -> AdminUserResponse:
    return AdminUserResponse(
        id=str(u.id),
        email=u.email,
        name=u.name,
        role=u.role,
        subscription_tier=u.subscription_tier,
        is_active=u.is_active,
        email_verified=u.email_verified,
        created_at=u.created_at,
        last_login=u.last_login,
    )


@router.get("/users", response_model=AdminUsersListResponse, summary="List all users")
async def list_users(
    _: AdminPrincipal,
    session: DbSession,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
    search: str = Query(default=""),
    role: str = Query(default=""),
    subscription_tier: str = Query(default=""),
) -> AdminUsersListResponse:
    query = select(User)

    if search:
        like = f"%{search}%"
        query = query.where(or_(User.email.ilike(like), User.name.ilike(like)))
    if role:
        query = query.where(User.role == role)
    if subscription_tier:
        query = query.where(User.subscription_tier == subscription_tier)

    count_result = await session.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    offset = (page - 1) * per_page
    result = await session.execute(
        query.order_by(User.created_at.desc()).offset(offset).limit(per_page)
    )
    users = result.scalars().all()
    pages = math.ceil(total / per_page) if total > 0 else 1

    return AdminUsersListResponse(
        users=[_user_to_admin_response(u) for u in users],
        total=total,
        page=page,
        pages=pages,
        per_page=per_page,
    )


@router.post(
    "/users",
    response_model=AdminUserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
)
async def create_user(
    body: CreateUserRequest,
    _: AdminPrincipal,
    session: DbSession,
) -> AdminUserResponse:
    email = body.email.lower().strip()
    existing = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(body.password),
        name=body.name.strip(),
        email_verified=True,
        subscription_tier=body.subscription_tier,
        role=body.role,
        is_active=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return _user_to_admin_response(user)


@router.put("/users/{user_id}", response_model=AdminUserResponse, summary="Update user")
async def update_user(
    user_id: str,
    body: UpdateUserRequest,
    _: AdminPrincipal,
    session: DbSession,
) -> AdminUserResponse:
    try:
        uid = uuid_lib.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    user = await session.get(User, uid)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if body.name is not None:
        user.name = body.name
    if body.role is not None:
        user.role = body.role
    if body.subscription_tier is not None:
        user.subscription_tier = body.subscription_tier
    if body.is_active is not None:
        user.is_active = body.is_active

    await session.commit()
    await session.refresh(user)
    return _user_to_admin_response(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete user")
async def delete_user(
    user_id: str,
    _: AdminPrincipal,
    session: DbSession,
) -> Response:
    try:
        uid = uuid_lib.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    user = await session.get(User, uid)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await session.delete(user)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/users/{user_id}/activity",
    response_model=UserActivityResponse,
    summary="Get activity log for a user",
)
async def get_user_activity(
    user_id: str,
    _: AdminPrincipal,
    session: DbSession,
    limit: int = Query(default=20, ge=1, le=100),
) -> UserActivityResponse:
    try:
        uid = uuid_lib.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    result = await session.execute(
        select(UserActivityLog)
        .where(UserActivityLog.user_id == uid)
        .order_by(UserActivityLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()

    total_result = await session.execute(
        select(func.count()).where(UserActivityLog.user_id == uid)
    )
    total = total_result.scalar() or 0

    return UserActivityResponse(
        activities=[
            ActivityLogResponse(
                id=str(log.id),
                action=log.action,
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                created_at=log.created_at,
            )
            for log in logs
        ],
        total=total,
    )


@router.get("/analytics", response_model=AnalyticsResponse, summary="Platform analytics")
async def get_analytics(_: AdminPrincipal, session: DbSession) -> AnalyticsResponse:
    thirty_days_ago = datetime.now(UTC) - timedelta(days=30)

    total_users = (await session.execute(select(func.count(User.id)))).scalar() or 0

    # Users active in last 30 days (logged in or recently created)
    active_users = (
        await session.execute(
            select(func.count(User.id)).where(
                or_(
                    User.last_login >= thirty_days_ago,
                    User.created_at >= thirty_days_ago,
                )
            )
        )
    ).scalar() or 0

    new_registrations_30d = (
        await session.execute(
            select(func.count(User.id)).where(User.created_at >= thirty_days_ago)
        )
    ).scalar() or 0

    role_rows = await session.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    )
    role_distribution = {row[0]: row[1] for row in role_rows}

    tier_rows = await session.execute(
        select(User.subscription_tier, func.count(User.id)).group_by(User.subscription_tier)
    )
    plan_distribution = {row[0]: row[1] for row in tier_rows}

    return AnalyticsResponse(
        total_users=total_users,
        active_users=active_users,
        new_registrations_30d=new_registrations_30d,
        plan_distribution=plan_distribution,
        role_distribution=role_distribution,
    )


@router.get("/plans", summary="List all subscription plans (admin)")
async def list_plans(_: AdminPrincipal, session: DbSession) -> dict:
    result = await session.execute(
        select(SubscriptionPlan).order_by(SubscriptionPlan.price_monthly)
    )
    plans = result.scalars().all()
    return {
        "plans": [
            {
                "id": str(p.id),
                "name": p.name,
                "description": p.description,
                "price_monthly": float(p.price_monthly),
                "price_yearly": float(p.price_yearly),
                "features": p.features or {},
                "is_active": p.is_active,
                "created_at": p.created_at.isoformat(),
            }
            for p in plans
        ]
    }


@router.post(
    "/plans",
    status_code=status.HTTP_201_CREATED,
    summary="Create a subscription plan",
)
async def create_plan(body: CreatePlanRequest, _: AdminPrincipal, session: DbSession) -> dict:
    plan = SubscriptionPlan(
        name=body.name,
        description=body.description,
        price_monthly=body.price_monthly,
        price_yearly=body.price_yearly,
        features=body.features,
        is_active=True,
    )
    session.add(plan)
    await session.commit()
    await session.refresh(plan)
    return {
        "id": str(plan.id),
        "name": plan.name,
        "description": plan.description,
        "price_monthly": float(plan.price_monthly),
        "price_yearly": float(plan.price_yearly),
        "features": plan.features or {},
        "is_active": plan.is_active,
    }


@router.put("/plans/{plan_id}", summary="Update a subscription plan")
async def update_plan(
    plan_id: str, body: UpdatePlanRequest, _: AdminPrincipal, session: DbSession
) -> dict:
    try:
        pid = uuid_lib.UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid plan ID")

    plan = await session.get(SubscriptionPlan, pid)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    if body.name is not None:
        plan.name = body.name
    if body.description is not None:
        plan.description = body.description
    if body.price_monthly is not None:
        plan.price_monthly = body.price_monthly
    if body.price_yearly is not None:
        plan.price_yearly = body.price_yearly
    if body.features is not None:
        plan.features = body.features
    if body.is_active is not None:
        plan.is_active = body.is_active

    await session.commit()
    await session.refresh(plan)
    return {
        "id": str(plan.id),
        "name": plan.name,
        "description": plan.description,
        "price_monthly": float(plan.price_monthly),
        "price_yearly": float(plan.price_yearly),
        "features": plan.features or {},
        "is_active": plan.is_active,
    }


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete a plan")
async def delete_plan(plan_id: str, _: AdminPrincipal, session: DbSession) -> Response:
    try:
        pid = uuid_lib.UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid plan ID")

    plan = await session.get(SubscriptionPlan, pid)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    await session.delete(plan)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
