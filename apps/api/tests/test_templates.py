"""Integration tests for ``/api/templates`` (P4-5)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

USER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"


@pytest.mark.integration
def test_templates_list_and_get(sync_client: TestClient):
    r = sync_client.get("/api/templates")
    assert r.status_code == 200
    data = r.json()
    assert data["version"] == "1.0.0"
    assert len(data["templates"]) >= 1
    first_id = data["templates"][0]["id"]

    one = sync_client.get(f"/api/templates/{first_id}")
    assert one.status_code == 200
    assert one.json()["id"] == first_id
    assert "config" in one.json()


@pytest.mark.integration
def test_templates_get_unknown(sync_client: TestClient):
    r = sync_client.get("/api/templates/nonexistent-template-id-xyz")
    assert r.status_code == 404


@pytest.mark.integration
def test_apply_template_creates_config(sync_client: TestClient):
    h = {"X-User-ID": USER}
    pr = sync_client.post("/api/projects/", json={"name": "TplProj"}, headers=h)
    assert pr.status_code == 201
    project_id = pr.json()["id"]

    r = sync_client.post(
        f"/api/templates/faq-chatbot/apply",
        json={"projectId": project_id, "name": "From FAQ Template"},
        headers=h,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["templateId"] == "faq-chatbot"
    assert body["name"] == "From FAQ Template"
    assert body["projectId"] == project_id
    assert body["config"]["metadata"]["source"] == "template"

    cid = body["id"]
    got = sync_client.get(f"/api/designer/config/{cid}", headers=h)
    assert got.status_code == 200
    assert got.json()["name"] == "From FAQ Template"


@pytest.mark.integration
def test_apply_template_unknown(sync_client: TestClient):
    h = {"X-User-ID": USER}
    pr = sync_client.post("/api/projects/", json={"name": "Tpl2"}, headers=h)
    project_id = pr.json()["id"]

    r = sync_client.post(
        "/api/templates/does-not-exist/apply",
        json={"projectId": project_id},
        headers=h,
    )
    assert r.status_code == 404


@pytest.mark.integration
def test_apply_template_bad_project(sync_client: TestClient):
    h = {"X-User-ID": USER}
    r = sync_client.post(
        "/api/templates/faq-chatbot/apply",
        json={"projectId": "00000000-0000-4000-8000-00000000dead"},
        headers=h,
    )
    assert r.status_code == 404
