"""Authentication + registration + tenant bootstrap."""

from __future__ import annotations

import hashlib
import time
import uuid
from datetime import UTC, datetime, timedelta

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.config import Settings, get_settings
from app.core.security.auth import AuthPrincipal, create_access_token, hash_password, verify_password
from app.dependencies import CurrentPrincipal, DbSession, RedisClient
from app.models.auth_tokens import EmailVerificationToken, PasswordResetToken
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    PasswordResetResponse,
    RegisterRequest,
    RegisterResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _issue_token_str(*, prefix: str) -> str:
    # url-safe enough for query/body usage; stored only as sha256.
    return f"{prefix}-{uuid.uuid4().hex}-{int(time.time())}"


def _require_verified_login(user: User) -> None:
    if not user.email_verified:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email not verified")


@router.post("/register", response_model=RegisterResponse, summary="Create a new user + send verification token")
async def register(
    body: RegisterRequest,
    session: DbSession,
    settings: Annotated[Settings, Depends(get_settings)],
) -> RegisterResponse:
    email = body.email.lower().strip()
    # Normalize whitespace early.
    name = body.name.strip()

    existing = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(body.password),
        name=name,
        email_verified=False,
        subscription_tier="free",
        role="user",
    )
    session.add(user)
    await session.flush()
    await session.refresh(user)

    raw_token = _issue_token_str(prefix="verify")
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.auth_email_verification_ttl_minutes)

    session.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
    )
    await session.commit()

    resp = RegisterResponse(
        user_id=str(user.id),
        email=user.email,
        name=user.name,
        email_verified=False,
        subscription_tier=user.subscription_tier,
        message="Account created. Verify your email to log in.",
    )
    if settings.auth_dev_return_tokens:
        resp.verification_token = raw_token
    return resp


@router.post("/verify-email", response_model=VerifyEmailResponse, summary="Verify email using token")
async def verify_email(
    body: VerifyEmailRequest,
    session: DbSession,
    settings: Annotated[Settings, Depends(get_settings)],
) -> VerifyEmailResponse:
    raw = body.token.strip()
    token_hash = _hash_token(raw)
    now = datetime.now(UTC)

    tok = (
        await session.execute(
            select(EmailVerificationToken)
            .where(EmailVerificationToken.token_hash == token_hash)
            .where(EmailVerificationToken.expires_at > now)
        )
    ).scalar_one_or_none()
    if tok is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user = await session.get(User, tok.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token user")

    user.email_verified = True
    await session.delete(tok)
    await session.commit()

    return VerifyEmailResponse(user_id=str(user.id), email_verified=user.email_verified)


@router.post("/login", response_model=LoginResponse, summary="Issue JWT access token")
async def login(
    body: LoginRequest,
    session: DbSession,
    settings: Annotated[Settings, Depends(get_settings)],
) -> LoginResponse:
    email = body.email.lower().strip()
    user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is deactivated")

    _require_verified_login(user)

    # Snapshot all attributes before commit — session.commit() expires ORM
    # objects in async mode, making attribute access trigger a lazy load which
    # raises MissingGreenlet in an async context.
    user_id = user.id
    user_email = user.email
    user_role = user.role
    user_name = user.name
    user_tier = user.subscription_tier
    user_verified = user.email_verified

    user.last_login = datetime.now(UTC)
    await session.commit()

    principal = AuthPrincipal(
        user_id=user_id,
        email=user_email,
        role=user_role,
        name=user_name,
        subscription_tier=user_tier,
        email_verified=user_verified,
    )
    token = create_access_token(settings=settings, subject=principal)
    return LoginResponse(
        access_token=token,
        expires_in_seconds=settings.auth_access_token_ttl_minutes * 60,
        user_id=str(user_id),
        role=user_role,
        email=user_email,
        name=user_name,
        subscription_tier=user_tier,
        email_verified=user_verified,
    )


@router.post("/logout", response_model=LogoutResponse, summary="Revoke current access token (best-effort)")
async def logout(
    principal: CurrentPrincipal,
    session: DbSession,
    redis: RedisClient,
    settings: Annotated[Settings, Depends(get_settings)],
) -> LogoutResponse:
    # Principal is already decoded + token revocation is enforced by dependencies.
    # Here we revoke by jti until token expiry (best-effort).
    if not principal.jti:
        return LogoutResponse(message="Logged out.")

    ttl_seconds = max(1, int(settings.auth_access_token_ttl_minutes * 60))
    await redis.set(f"revoked_jti:{principal.jti}", "1", ex=ttl_seconds)
    # Touch session so the dependency-managed transaction behavior stays consistent.
    await session.flush()
    return LogoutResponse(message="Logged out.")


@router.get("/me", summary="Get authenticated user profile")
async def me(principal: CurrentPrincipal) -> LoginResponse:
    # Reuse LoginResponse schema for convenience.
    assert principal.user_id is not None
    return LoginResponse(
        access_token="",
        expires_in_seconds=0,
        user_id=str(principal.user_id),
        role=principal.role,
        email=principal.email,
        name=principal.name,
        subscription_tier=principal.subscription_tier,
        email_verified=principal.email_verified,
    )


@router.post(
    "/password-reset/request",
    response_model=PasswordResetResponse,
    summary="Request password reset token",
)
async def password_reset_request(
    body: PasswordResetRequest,
    session: DbSession,
    settings: Annotated[Settings, Depends(get_settings)],
) -> PasswordResetResponse:
    email = body.email.lower().strip()
    user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()

    # Always return 200 to avoid user enumeration.
    raw_token: str | None = None
    if user is not None:
        raw_token = _issue_token_str(prefix="reset")
        token_hash = _hash_token(raw_token)
        expires_at = datetime.now(UTC) + timedelta(minutes=settings.auth_password_reset_ttl_minutes)
        session.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=token_hash,
                expires_at=expires_at,
            )
        )
        await session.flush()
        await session.commit()

    if settings.auth_dev_return_tokens and raw_token is not None:
        return PasswordResetResponse(
            message="Password reset token issued (development). Use it to reset your password.",
            reset_token=raw_token,
        )
    return PasswordResetResponse(message="If an account exists, a reset token will be sent.")


@router.post(
    "/password-reset/confirm",
    response_model=PasswordResetResponse,
    summary="Confirm password reset using token",
)
async def password_reset_confirm(
    body: PasswordResetConfirmRequest,
    session: DbSession,
    settings: Annotated[Settings, Depends(get_settings)],
) -> PasswordResetResponse:
    raw = body.token.strip()
    token_hash = _hash_token(raw)
    now = datetime.now(UTC)

    tok = (
        await session.execute(
            select(PasswordResetToken)
            .where(PasswordResetToken.token_hash == token_hash)
            .where(PasswordResetToken.expires_at > now)
        )
    ).scalar_one_or_none()
    if tok is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user = await session.get(User, tok.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token user")

    user.password_hash = hash_password(body.new_password)
    await session.delete(tok)
    await session.commit()

    return PasswordResetResponse(message="Password updated. You can now log in.")

