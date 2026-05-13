"""Tests for ``/api/autopilot`` build lifecycle (P6-9)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
import pytest

from app.services.autopilot_object_storage import UploadedBlobMeta
from app.worker import tasks

# Dedicated user so this file does not inflate project counts for ``test_projects`` (same SQLite DB).  # noqa: E501
USER_AUTO = "22222222-2222-4222-8222-222222222222"


def _create_project(client: TestClient) -> str:
    r = client.post(
        "/api/projects",
        json={"name": "Autopilot project", "description": "p"},
        headers={"X-User-ID": USER_AUTO},
    )
    assert r.status_code == 201
    return r.json()["id"]


@pytest.mark.integration
def test_autopilot_upload_multipart_mock_minio(sync_client: TestClient):
    pid = _create_project(sync_client)

    def _fake_upload(settings, *, user_id, project_id, payloads):
        return [
            UploadedBlobMeta(
                object_id=f"autopilot/{user_id}/{project_id}/stub-{i}.txt",
                original_filename=name,
                size_bytes=len(data),
                content_type=ct,
            )
            for i, (name, data, ct) in enumerate(payloads)
        ]

    files = [
        ("files", ("alpha.txt", b"hello", "text/plain")),
        ("files", ("beta.md", b"# Title", "text/markdown")),
    ]
    with patch("app.routers.autopilot.upload_blobs_sync", side_effect=_fake_upload):
        r = sync_client.post(
            "/api/autopilot/upload",
            data={"projectId": pid},
            files=files,
            headers={"X-User-ID": USER_AUTO},
        )
    assert r.status_code == 201
    body = r.json()
    assert len(body["documents"]) == 2
    assert body["documents"][0]["objectId"].endswith("-0.txt")
    assert body["documents"][0]["originalFilename"] == "alpha.txt"
    assert body["documents"][1]["sizeBytes"] == 7


@pytest.mark.integration
def test_autopilot_upload_project_owned_by_other_user(sync_client: TestClient):
    pid = _create_project(sync_client)
    other = "33333333-3333-4333-8333-333333333333"
    with patch("app.routers.autopilot.upload_blobs_sync"):
        r = sync_client.post(
            "/api/autopilot/upload",
            data={"projectId": pid},
            files=[("files", ("only.txt", b"x", "text/plain"))],
            headers={"X-User-ID": other},
        )
    assert r.status_code == 404


@pytest.mark.integration
def test_autopilot_start_get_cancel_flow(sync_client: TestClient):
    pid = _create_project(sync_client)
    mock_async = MagicMock()
    mock_async.id = "celery-task-autopilot-1"
    with patch.object(tasks.run_pipeline_build, "delay", return_value=mock_async):
        start = sync_client.post(
            "/api/autopilot/build",
            json={
                "projectId": pid,
                "requirements": {"optimizeFor": "balanced", "maxIterations": 3},
                "documentIds": ["doc-a", "doc-b"],
            },
            headers={"X-User-ID": USER_AUTO},
        )
    assert start.status_code == 202
    body = start.json()
    assert body["status"] == "pending"
    bid = body["buildId"]

    st = sync_client.get(f"/api/autopilot/build/{bid}", headers={"X-User-ID": USER_AUTO})
    assert st.status_code == 200
    detail = st.json()
    assert detail["buildId"] == bid
    assert detail["status"] == "pending"
    assert "analyze" in detail["stages"]
    assert detail["stages"]["analyze"]["status"] == "pending"

    cancel = sync_client.post(
        f"/api/autopilot/build/{bid}/cancel",
        headers={"X-User-ID": USER_AUTO},
    )
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "cancelled"

    st2 = sync_client.get(f"/api/autopilot/build/{bid}", headers={"X-User-ID": USER_AUTO})
    assert st2.json()["status"] == "cancelled"


@pytest.mark.integration
def test_autopilot_wrong_user(sync_client: TestClient):
    pid = _create_project(sync_client)
    mock_async = MagicMock()
    mock_async.id = "t2"
    other = "33333333-3333-4333-8333-333333333333"
    with patch.object(tasks.run_pipeline_build, "delay", return_value=mock_async):
        start = sync_client.post(
            "/api/autopilot/build",
            json={
                "projectId": pid,
                "requirements": {},
                "documentIds": ["x"],
            },
            headers={"X-User-ID": USER_AUTO},
        )
    assert start.status_code == 202
    bid = start.json()["buildId"]

    r = sync_client.get(f"/api/autopilot/build/{bid}", headers={"X-User-ID": other})
    assert r.status_code == 404


@pytest.mark.integration
def test_autopilot_result_not_ready(sync_client: TestClient):
    pid = _create_project(sync_client)
    mock_async = MagicMock()
    mock_async.id = "t3"
    with patch.object(tasks.run_pipeline_build, "delay", return_value=mock_async):
        start = sync_client.post(
            "/api/autopilot/build",
            json={
                "projectId": pid,
                "requirements": {},
                "documentIds": ["x"],
            },
            headers={"X-User-ID": USER_AUTO},
        )
    bid = start.json()["buildId"]
    res = sync_client.get(f"/api/autopilot/build/{bid}/result", headers={"X-User-ID": USER_AUTO})
    assert res.status_code == 404


@pytest.mark.integration
def test_autopilot_list_builds(sync_client: TestClient):
    pid = _create_project(sync_client)
    mock_async = MagicMock()
    mock_async.id = "t-list"
    with patch.object(tasks.run_pipeline_build, "delay", return_value=mock_async):
        start = sync_client.post(
            "/api/autopilot/build",
            json={
                "projectId": pid,
                "requirements": {},
                "documentIds": ["x"],
            },
            headers={"X-User-ID": USER_AUTO},
        )
    assert start.status_code == 202
    bid = start.json()["buildId"]
    r = sync_client.get(
        f"/api/autopilot/builds?page=1&page_size=10&project_id={pid}",
        headers={"X-User-ID": USER_AUTO},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    assert len(body["items"]) >= 1
    row = next((x for x in body["items"] if x["buildId"] == bid), None)
    assert row is not None
    assert row["projectId"] == pid
    assert row["projectName"] == "Autopilot project"
    assert row["status"] in ("pending", "running", "complete", "failed", "cancelled")


@pytest.mark.integration
def test_autopilot_list_builds_filter_unknown_project(sync_client: TestClient):
    bad = "00000000-0000-4000-8000-000000000099"
    r = sync_client.get(
        f"/api/autopilot/builds?project_id={bad}",
        headers={"X-User-ID": USER_AUTO},
    )
    assert r.status_code == 404


@pytest.mark.integration
def test_autopilot_cancel_twice_conflict(sync_client: TestClient):
    pid = _create_project(sync_client)
    mock_async = MagicMock()
    mock_async.id = "t4"
    with patch.object(tasks.run_pipeline_build, "delay", return_value=mock_async):
        start = sync_client.post(
            "/api/autopilot/build",
            json={
                "projectId": pid,
                "requirements": {},
                "documentIds": ["x"],
            },
            headers={"X-User-ID": USER_AUTO},
        )
    bid = start.json()["buildId"]
    assert (
        sync_client.post(
            f"/api/autopilot/build/{bid}/cancel", headers={"X-User-ID": USER_AUTO}
        ).status_code
        == 200
    )
    again = sync_client.post(f"/api/autopilot/build/{bid}/cancel", headers={"X-User-ID": USER_AUTO})
    assert again.status_code == 409
