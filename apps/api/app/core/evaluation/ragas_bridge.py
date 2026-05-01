"""Map pipeline metric names to RAGAS metric objects and build HuggingFace datasets."""

from __future__ import annotations

import importlib
from typing import TYPE_CHECKING

from app.schemas.evaluation import EvaluationMetrics

if TYPE_CHECKING:
    from datasets import Dataset

# Default RAGAS metric set (v0.1.x)
_DEFAULT_METRIC_NAMES = (
    "faithfulness",
    "answer_relevance",
    "context_precision",
    "context_recall",
)

# Pipeline / API names → RAGAS module attribute names (latency is wall-clock only — not RAGAS)
_METRIC_NAME_TO_RAGAS: dict[str, str] = {
    "faithfulness": "faithfulness",
    "answer_relevance": "answer_relevancy",
    "context_precision": "context_precision",
    "context_recall": "context_recall",
}


def resolve_ragas_metric_names(requested: list[str] | None) -> list[str]:
    """Return canonical pipeline metric names (excluding latency) for RAGAS."""
    if not requested:
        return list(_DEFAULT_METRIC_NAMES)
    out: list[str] = []
    for name in requested:
        if name == "latency":
            continue
        if name not in _METRIC_NAME_TO_RAGAS:
            raise ValueError(f"Unknown evaluation metric: {name!r}")
        out.append(name)
    if not out:
        return list(_DEFAULT_METRIC_NAMES)
    return out


def load_ragas_metrics(pipeline_names: list[str]) -> list[object]:
    """Import RAGAS metric singletons for the given pipeline metric names."""
    metrics_mod = importlib.import_module("ragas.metrics")

    _map = {
        "faithfulness": getattr(metrics_mod, "faithfulness"),
        "answer_relevance": getattr(metrics_mod, "answer_relevancy"),
        "context_precision": getattr(metrics_mod, "context_precision"),
        "context_recall": getattr(metrics_mod, "context_recall"),
    }
    return [_map[n] for n in pipeline_names]


def build_dataset(
    *,
    questions: list[str],
    answers: list[str],
    contexts: list[list[str]],
    ground_truths: list[str],
) -> Dataset:
    """Build a RAGAS-compatible ``Dataset`` (column names match RAGAS defaults)."""
    from datasets import Dataset as HFDataset

    if not (len(questions) == len(answers) == len(contexts) == len(ground_truths)):
        raise ValueError("questions, answers, contexts, ground_truths must have equal length")
    # Ensure each context list is non-empty for downstream metrics
    safe_ctx: list[list[str]] = []
    for row in contexts:
        if not row:
            safe_ctx.append(["(no context retrieved)"])
        else:
            safe_ctx.append(row)
    return HFDataset.from_dict(
        {
            "question": questions,
            "answer": answers,
            "contexts": safe_ctx,
            "ground_truth": ground_truths,
        }
    )


def ragas_dict_to_evaluation_metrics(
    result_dict: dict[str, float | int],
    *,
    avg_latency_ms: float | None = None,
    cost_per_query: float | None = None,
) -> EvaluationMetrics:
    """Map RAGAS aggregate keys (e.g. ``answer_relevancy``) to API ``EvaluationMetrics``."""
    from math import isnan

    def _f(key_ragas: str) -> float:
        raw = result_dict.get(key_ragas, 0.0)
        try:
            v = float(raw)
        except (TypeError, ValueError):
            return 0.0
        if isnan(v):
            return 0.0
        return max(0.0, min(1.0, v))

    return EvaluationMetrics(
        faithfulness=_f("faithfulness"),
        answer_relevance=_f("answer_relevancy"),
        context_precision=_f("context_precision"),
        context_recall=_f("context_recall"),
        avg_latency_ms=avg_latency_ms,
        cost_per_query=cost_per_query,
    )
