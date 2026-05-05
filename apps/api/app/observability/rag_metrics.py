"""Application-level Prometheus metrics beyond guardrails (P11-2)."""

from __future__ import annotations

import re

from prometheus_client import Counter, Histogram

_LABEL_SAFE = re.compile(r"[^\w\-.@/]")


def _lbl(s: str, *, max_len: int = 128) -> str:
    v = _LABEL_SAFE.sub("_", (s or "").strip())[:max_len]
    return v or "unknown"


# ─── HTTP (recorded by middleware) ──────────────────────────────────────────

HTTP_REQUESTS = Counter(
    "rag_http_requests_total",
    "HTTP requests grouped by normalized route template, method, and status class.",
    ["method", "path", "status_class"],
)

HTTP_REQUEST_LATENCY = Histogram(
    "rag_http_request_duration_seconds",
    "Latency of HTTP handlers (seconds) by route template and method.",
    ["method", "path"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 15.0, 60.0),
)


# ─── Autopilot ───────────────────────────────────────────────────────────────

AUTOPILOT_BUILDS_ENQUEUED = Counter(
    "rag_autopilot_builds_enqueued_total",
    "Autopilot builds accepted by POST /api/autopilot/build (Celery job enqueued).",
)

AUTOPILOT_BUILDS_TERMINAL = Counter(
    "rag_autopilot_builds_terminal_total",
    "Terminal Autopilot outcomes (worker or API-cancel).",
    ["status"],
)

# ─── Evaluation jobs ───────────────────────────────────────────────────────────

EVALUATION_RUNS_TERMINAL = Counter(
    "rag_evaluation_runs_terminal_total",
    "Terminal Celery-backed evaluation outcomes.",
    ["status"],
)


def observe_http_request(
    *,
    method: str,
    route_template: str,
    status_code: int,
    duration_seconds: float,
) -> None:
    path = _lbl(route_template, max_len=256)
    m = method.upper()
    cls = _status_class(status_code)
    HTTP_REQUESTS.labels(method=m, path=path, status_class=cls).inc()
    HTTP_REQUEST_LATENCY.labels(method=m, path=path).observe(max(0.0, duration_seconds))


def record_autopilot_enqueued() -> None:
    AUTOPILOT_BUILDS_ENQUEUED.inc()


def record_autopilot_terminal(status: str) -> None:
    AUTOPILOT_BUILDS_TERMINAL.labels(status=_lbl(status, max_len=48)).inc()


def record_evaluation_terminal(status: str) -> None:
    EVALUATION_RUNS_TERMINAL.labels(status=_lbl(status, max_len=48)).inc()


def _status_class(code: int) -> str:
    if 200 <= code < 300:
        return "2xx"
    if 300 <= code < 400:
        return "3xx"
    if 400 <= code < 500:
        return "4xx"
    if 500 <= code < 600:
        return "5xx"
    return "other"
