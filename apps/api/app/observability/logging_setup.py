"""Structured logging configuration — JSON in non-DEBUG environments (P11-1)."""

from __future__ import annotations

import logging
from typing import Any

import structlog

from app.metadata import API_SEMVER


def configure_logging(log_level: str) -> None:
    """Configure structlog + stdlib levels for the API process.

    DEBUG uses a human-readable console renderer; INFO+ uses JSON lines suitable
    for log aggregation (ELK, Loki, CloudWatch, etc.).
    """
    level = getattr(logging, log_level, logging.INFO)
    use_console = log_level == "DEBUG"

    shared_pre: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if use_console:
        processors: list[Any] = [
            *shared_pre,
            structlog.dev.ConsoleRenderer(colors=True),
        ]
    else:
        processors = [
            *shared_pre,
            structlog.processors.dict_tracebacks,
            _inject_service_identity,
            structlog.processors.JSONRenderer(),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(level=level)
    logging.getLogger("uvicorn").setLevel(level)
    logging.getLogger("uvicorn.access").setLevel(level)
    logging.getLogger("uvicorn.error").setLevel(level)


def _inject_service_identity(
    _logger: Any, _method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    event_dict.setdefault("service", "rag-studio-api")
    event_dict.setdefault("service_version", API_SEMVER)
    return event_dict
