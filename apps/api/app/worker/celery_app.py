"""Celery application bootstrap — Redis broker/backend from Settings."""

from celery import Celery

from app.config import get_settings

settings = get_settings()

broker = settings.celery_broker_url.strip() or settings.redis_url
backend = settings.celery_result_backend.strip() or settings.redis_url

celery_app = Celery(
    "rag_studio",
    broker=broker,
    backend=backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_default_queue=settings.celery_task_default_queue,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_track_started=True,
    task_time_limit=60 * 60,
    task_soft_time_limit=int(55 * 60),
    task_always_eager=settings.celery_task_always_eager,
)
