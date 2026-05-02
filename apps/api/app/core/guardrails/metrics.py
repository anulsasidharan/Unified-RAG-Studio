"""Prometheus metrics and snapshots for guardrail runs — P4.5-6."""

from __future__ import annotations

import re
from typing import Any

from prometheus_client import REGISTRY, Counter, Histogram

from .types import GuardrailStage

_LABEL_SAFE = re.compile(r"[^\w\-.@/]")


def _label(s: str, *, max_len: int = 128) -> str:
    """Sanitize user-influenced strings used as Prometheus label values."""
    t = _LABEL_SAFE.sub("_", (s or "").strip())[:max_len]
    return t or "unknown"


# ─── Prometheus instruments (default REGISTRY) ─────────────────────────────

GUARDRAIL_CHECKS = Counter(
    "rag_guardrail_checks_total",
    "Individual guardrail check() outcomes by stage, guardrail name, and action.",
    ["stage", "guardrail", "action"],
)

GUARDRAIL_STAGE_RESULTS = Counter(
    "rag_guardrail_stage_results_total",
    "Per invocation of run_stage: whether the stage ended allowed or blocked.",
    ["stage", "outcome"],
)

GUARDRAIL_CHECK_DURATION = Histogram(
    "rag_guardrail_check_duration_seconds",
    "Wall time spent inside a single guardrail check() call.",
    ["stage", "guardrail"],
    buckets=(0.000_5, 0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)

GUARDRAIL_RAG_RUNS = Counter(
    "rag_guardrail_rag_runs_total",
    "End-to-end guarded RAG pipeline outcomes (run_guarded_rag_query).",
    ["outcome"],
)


def record_guardrail_check(
    stage: GuardrailStage,
    guardrail_name: str,
    action: str,
    *,
    duration_seconds: float,
) -> None:
    """Record one check result and latency."""
    g = _label(guardrail_name)
    a = _label(action, max_len=32)
    GUARDRAIL_CHECKS.labels(stage=stage.value, guardrail=g, action=a).inc()
    GUARDRAIL_CHECK_DURATION.labels(stage=stage.value, guardrail=g).observe(
        max(0.0, duration_seconds)
    )


def record_stage_result(stage: GuardrailStage, *, allowed: bool) -> None:
    """Record whether a full stage run finished open or blocked."""
    outcome = "allowed" if allowed else "blocked"
    GUARDRAIL_STAGE_RESULTS.labels(stage=stage.value, outcome=outcome).inc()


def record_guarded_rag_outcome(outcome: str) -> None:
    """Record a guarded RAG pipeline terminal outcome (bounded vocabulary)."""
    GUARDRAIL_RAG_RUNS.labels(outcome=_label(outcome, max_len=48)).inc()


def collect_guardrail_metric_samples(*, prefix: str = "rag_guardrail") -> list[dict[str, Any]]:
    """Return flat samples from the default registry for dashboard / JSON APIs."""
    rows: list[dict[str, Any]] = []
    for metric in REGISTRY.collect():
        name = getattr(metric, "name", "") or ""
        if not name.startswith(prefix):
            continue
        for sample in metric.samples:
            rows.append(
                {
                    "name": sample.name,
                    "labels": dict(sample.labels),
                    "value": float(sample.value),
                }
            )
    return rows
