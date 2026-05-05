"""Unit tests for ``/api/evaluation/*`` HTTP routes (P8-3 / P10-1)."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.schemas.evaluation import (
    CompareConfigsResponse,
    EvaluationMetrics,
    EvaluationRunListResponse,
    EvaluationRunResponse,
    MetricDelta,
)

USER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"


def _sample_metrics() -> EvaluationMetrics:
    return EvaluationMetrics(
        faithfulness=0.9,
        answer_relevance=0.85,
        context_precision=0.8,
        context_recall=0.75,
    )


def _sample_run_response(config_id: str) -> EvaluationRunResponse:
    return EvaluationRunResponse(
        run_id=str(uuid.uuid4()),
        config_id=config_id,
        status="complete",
        metrics=_sample_metrics(),
        failure_analysis=None,
        test_set_size=10,
        created_at="2026-01-01T00:00:00+00:00",
        completed_at="2026-01-01T00:01:00+00:00",
        error=None,
    )


@pytest.mark.unit
def test_post_run_returns_404_when_service_returns_none(sync_client: TestClient) -> None:
    cfg = str(uuid.uuid4())
    with patch(
        "app.routers.evaluation.EvaluationService.run_evaluation",
        new_callable=AsyncMock,
        return_value=None,
    ):
        r = sync_client.post(
            "/api/evaluation/run",
            json={"config_id": cfg},
            headers={"X-User-ID": USER},
        )
    assert r.status_code == 404


@pytest.mark.unit
def test_post_run_returns_400_on_value_error(sync_client: TestClient) -> None:
    with patch(
        "app.routers.evaluation.EvaluationService.run_evaluation",
        new_callable=AsyncMock,
        side_effect=ValueError("bad request"),
    ):
        r = sync_client.post(
            "/api/evaluation/run",
            json={"config_id": str(uuid.uuid4())},
            headers={"X-User-ID": USER},
        )
    assert r.status_code == 400
    assert r.json()["detail"] == "bad request"


@pytest.mark.unit
def test_post_run_success(sync_client: TestClient) -> None:
    cfg = str(uuid.uuid4())
    body = _sample_run_response(cfg)
    with patch(
        "app.routers.evaluation.EvaluationService.run_evaluation",
        new_callable=AsyncMock,
        return_value=body,
    ):
        r = sync_client.post(
            "/api/evaluation/run",
            json={"config_id": cfg},
            headers={"X-User-ID": USER},
        )
    assert r.status_code == 200
    j = r.json()
    assert j["configId"] == cfg
    assert j["status"] == "complete"
    assert j["metrics"]["faithfulness"] == 0.9


@pytest.mark.unit
def test_get_run_404(sync_client: TestClient) -> None:
    with patch(
        "app.routers.evaluation.EvaluationService.get_run",
        new_callable=AsyncMock,
        return_value=None,
    ):
        r = sync_client.get(
            f"/api/evaluation/run/{uuid.uuid4()}",
            headers={"X-User-ID": USER},
        )
    assert r.status_code == 404


@pytest.mark.unit
def test_get_run_success(sync_client: TestClient) -> None:
    cfg = str(uuid.uuid4())
    body = _sample_run_response(cfg)
    with patch(
        "app.routers.evaluation.EvaluationService.get_run",
        new_callable=AsyncMock,
        return_value=body,
    ):
        r = sync_client.get(
            f"/api/evaluation/run/{body.run_id}",
            headers={"X-User-ID": USER},
        )
    assert r.status_code == 200
    assert r.json()["runId"] == body.run_id


@pytest.mark.unit
def test_list_runs_404(sync_client: TestClient) -> None:
    with patch(
        "app.routers.evaluation.EvaluationService.list_runs",
        new_callable=AsyncMock,
        return_value=None,
    ):
        r = sync_client.get(
            "/api/evaluation/runs",
            params={"config_id": str(uuid.uuid4())},
            headers={"X-User-ID": USER},
        )
    assert r.status_code == 404


@pytest.mark.unit
def test_list_runs_success(sync_client: TestClient) -> None:
    cfg = str(uuid.uuid4())
    item = _sample_run_response(cfg)
    lst = EvaluationRunListResponse(items=[item], total=1)
    with patch(
        "app.routers.evaluation.EvaluationService.list_runs",
        new_callable=AsyncMock,
        return_value=lst,
    ):
        r = sync_client.get(
            "/api/evaluation/runs",
            params={"config_id": cfg},
            headers={"X-User-ID": USER},
        )
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1


@pytest.mark.unit
def test_compare_400_value_error(sync_client: TestClient) -> None:
    with patch(
        "app.routers.evaluation.EvaluationService.compare",
        new_callable=AsyncMock,
        side_effect=ValueError("mismatched runs"),
    ):
        r = sync_client.post(
            "/api/evaluation/compare",
            json={
                "config_id_a": str(uuid.uuid4()),
                "config_id_b": str(uuid.uuid4()),
            },
            headers={"X-User-ID": USER},
        )
    assert r.status_code == 400
    assert r.json()["detail"] == "mismatched runs"


@pytest.mark.unit
def test_compare_404(sync_client: TestClient) -> None:
    with patch(
        "app.routers.evaluation.EvaluationService.compare",
        new_callable=AsyncMock,
        return_value=None,
    ):
        r = sync_client.post(
            "/api/evaluation/compare",
            json={
                "config_id_a": str(uuid.uuid4()),
                "config_id_b": str(uuid.uuid4()),
            },
            headers={"X-User-ID": USER},
        )
    assert r.status_code == 404


@pytest.mark.unit
def test_compare_success(sync_client: TestClient) -> None:
    id_a, id_b = str(uuid.uuid4()), str(uuid.uuid4())
    m_a = _sample_metrics()
    m_b = _sample_metrics()
    m_b.answer_relevance = 0.7
    resp = CompareConfigsResponse(
        config_id_a=id_a,
        config_id_b=id_b,
        metrics_a=m_a,
        metrics_b=m_b,
        deltas=[
            MetricDelta(
                metric="answer_relevance",
                value_a=m_a.answer_relevance,
                value_b=m_b.answer_relevance,
                delta=m_a.answer_relevance - m_b.answer_relevance,
                winner="a",
            )
        ],
        overall_winner="a",
        summary="Overall winner: configuration A.",
    )
    with patch(
        "app.routers.evaluation.EvaluationService.compare",
        new_callable=AsyncMock,
        return_value=resp,
    ):
        r = sync_client.post(
            "/api/evaluation/compare",
            json={"config_id_a": id_a, "config_id_b": id_b},
            headers={"X-User-ID": USER},
        )
    assert r.status_code == 200
    j = r.json()
    assert j["overallWinner"] == "a"
    assert j["configIdA"] == id_a
