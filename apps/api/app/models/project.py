"""Project ORM model — top-level container for pipeline configurations."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.build_history import AutopilotBuild
    from app.models.pipeline_config import PipelineConfig


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

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
