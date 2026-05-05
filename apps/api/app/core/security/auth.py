"""Authentication and authorization primitives for Phase 12."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import uuid

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import Settings

ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@dataclass(frozen=True)
class AuthPrincipal:
    user_id: uuid.UUID
    email: str
    role: str


def create_access_token(
    *,
    settings: Settings,
    subject: AuthPrincipal,
    expires_delta: timedelta | None = None,
) -> str:
    expire = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=settings.auth_access_token_ttl_minutes)
    )
    payload = {
        "sub": str(subject.user_id),
        "email": subject.email,
        "role": subject.role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(settings: Settings, token: str) -> AuthPrincipal:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc

    sub = payload.get("sub")
    email = payload.get("email")
    role = payload.get("role")
    if not isinstance(sub, str) or not isinstance(email, str) or not isinstance(role, str):
        raise ValueError("Malformed token payload")

    try:
        uid = uuid.UUID(sub)
    except ValueError as exc:
        raise ValueError("Malformed token subject") from exc

    return AuthPrincipal(user_id=uid, email=email, role=role)


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
