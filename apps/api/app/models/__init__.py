"""ORM models package.

Importing this package registers all models with Base.metadata so that
Alembic autogenerate sees every table when it inspects the metadata.
"""

from app.models.base import Base, TimestampMixin
from app.models.build_history import AutopilotBuild
from app.models.auth_tokens import EmailVerificationToken, PasswordResetToken
from app.models.deployment import Deployment
from app.models.evaluation_run import EvaluationRun
from app.models.pipeline_config import PipelineConfig
from app.models.project import Project
from app.models.user import User

__all__ = [
    "Base",
    "TimestampMixin",
    "User",
    "Project",
    "PipelineConfig",
    "AutopilotBuild",
    "EvaluationRun",
    "Deployment",
    "EmailVerificationToken",
    "PasswordResetToken",
]
