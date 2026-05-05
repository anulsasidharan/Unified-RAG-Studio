"""Request-scoped logging context via structlog contextvars."""

from __future__ import annotations

from typing import Any
import uuid

import structlog


def bind_request_observability(
    *,
    request_id: str,
    correlation_id: str,
    **extra: Any,
) -> None:
    """Attach IDs used across logs for a single HTTP request."""
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        correlation_id=correlation_id,
        **extra,
    )


def bind_build_context(build_id: uuid.UUID | str | None) -> None:
    """Tag logs with an Autopilot build id inside the active request."""
    if build_id is None:
        structlog.contextvars.bind_contextvars(autopilot_build_id=None)
        return
    sid = str(build_id).strip()
    structlog.contextvars.bind_contextvars(autopilot_build_id=sid or None)


def clear_observability_context() -> None:
    """Reset contextvars after each request."""
    structlog.contextvars.clear_contextvars()
