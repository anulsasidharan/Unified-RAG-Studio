"""Integration tests for ``/api/deployment/*`` (P8-4)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
import pytest

from app.schemas.pipeline import PipelineConfigurationSchema
from app.worker import tasks

USER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"


def _minimal_pipeline_payload(temp_id: str = "temp-config-id") -> dict:
    raw = {
        "id": temp_id,
        "name": "Minimal",
        "description": "test configuration",
        "cloud_provider": "aws",
        "stages": {
            "chunking": {
                "strategy": "recursive-character",
                "chunk_size": 512,
                "chunk_overlap": 50,
            },
            "embedding": {
                "model": "text-embedding-3-small",
                "provider": "openai",
                "dimensions": 1536,
            },
            "vector_store": {
                "provider": "qdrant",
                "index_name": "test-index",
            },
            "retrieval": {
                "strategy": "similarity",
                "top_k": 5,
            },
            "generation": {
                "model": "gpt-4o-mini",
                "provider": "openai",
                "temperature": 0.7,
                "max_tokens": 1024,
            },
        },
        "metadata": {
            "created_at": "2026-01-01T00:00:00+00:00",
            "version": "1.0.0",
            "source": "designer",
        },
    }
    PipelineConfigurationSchema.model_validate(raw)
    return raw


def _fake_delay_run_worker(did: str) -> MagicMock:
    """Invoke the sync stub task so SQLite sees ``deployed`` before status GET."""

    tasks.run_deployment.run(did)
    m = MagicMock()
    m.id = "inline-worker"
    return m


@pytest.mark.integration
def test_deployment_trigger_status_list_teardown(sync_client: TestClient):
    h = {"X-User-ID": USER}
    pr = sync_client.post("/api/projects", json={"name": "DeployProj"}, headers=h)
    assert pr.status_code == 201
    project_id = pr.json()["id"]

    cfg_body = _minimal_pipeline_payload()
    cr = sync_client.post(
        "/api/designer/config",
        json={
            "name": "Pipe",
            "projectId": project_id,
            "config": cfg_body,
        },
        headers=h,
    )
    assert cr.status_code == 201
    config_id = cr.json()["id"]

    with patch.object(tasks.run_deployment, "delay", side_effect=_fake_delay_run_worker):
        dep = sync_client.post(
            "/api/deployment/deploy",
            json={
                "config_id": config_id,
                "provider": "docker",
                "environment": "staging",
                "region": "us-east-1",
            },
            headers=h,
        )
    assert dep.status_code == 201
    body = dep.json()
    assert body["status"] == "deploying"
    did = body["deploymentId"]
    assert body["configId"] == config_id

    st = sync_client.get(f"/api/deployment/{did}/status", headers=h)
    assert st.status_code == 200
    assert st.json()["status"] == "deployed"
    assert "stub.rag-studio.local" in (st.json().get("endpoint") or "")

    lst = sync_client.get(
        "/api/deployment/deployments",
        params={"project_id": project_id},
        headers=h,
    )
    assert lst.status_code == 200
    lj = lst.json()
    assert lj["total"] == 1
    assert len(lj["items"]) == 1

    td = sync_client.delete(f"/api/deployment/{did}", headers=h)
    assert td.status_code == 200
    assert td.json()["status"] == "teardown"

    st2 = sync_client.get(f"/api/deployment/{did}/status", headers=h)
    assert st2.json()["status"] == "teardown"


@pytest.mark.integration
def test_deployment_404_wrong_user(sync_client: TestClient):
    h1 = {"X-User-ID": USER}
    other = "dddddddd-dddd-4ddd-addd-dddddddddddd"
    pr = sync_client.post("/api/projects", json={"name": "Iso"}, headers=h1)
    project_id = pr.json()["id"]
    cr = sync_client.post(
        "/api/designer/config",
        json={
            "name": "P",
            "projectId": project_id,
            "config": _minimal_pipeline_payload(),
        },
        headers=h1,
    )
    config_id = cr.json()["id"]

    with patch.object(tasks.run_deployment, "delay", side_effect=_fake_delay_run_worker):
        dep = sync_client.post(
            "/api/deployment/deploy",
            json={"config_id": config_id, "provider": "kubernetes", "environment": "production"},
            headers=h1,
        )
    did = dep.json()["deploymentId"]

    assert (
        sync_client.get(f"/api/deployment/{did}/status", headers={"X-User-ID": other}).status_code
        == 404
    )
