"""Smoke tests for the /health endpoint — verifies the app starts correctly."""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.unit
def test_health_returns_200(sync_client: TestClient):
    response = sync_client.get("/health")
    assert response.status_code == 200


@pytest.mark.unit
def test_health_response_body(sync_client: TestClient):
    data = sync_client.get("/health").json()
    assert data["status"] == "ok"
    assert "version" in data


@pytest.mark.unit
async def test_health_async(async_client):
    response = await async_client.get("/health")
    assert response.status_code == 200
