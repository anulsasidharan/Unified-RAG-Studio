"""PipelineConfig ORM model — persisted RAG pipeline configuration."""

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class PipelineConfig(Base, TimestampMixin):
    __tablename__ = "pipeline_configs"

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
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False, server_default="1.0.0")
    cloud_provider: Mapped[str] = mapped_column(String(32), nullable=False)
    # Full PipelineConfigurationSchema stored as binary JSON
    config: Mapped[dict] = mapped_column(JSONB, nullable=False)
    source: Mapped[str | None] = mapped_column(String(32), nullable=True)
    build_id: Mapped[str | None] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="pipeline_configs")  # noqa: F821
    evaluations: Mapped[list["EvaluationRun"]] = relationship(  # noqa: F821
        "EvaluationRun",
        back_populates="config",
        cascade="all, delete-orphan",
    )
    deployments: Mapped[list["Deployment"]] = relationship(  # noqa: F821
        "Deployment",
        back_populates="config",
        cascade="all, delete-orphan",
    )
