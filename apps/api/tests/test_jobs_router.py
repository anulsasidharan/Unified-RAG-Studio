"""Tests for Celery job enqueue endpoints — mock `.delay()` to avoid Redis."""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
import pytest

from app.worker import tasks


@pytest.mark.unit
def test_enqueue_pipeline_build(sync_client: TestClient):
    mock_async = MagicMock()
    mock_async.id = "task-build-1"
    with patch.object(tasks.run_pipeline_build, "delay", return_value=mock_async):
        r = sync_client.post(
            "/api/jobs/build/f7c6c5c4-c3c3-4333-a111-aaaaaaaaaaaa",
            json={"force": False},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["taskId"] == "task-build-1"
    assert body["buildId"] == "f7c6c5c4-c3c3-4333-a111-aaaaaaaaaaaa"


@pytest.mark.unit
def test_enqueue_evaluation(sync_client: TestClient):
    mock_async = MagicMock()
    mock_async.id = "task-eval-2"
    with patch.object(tasks.run_evaluation, "delay", return_value=mock_async):
        r = sync_client.post(
            "/api/jobs/evaluation",
            json={
                "evaluation_run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "examples": [
                    {
                        "question": "Q?",
                        "ground_truth": "A",
                        "answer": "model",
                        "contexts": ["ctx"],
                    }
                ],
            },
        )
    assert r.status_code == 200
    assert r.json()["taskId"] == "task-eval-2"


@pytest.mark.unit
def test_enqueue_deployment(sync_client: TestClient):
    mock_async = MagicMock()
    mock_async.id = "task-deploy-3"
    with patch.object(tasks.run_deployment, "delay", return_value=mock_async):
        rid = "b2222222-2222-4222-a222-222222222222"
        r = sync_client.post(f"/api/jobs/deployment/{rid}")
    assert r.status_code == 200
    assert r.json()["deploymentId"] == rid


@pytest.mark.unit
def test_database_url_sync_converts_async_drivers():
    from app.config import Settings, get_settings

    pg = Settings(
        database_url="postgresql+asyncpg://raguser:x@localhost:5432/db",
        app_env="test",
    ).database_url_sync
    assert pg.startswith("postgresql+psycopg://")

    sq = Settings(
        database_url="sqlite+aiosqlite:///./file.db",
        app_env="test",
    ).database_url_sync
    assert sq.startswith("sqlite:///")

    get_settings.cache_clear()
