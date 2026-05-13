"""Integration tests for ``/api/projects`` (P4-1)."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
import pytest

from app.config import get_settings

USER_A = "11111111-1111-4111-8111-111111111111"


@pytest.mark.integration
def test_projects_crud_flow(sync_client: TestClient):
    h = {"X-User-ID": USER_A}
    r = sync_client.post(
        "/api/projects/",
        json={"name": " Alpha ", "description": "hello"},
        headers=h,
    )
    assert r.status_code == 201
    body = r.json()
    pid = body["id"]
    assert body["name"] == "Alpha"
    assert body["description"] == "hello"
    assert body["userId"] == USER_A

    lst = sync_client.get("/api/projects/", headers=h).json()
    assert lst["total"] == 1
    assert lst["pages"] == 1
    assert len(lst["items"]) == 1

    detail = sync_client.get(f"/api/projects/{pid}", headers=h).json()
    assert detail["pipelineConfigs"] == []
    assert detail["autopilotBuilds"] == []

    up = sync_client.put(
        f"/api/projects/{pid}",
        json={"name": "Beta"},
        headers=h,
    )
    assert up.status_code == 200
    assert up.json()["name"] == "Beta"

    del_r = sync_client.delete(f"/api/projects/{pid}", headers=h)
    assert del_r.status_code == 204

    assert sync_client.get(f"/api/projects/{pid}", headers=h).status_code == 404
    empty = sync_client.get("/api/projects/", headers=h).json()
    assert empty["total"] == 0


@pytest.mark.integration
def test_projects_user_isolation(sync_client: TestClient):
    ua, ub = str(uuid.uuid4()), str(uuid.uuid4())
    sync_client.post(
        "/api/projects/",
        json={"name": "Owned by A"},
        headers={"X-User-ID": ua},
    )
    b_list = sync_client.get("/api/projects/", headers={"X-User-ID": ub}).json()
    assert b_list["total"] == 0


@pytest.mark.integration
def test_projects_invalid_user_header(sync_client: TestClient):
    r = sync_client.get(
        "/api/projects/",
        headers={"X-User-ID": "not-a-uuid"},
    )
    assert r.status_code == 400


@pytest.mark.integration
def test_projects_page_size_cap(sync_client: TestClient):
    cap = get_settings().max_page_size
    r = sync_client.get(
        "/api/projects/",
        params={"page_size": cap + 1},
        headers={"X-User-ID": USER_A},
    )
    assert r.status_code == 400


@pytest.mark.integration
def test_projects_update_requires_field(sync_client: TestClient):
    pid = str(uuid.uuid4())
    r = sync_client.put(
        f"/api/projects/{pid}",
        json={},
        headers={"X-User-ID": USER_A},
    )
    assert r.status_code == 400
