"""Integration tests for ``/api/designer/config*`` (P4-2)."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.schemas.pipeline import PipelineConfigurationSchema

USER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
OTHER = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"


def _minimal_pipeline_payload(temp_id: str = "temp-config-id") -> dict:
    """Valid minimal ``PipelineConfigurationSchema`` as request JSON (alias-friendly)."""
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


@pytest.mark.integration
def test_designer_config_crud(sync_client: TestClient):
    h = {"X-User-ID": USER}
    pr = sync_client.post("/api/projects/", json={"name": "P1"}, headers=h)
    assert pr.status_code == 201
    project_id = pr.json()["id"]

    cfg_body = _minimal_pipeline_payload()
    r = sync_client.post(
        "/api/designer/config",
        json={
            "name": "Pipeline One",
            "projectId": project_id,
            "config": cfg_body,
            "description": "saved via api",
        },
        headers=h,
    )
    assert r.status_code == 201
    created = r.json()
    cid = created["id"]
    assert created["name"] == "Pipeline One"
    assert created["projectId"] == project_id
    assert created["config"]["cloudProvider"] == "aws"

    got = sync_client.get(f"/api/designer/config/{cid}", headers=h)
    assert got.status_code == 200
    assert got.json()["id"] == cid

    up = sync_client.put(
        f"/api/designer/config/{cid}",
        json={"name": "Renamed"},
        headers=h,
    )
    assert up.status_code == 200
    assert up.json()["name"] == "Renamed"

    lst = sync_client.get(
        "/api/designer/configs",
        params={"project_id": project_id},
        headers=h,
    )
    assert lst.status_code == 200
    body = lst.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["name"] == "Renamed"

    dl = sync_client.delete(f"/api/designer/config/{cid}", headers=h)
    assert dl.status_code == 204

    assert sync_client.get(f"/api/designer/config/{cid}", headers=h).status_code == 404


@pytest.mark.integration
def test_designer_config_wrong_project(sync_client: TestClient):
    h = {"X-User-ID": USER}
    r = sync_client.post(
        "/api/designer/config",
        json={
            "name": "orphan",
            "projectId": str(uuid.uuid4()),
            "config": _minimal_pipeline_payload(),
        },
        headers=h,
    )
    assert r.status_code == 404


@pytest.mark.integration
def test_designer_config_user_isolation(sync_client: TestClient):
    h1 = {"X-User-ID": USER}
    h2 = {"X-User-ID": OTHER}
    pid = sync_client.post("/api/projects/", json={"name": "Iso"}, headers=h1).json()["id"]
    cid = sync_client.post(
        "/api/designer/config",
        json={
            "name": "secret",
            "projectId": pid,
            "config": _minimal_pipeline_payload(),
        },
        headers=h1,
    ).json()["id"]

    assert sync_client.get(f"/api/designer/config/{cid}", headers=h2).status_code == 404


@pytest.mark.integration
def test_designer_configs_page_size_cap(sync_client: TestClient):
    cap = get_settings().max_page_size
    pid = str(uuid.uuid4())
    r = sync_client.get(
        "/api/designer/configs",
        params={"project_id": pid, "page_size": cap + 1},
        headers={"X-User-ID": USER},
    )
    assert r.status_code == 400


@pytest.mark.integration
def test_designer_put_requires_field(sync_client: TestClient):
    r = sync_client.put(
        f"/api/designer/config/{uuid.uuid4()}",
        json={},
        headers={"X-User-ID": USER},
    )
    assert r.status_code == 400


@pytest.mark.integration
def test_designer_cost_endpoint(sync_client: TestClient):
    """POST /api/designer/cost mirrors utilities cost using catalog pricing."""
    cfg = _minimal_pipeline_payload()
    r = sync_client.post(
        "/api/designer/cost",
        json={
            "config": cfg,
            "queriesPerMonth": 10_000,
            "documentsCount": 200,
            "avgDocumentTokens": 400,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["currency"] == "USD"
    assert data["total"] >= 0.0
    assert data["breakdown"]
    assert "perQuery" in data
    assert "perMonth" in data
