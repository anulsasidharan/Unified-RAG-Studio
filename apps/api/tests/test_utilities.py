"""Tests for P2-9 utilities (info, validation, cost)."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_REPO_ROOT = Path(__file__).resolve().parents[3]


def _faq_template_pipeline() -> dict:
    templates_path = _REPO_ROOT / "data" / "templates.json"
    blob = json.loads(templates_path.read_text(encoding="utf-8"))
    return blob["templates"][0]["config"]


@pytest.mark.unit
def test_utilities_info(sync_client: TestClient):
    r = sync_client.get("/api/utilities/info")
    assert r.status_code == 200
    data = r.json()
    assert data["service"] == "rag-studio-api"
    assert data["environment"] == "test"
    assert "pythonVersion" in data


@pytest.mark.unit
def test_validate_pipeline_valid(sync_client: TestClient):
    body = _faq_template_pipeline()
    r = sync_client.post("/api/utilities/validate-pipeline", json=body)
    assert r.status_code == 200
    payload = r.json()
    assert payload["valid"] is True
    assert payload["errors"] == []


@pytest.mark.unit
def test_validate_pipeline_invalid(sync_client: TestClient):
    r = sync_client.post("/api/utilities/validate-pipeline", json={"id": "only-id"})
    assert r.status_code == 200
    payload = r.json()
    assert payload["valid"] is False
    assert isinstance(payload["errors"], list)
    assert len(payload["errors"]) >= 1


@pytest.mark.unit
def test_cost_estimate(sync_client: TestClient):
    cfg = _faq_template_pipeline()
    r = sync_client.post(
        "/api/utilities/cost",
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
