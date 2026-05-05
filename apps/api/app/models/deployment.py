"""Deployment ORM model — cloud deployment lifecycle for a pipeline config."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.pipeline_config import PipelineConfig


class Deployment(Base, TimestampMixin):
    __tablename__ = "deployments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    config_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("pipeline_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    environment: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        server_default="staging",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        server_default="deploying",
    )
    endpoint: Mapped[str | None] = mapped_column(Text, nullable=True)
    health_check_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    docker_image_tag: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Cloud-provider-specific metadata (region, instance type, ARNs, etc.)
    deployment_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    deployed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    config: Mapped[PipelineConfig] = relationship("PipelineConfig", back_populates="deployments")

    __table_args__ = (
        Index("ix_deployments_user_id_id", "user_id", "id"),
    )
