"""Authentication and authorization primitives for Phase 12."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import cast
import uuid

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import Settings

ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


@dataclass(frozen=True)
class AuthPrincipal:
    user_id: uuid.UUID
    email: str
    role: str
    name: str
    subscription_tier: str
    email_verified: bool
    jti: str | None = None


def create_access_token(
    *,
    settings: Settings,
    subject: AuthPrincipal,
    expires_delta: timedelta | None = None,
) -> str:
    expire = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=settings.auth_access_token_ttl_minutes)
    )
    jti = subject.jti or str(uuid.uuid4())
    payload = {
        "sub": str(subject.user_id),
        "email": subject.email,
        "role": subject.role,
        "name": subject.name,
        "subscription_tier": subject.subscription_tier,
        "email_verified": subject.email_verified,
        "jti": jti,
        "exp": expire,
    }
    return cast(str, jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM))


def decode_access_token(settings: Settings, token: str) -> AuthPrincipal:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc

    sub = payload.get("sub")
    email = payload.get("email")
    role = payload.get("role")
    name = payload.get("name")
    subscription_tier = payload.get("subscription_tier")
    email_verified = payload.get("email_verified")
    jti = payload.get("jti")
    if isinstance(email_verified, int):
        email_verified = bool(email_verified)
    if (
        not isinstance(sub, str)
        or not isinstance(email, str)
        or not isinstance(role, str)
        or not isinstance(name, str)
        or not isinstance(subscription_tier, str)
        or not isinstance(email_verified, bool)
        or not isinstance(jti, str)
    ):
        raise ValueError("Malformed token payload")

    try:
        uid = uuid.UUID(sub)
    except ValueError as exc:
        raise ValueError("Malformed token subject") from exc

    return AuthPrincipal(
        user_id=uid,
        email=email,
        role=role,
        name=name,
        subscription_tier=subscription_tier,
        email_verified=email_verified,
        jti=jti,
    )


def hash_password(plain_password: str) -> str:
    return cast(str, pwd_context.hash(plain_password))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return cast(bool, pwd_context.verify(plain_password, hashed_password))
