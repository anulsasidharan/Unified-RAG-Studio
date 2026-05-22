"""ORM models package.

Importing this package registers all models with Base.metadata so that
Alembic autogenerate sees every table when it inspects the metadata.
"""

from app.models.activity_log import UserActivityLog
from app.models.api_key import APIKey
from app.models.auth_tokens import EmailVerificationToken, PasswordResetToken
from app.models.base import Base, TimestampMixin
from app.models.build_history import AutopilotBuild
from app.models.deployment import Deployment
from app.models.evaluation_run import EvaluationRun
from app.models.pipeline_config import PipelineConfig
from app.models.project import Project
from app.models.subscription_plan import SubscriptionPlan
from app.models.user import User
from app.models.user_subscription import UserSubscription

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
    "SubscriptionPlan",
    "UserSubscription",
    "APIKey",
    "UserActivityLog",
]
