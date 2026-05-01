"""Celery worker package — asynchronous jobs for builds, evaluations, deployments (P2-8)."""

from app.worker.celery_app import celery_app

# Side-effect imports register `@celery_app.task` handlers on startup.
from app.worker import tasks  # noqa: F401

__all__ = ["celery_app"]
