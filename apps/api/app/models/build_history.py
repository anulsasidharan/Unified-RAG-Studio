"""AutopilotBuild ORM model — tracks Autopilot build runs and agent decisions."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AutopilotBuild(Base, TimestampMixin):
    __tablename__ = "autopilot_builds"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
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
    requirements: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    # dict[str, StageStatusSchema] — keyed by stage name
    stages: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    # list[BuildMessageSchema]
    messages: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    # BuildResultSchema | null
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    project: Mapped["Project"] = relationship("Project", back_populates="autopilot_builds")  # noqa: F821
    evaluations: Mapped[list["EvaluationRun"]] = relationship(  # noqa: F821
        "EvaluationRun",
        back_populates="build",
    )
