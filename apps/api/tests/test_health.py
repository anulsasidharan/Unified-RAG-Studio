"""Smoke tests for /health and readiness helpers."""

from fastapi.testclient import TestClient
import pytest

from app.metadata import API_SEMVER


@pytest.mark.unit
def test_health_returns_200(sync_client: TestClient):
    response = sync_client.get("/health")
    assert response.status_code == 200


@pytest.mark.unit
def test_health_response_body(sync_client: TestClient):
    data = sync_client.get("/health").json()
    assert data["status"] == "ok"
    assert data["version"] == API_SEMVER


@pytest.mark.unit
def test_health_live(sync_client: TestClient):
    r = sync_client.get("/health/live")
    assert r.status_code == 200
    assert r.json()["status"] == "alive"


@pytest.mark.unit
def test_health_ready_skips_upstream_in_test_env(sync_client: TestClient):
    r = sync_client.get("/health/ready")
    assert r.status_code == 200
    payload = r.json()
    assert payload["status"] == "ready"
    assert "skipped" in payload


@pytest.mark.unit
def test_x_request_id_echo_and_generated(sync_client: TestClient):
    r1 = sync_client.get("/health", headers={"X-Request-ID": "custom-id"})
    assert r1.headers.get("X-Request-ID") == "custom-id"
    r2 = sync_client.get("/health")
    assert r2.headers.get("X-Request-ID")


@pytest.mark.unit
async def test_health_async(async_client):
    response = await async_client.get("/health")
    assert response.status_code == 200
