"""Project ORM model — top-level container for pipeline configurations."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.build_history import AutopilotBuild
    from app.models.pipeline_config import PipelineConfig


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

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
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # Relationships populated once the related models are imported
    pipeline_configs: Mapped[list[PipelineConfig]] = relationship(
        "PipelineConfig",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    autopilot_builds: Mapped[list[AutopilotBuild]] = relationship(
        "AutopilotBuild",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_projects_user_id_id", "user_id", "id"),
    )
