from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, String, Uuid, func, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )
    subscription_tier: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        server_default="free",
    )
    # Used for existing AdminPrincipal checks (deployment/teardown).
    role: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        server_default="user",
    )

    __table_args__ = (
        Index("ix_users_email_lower", "email"),
    )

