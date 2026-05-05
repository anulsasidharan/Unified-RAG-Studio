"""AutopilotBuild ORM model — tracks Autopilot build runs and agent decisions."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.evaluation_run import EvaluationRun
    from app.models.project import Project


class AutopilotBuild(Base, TimestampMixin):
    __tablename__ = "autopilot_builds"

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
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        server_default="pending",
    )
    progress: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    current_stage: Mapped[str] = mapped_column(String(64), nullable=False, server_default="")
    iteration: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    # Serialised BuildRequirementsSchema
    requirements: Mapped[dict] = mapped_column(JSON, nullable=False, server_default="{}")
    # dict[str, StageStatusSchema] — keyed by stage name
    stages: Mapped[dict] = mapped_column(JSON, nullable=False, server_default="{}")
    # list[BuildMessageSchema]
    messages: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    # BuildResultSchema | null
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    project: Mapped[Project] = relationship("Project", back_populates="autopilot_builds")
    evaluations: Mapped[list[EvaluationRun]] = relationship(
        "EvaluationRun",
        back_populates="build",
    )

    __table_args__ = (
        Index("ix_autopilot_builds_user_id_id", "user_id", "id"),
    )
