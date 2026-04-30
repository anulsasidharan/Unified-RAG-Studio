"""ORM models package.

Importing this package registers all models with Base.metadata so that
Alembic autogenerate sees every table when it inspects the metadata.
"""

from app.models.base import Base, TimestampMixin
from app.models.build_history import AutopilotBuild
from app.models.deployment import Deployment
from app.models.evaluation_run import EvaluationRun
from app.models.pipeline_config import PipelineConfig
from app.models.project import Project

__all__ = [
    "Base",
    "TimestampMixin",
    "Project",
    "PipelineConfig",
    "AutopilotBuild",
    "EvaluationRun",
    "Deployment",
]
