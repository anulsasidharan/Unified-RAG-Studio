"""Map pipeline evaluation config to metric name lists (P2-7)."""

from __future__ import annotations

from app.schemas.pipeline import EvaluationConfigSchema


def metric_names_from_pipeline(cfg: EvaluationConfigSchema | None) -> list[str] | None:
    """Return requested metric names, or ``None`` to use engine defaults (all RAGAS core metrics)."""  # noqa: E501
    if cfg is None or not cfg.enabled:
        return None
    if cfg.metrics:
        return list(cfg.metrics)
    return None
