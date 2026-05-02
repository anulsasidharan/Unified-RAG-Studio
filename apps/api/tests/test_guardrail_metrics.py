"""P4.5-6 — Prometheus metrics for guardrail runs and monitoring routes."""

from __future__ import annotations

import os

from fastapi.testclient import TestClient

from app.config import get_settings
from app.core.guardrails import (
    AlwaysAllowGuardrail,
    BlockIfSubstringGuardrail,
    GuardrailManager,
    GuardrailStage,
)
from app.core.guardrails.metrics import collect_guardrail_metric_samples
from app.main import app


def _sum_samples(samples: list[dict], name_substr: str, **labels: str) -> float:
    total = 0.0
    for row in samples:
        if name_substr not in row["name"]:
            continue
        if all(row["labels"].get(k) == v for k, v in labels.items()):
            total += row["value"]
    return total


def test_run_stage_emits_check_and_stage_metrics() -> None:
    m = GuardrailManager()
    m.register(AlwaysAllowGuardrail(GuardrailStage.INPUT))
    before = collect_guardrail_metric_samples()
    m.run_stage(GuardrailStage.INPUT, "hello")
    after = collect_guardrail_metric_samples()

    delta_checks = _sum_samples(after, "rag_guardrail_checks", stage="input") - _sum_samples(
        before, "rag_guardrail_checks", stage="input"
    )
    assert delta_checks >= 1.0

    delta_stage = _sum_samples(
        after, "rag_guardrail_stage_results", stage="input", outcome="allowed"
    ) - _sum_samples(
        before, "rag_guardrail_stage_results", stage="input", outcome="allowed"
    )
    assert delta_stage >= 1.0


def test_run_stage_block_emits_blocked_stage_result() -> None:
    m = GuardrailManager()
    m.register(BlockIfSubstringGuardrail(GuardrailStage.INPUT, "STOP"))
    before = collect_guardrail_metric_samples()
    m.run_stage(GuardrailStage.INPUT, "please STOP")
    after = collect_guardrail_metric_samples()

    delta_blocked = _sum_samples(
        after, "rag_guardrail_stage_results", stage="input", outcome="blocked"
    ) - _sum_samples(
        before, "rag_guardrail_stage_results", stage="input", outcome="blocked"
    )
    assert delta_blocked >= 1.0


def test_metrics_endpoint_returns_prometheus_text(sync_client: TestClient) -> None:
    r = sync_client.get("/metrics")
    assert r.status_code == 200
    body = r.text
    assert "rag_guardrail_checks_total" in body
    assert "rag_guardrail_stage_results_total" in body


def test_guardrails_json_snapshot(sync_client: TestClient) -> None:
    r = sync_client.get("/monitoring/guardrails")
    assert r.status_code == 200
    data = r.json()
    assert "metrics" in data
    assert isinstance(data["metrics"], list)


def test_metrics_disabled_returns_404() -> None:
    try:
        os.environ["PROMETHEUS_METRICS_ENABLED"] = "false"
        get_settings.cache_clear()
        assert get_settings().prometheus_metrics_enabled is False

        with TestClient(app) as client:
            assert client.get("/metrics").status_code == 404
            assert client.get("/monitoring/guardrails").status_code == 404
    finally:
        os.environ.pop("PROMETHEUS_METRICS_ENABLED", None)
        get_settings.cache_clear()
