"""Integration tests for ``POST /api/designer/export`` (P4-4)."""

from __future__ import annotations

from fastapi.testclient import TestClient
import pytest

from app.schemas.pipeline import PipelineConfigurationSchema

FORMATS = ("python", "yaml", "terraform", "docker-compose", "k8s")


def _minimal_pipeline_payload(temp_id: str = "temp-export-id") -> dict:
    """Valid minimal ``PipelineConfigurationSchema`` (alias-friendly JSON)."""
    raw = {
        "id": temp_id,
        "name": "Export Test Pipeline",
        "description": "export integration test",
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
@pytest.mark.parametrize("fmt", FORMATS)
def test_export_all_formats(sync_client: TestClient, fmt: str):
    body = {"config": _minimal_pipeline_payload(), "format": fmt}
    r = sync_client.post("/api/designer/export", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "code" in data
    assert len(data["code"]) > 50
    assert "filename" in data
    assert data["filename"]
    assert data["format"] == fmt
    # API JSON uses camelCase aliases from ``RAGBaseModel``
    ct = data.get("contentType") or data.get("content_type")
    assert ct


@pytest.mark.integration
def test_export_python_contains_lcel(sync_client: TestClient):
    body = {"config": _minimal_pipeline_payload(), "format": "python"}
    r = sync_client.post("/api/designer/export", json=body)
    assert r.status_code == 200
    code = r.json()["code"]
    assert "RunnableParallel" in code
    assert "QdrantVectorStore" in code or "vector_store" in code


@pytest.mark.integration
def test_export_terraform_aws(sync_client: TestClient):
    body = {"config": _minimal_pipeline_payload(), "format": "terraform"}
    r = sync_client.post("/api/designer/export", json=body)
    assert r.status_code == 200
    assert 'provider "aws"' in r.json()["code"]


@pytest.mark.integration
def test_export_docker_compose_has_services(sync_client: TestClient):
    body = {"config": _minimal_pipeline_payload(), "format": "docker-compose"}
    r = sync_client.post("/api/designer/export", json=body)
    assert r.status_code == 200
    yml = r.json()["code"]
    assert "services:" in yml
    assert "vector-db:" in yml


@pytest.mark.integration
def test_export_k8s_multi_doc(sync_client: TestClient):
    body = {"config": _minimal_pipeline_payload(), "format": "k8s"}
    r = sync_client.post("/api/designer/export", json=body)
    assert r.status_code == 200
    yml = r.json()["code"]
    assert "---" in yml
    assert "kind: Deployment" in yml
