"""Evaluation API integration: persisted runs + compare (RAG engine mocked; P10-2)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
import pytest

from app.core.evaluation.service import EvaluationEngine
from app.core.evaluation.strategies import EvaluationEngineResult, EvaluationExample
from app.schemas.evaluation import EvaluationMetrics
from tests.test_integration.helpers import minimal_pipeline_payload

USER = "deadbeef-dead-beef-dead-beefdeadbeef"


def _ten_row_test_set() -> list[dict[str, object]]:
    text = (
        "RAG Studio evaluates pipelines using faithfulness and answer relevance scores. "
        "Retrieval quality drives context precision in production workloads."
    )
    rows: list[dict[str, object]] = []
    for i in range(10):
        rows.append(
            {
                "question": f"What is described in scenario segment {i + 1}?",
                "groundTruth": text,
                "context": None,
            }
        )
    return rows


async def _stub_entry(pipeline, entry):  # noqa: ARG001
    return EvaluationExample(
        question=entry.question,
        answer="Synthetic answer from integration stub.",
        contexts=[entry.ground_truth[:200]],
        ground_truth=entry.ground_truth,
    )


def _stub_engine_result() -> EvaluationEngineResult:
    return EvaluationEngineResult(
        metrics=EvaluationMetrics(
            faithfulness=0.92,
            answer_relevance=0.87,
            context_precision=0.82,
            context_recall=0.78,
            avg_latency_ms=4.2,
            cost_per_query=None,
        ),
        failure_analysis=None,
        per_row_scores=[],
    )


def _create_saved_config(client: TestClient, project_id: str, name: str) -> str:
    body = minimal_pipeline_payload()
    r = client.post(
        "/api/designer/config",
        json={"name": name, "projectId": project_id, "config": body},
        headers={"X-User-ID": USER},
    )
    assert r.status_code == 201
    return r.json()["id"]


@pytest.mark.integration
def test_evaluation_run_list_and_get_roundtrip(sync_client: TestClient) -> None:
    h = {"X-User-ID": USER}
    pid = sync_client.post("/api/projects", json={"name": "Eval integration"}, headers=h).json()[
        "id"
    ]
    cid = _create_saved_config(sync_client, pid, "eval-target")

    eng = _stub_engine_result()
    with (
        patch("app.services.evaluation_service._entry_to_example", side_effect=_stub_entry),
        patch.object(EvaluationEngine, "evaluate_async", new_callable=AsyncMock, return_value=eng),
    ):
        run = sync_client.post(
            "/api/evaluation/run",
            json={"configId": cid, "testSet": _ten_row_test_set()},
            headers=h,
        )
    assert run.status_code == 200, run.text
    payload = run.json()
    assert payload["status"] == "complete"
    assert payload["metrics"]["faithfulness"] == 0.92
    rid = payload["runId"]

    got = sync_client.get(f"/api/evaluation/run/{rid}", headers=h)
    assert got.status_code == 200
    assert got.json()["runId"] == rid

    lst = sync_client.get("/api/evaluation/runs", params={"config_id": cid}, headers=h)
    assert lst.status_code == 200
    listed = lst.json()
    assert listed["total"] >= 1
    assert any(x["runId"] == rid for x in listed["items"])


@pytest.mark.integration
def test_evaluation_compare_uses_prior_runs(sync_client: TestClient) -> None:
    h = {"X-User-ID": USER}
    pid = sync_client.post("/api/projects", json={"name": "Compare integration"}, headers=h).json()[
        "id"
    ]
    cid_a = _create_saved_config(sync_client, pid, "compare-a")

    cfg_b = minimal_pipeline_payload()
    cfg_b["stages"]["chunking"]["chunk_size"] = 256
    save_b = sync_client.post(
        "/api/designer/config",
        json={"name": "compare-b", "projectId": pid, "config": cfg_b},
        headers=h,
    )
    assert save_b.status_code == 201
    cid_b = save_b.json()["id"]

    eng_a = EvaluationEngineResult(
        metrics=EvaluationMetrics(
            faithfulness=0.80,
            answer_relevance=0.75,
            context_precision=0.70,
            context_recall=0.65,
            avg_latency_ms=10.0,
            cost_per_query=None,
        ),
        failure_analysis=None,
        per_row_scores=[],
    )
    eng_b = EvaluationEngineResult(
        metrics=EvaluationMetrics(
            faithfulness=0.85,
            answer_relevance=0.76,
            context_precision=0.71,
            context_recall=0.66,
            avg_latency_ms=11.0,
            cost_per_query=None,
        ),
        failure_analysis=None,
        per_row_scores=[],
    )

    ts = _ten_row_test_set()
    with patch("app.services.evaluation_service._entry_to_example", side_effect=_stub_entry):
        with patch.object(EvaluationEngine, "evaluate_async", new_callable=AsyncMock) as mock_eval:
            mock_eval.side_effect = [eng_a, eng_b]

            ra = sync_client.post(
                "/api/evaluation/run",
                json={"configId": cid_a, "testSet": ts},
                headers=h,
            )
            assert ra.status_code == 200
            run_a = ra.json()["runId"]

            rb = sync_client.post(
                "/api/evaluation/run",
                json={"configId": cid_b, "testSet": ts},
                headers=h,
            )
            assert rb.status_code == 200
            run_b = rb.json()["runId"]

    cmp_body = {
        "configIdA": cid_a,
        "configIdB": cid_b,
        "runIdA": run_a,
        "runIdB": run_b,
    }
    cmp = sync_client.post("/api/evaluation/compare", json=cmp_body, headers=h)
    assert cmp.status_code == 200, cmp.text
    out = cmp.json()
    assert out["configIdA"] == cid_a
    assert out["configIdB"] == cid_b
    assert out["metricsA"]["faithfulness"] == 0.80
    assert out["metricsB"]["faithfulness"] == 0.85
    assert isinstance(out["deltas"], list)
