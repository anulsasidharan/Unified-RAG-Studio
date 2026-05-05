"""Introspection helpers for Prometheus multi-exporter payloads."""

from __future__ import annotations

from typing import Any

from prometheus_client import REGISTRY


def collect_metric_samples(*, prefixes: tuple[str, ...] = ("rag_",)) -> list[dict[str, Any]]:
    """Return flat samples matching any of the metric name prefixes."""

    rows: list[dict[str, Any]] = []
    for metric in REGISTRY.collect():
        name = getattr(metric, "name", "") or ""
        if not any(name.startswith(p) for p in prefixes):
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
