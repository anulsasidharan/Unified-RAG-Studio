"""Celery worker package — asynchronous jobs for builds, evaluations, deployments (P2-8)."""

# Side-effect imports register `@celery_app.task` handlers on startup.
from app.worker import tasks  # noqa: F401
from app.worker.celery_app import celery_app

__all__ = ["celery_app"]
