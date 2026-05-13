"""A/B metric comparison for two ``EvaluationMetrics`` rows (P2-7)."""

from __future__ import annotations

from typing import Literal

from app.schemas.evaluation import EvaluationMetrics, MetricDelta

_NUMERIC_FIELDS = (
    "faithfulness",
    "answer_relevance",
    "context_precision",
    "context_recall",
)


def compare_metrics(
    metrics_a: EvaluationMetrics,
    metrics_b: EvaluationMetrics,
    *,
    epsilon: float = 1e-6,
) -> tuple[list[MetricDelta], Literal["a", "b", "tie"]]:
    """Return per-metric deltas and an overall winner using a simple score tally."""
    deltas: list[MetricDelta] = []
    score_a = 0
    score_b = 0

    for field in _NUMERIC_FIELDS:
        va = getattr(metrics_a, field)
        vb = getattr(metrics_b, field)
        delta = vb - va
        if abs(delta) <= epsilon:
            winner: Literal["a", "b", "tie"] = "tie"
        elif va > vb:
            winner = "a"
            score_a += 1
        else:
            winner = "b"
            score_b += 1
        deltas.append(MetricDelta(metric=field, value_a=va, value_b=vb, delta=delta, winner=winner))

    la = metrics_a.avg_latency_ms
    lb = metrics_b.avg_latency_ms
    if la is not None and lb is not None:
        delta = lb - la
        if abs(delta) <= epsilon:
            lw: Literal["a", "b", "tie"] = "tie"
        elif la < lb:
            lw = "a"
            score_a += 1
        else:
            lw = "b"
            score_b += 1
        deltas.append(
            MetricDelta(
                metric="avg_latency_ms",
                value_a=la,
                value_b=lb,
                delta=delta,
                winner=lw,
            )
        )

    if score_a > score_b:
        overall: Literal["a", "b", "tie"] = "a"
    elif score_b > score_a:
        overall = "b"
    else:
        overall = "tie"

    return deltas, overall
