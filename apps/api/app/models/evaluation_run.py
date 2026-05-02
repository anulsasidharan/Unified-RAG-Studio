"""EvaluationRun ORM model — RAGAS evaluation results per pipeline config."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.build_history import AutopilotBuild
    from app.models.pipeline_config import PipelineConfig


class EvaluationRun(Base, TimestampMixin):
    __tablename__ = "evaluation_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    config_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("pipeline_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Nullable: Autopilot-triggered evaluations link back to a build
    build_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("autopilot_builds.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        server_default="pending",
    )
    # Serialised EvaluationMetrics
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Serialised FailureAnalysisResult
    failure_analysis: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    test_set_size: Mapped[int] = mapped_column(Integer, nullable=False, server_default="50")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    config: Mapped[PipelineConfig] = relationship("PipelineConfig", back_populates="evaluations")
    build: Mapped[AutopilotBuild | None] = relationship("AutopilotBuild", back_populates="evaluations")
