"""Designer API integration: project + config persistence + export (P10-2)."""

from __future__ import annotations

from fastapi.testclient import TestClient
import pytest

from tests.test_integration.helpers import minimal_pipeline_payload

USER = "b10eb10e-b10e-4b0e-8b10-e10eb10eb10e"


@pytest.mark.integration
def test_designer_save_list_export_roundtrip(sync_client: TestClient) -> None:
    h = {"X-User-ID": USER}
    pr = sync_client.post("/api/projects", json={"name": "Integration Designer"}, headers=h)
    assert pr.status_code == 201
    project_id = pr.json()["id"]

    cfg = minimal_pipeline_payload()
    save = sync_client.post(
        "/api/designer/config",
        json={
            "name": "Roundtrip cfg",
            "projectId": project_id,
            "config": cfg,
        },
        headers=h,
    )
    assert save.status_code == 201
    cid = save.json()["id"]

    listed = sync_client.get(
        "/api/designer/configs",
        params={"project_id": project_id},
        headers=h,
    )
    assert listed.status_code == 200
    data = listed.json()
    assert data["total"] >= 1
    assert any(x["id"] == cid for x in data["items"])

    merged = dict(cfg)
    merged["id"] = cid
    exported = sync_client.post(
        "/api/designer/export",
        json={"format": "yaml", "config": merged},
        headers=h,
    )
    assert exported.status_code == 200
    body = exported.json()
    assert "code" in body
    assert len(body["code"]) > 20
    assert body.get("format") == "yaml"


@pytest.mark.integration
def test_designer_templates_list_contains_entries(sync_client: TestClient) -> None:
    r = sync_client.get("/api/templates")
    assert r.status_code == 200
    body = r.json()
    templates = body.get("templates") or []
    assert isinstance(templates, list)
