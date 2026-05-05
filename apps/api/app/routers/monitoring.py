"""Prometheus scrape and JSON snapshots for guardrail metrics — P4.5-6."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.config import Settings, get_settings
from app.core.guardrails.metrics import collect_guardrail_metric_samples
from app.observability.registry import collect_metric_samples

router = APIRouter(tags=["monitoring"])


def _require_metrics(settings: Settings) -> None:
    if not settings.prometheus_metrics_enabled:
        raise HTTPException(status_code=404, detail="Prometheus metrics are disabled")


@router.get(
    "/metrics",
    summary="Prometheus scrape endpoint",
)
async def prometheus_metrics(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    """OpenMetrics text for all registered collectors (includes ``rag_guardrail_*``)."""
    _require_metrics(settings)
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@router.get(
    "/monitoring/guardrails",
    summary="Guardrail metrics snapshot (JSON)",
)
async def guardrails_metrics_json(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    """Flat list of ``rag_guardrail_*`` samples for lightweight dashboards or debugging."""
    _require_metrics(settings)
    return {
        "metrics": collect_guardrail_metric_samples(),
    }


@router.get(
    "/monitoring/rag",
    summary="All RAG Studio Prometheus metrics (JSON)",
)
async def rag_metrics_snapshot(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    """Flat snapshot of every series whose Collector name begins with ``rag_``."""
    _require_metrics(settings)
    return {
        "metrics": collect_metric_samples(prefixes=("rag_",)),
    }
