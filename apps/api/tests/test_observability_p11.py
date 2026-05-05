"""Phase 11 — structured logging context, Prometheus app metrics, analytics API."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.observability.registry import collect_metric_samples


def test_metrics_expose_rag_http_series(sync_client: TestClient) -> None:
    sync_client.get("/health")
    txt = sync_client.get("/metrics").text
    assert "rag_http_requests_total" in txt


def test_monitoring_rag_json_snapshot(sync_client: TestClient) -> None:
    sync_client.get("/health")
    r = sync_client.get("/monitoring/rag")
    assert r.status_code == 200
    names = {row["name"] for row in r.json()["metrics"]}
    assert any(n.startswith("rag_http_requests") or n.endswith("_total") for n in names)


def test_analytics_summary_shape(sync_client: TestClient) -> None:
    h = {"X-User-ID": "00000000-0000-4000-8000-000000000001"}
    r = sync_client.get("/api/analytics/summary", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert "projects" in body
    assert "pipeline_configs" in body
    assert "autopilot_builds" in body and "counts" in body["autopilot_builds"]
    assert "cost_signals" in body


def test_x_correlation_id_echoed(sync_client: TestClient) -> None:
    r = sync_client.get("/health", headers={"X-Correlation-ID": "corr-test-1"})
    assert r.headers.get("x-correlation-id") == "corr-test-1"


def test_collect_metric_samples_filters_prefix(sync_client: TestClient) -> None:
    sync_client.get("/health")
    rows = collect_metric_samples(prefixes=("rag_http",))
    assert any("rag_http" in row["name"] for row in rows)
