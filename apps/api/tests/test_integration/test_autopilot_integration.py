"""Autopilot API integration: upload + Celery enqueue + status lifecycle (P10-2)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
import pytest

from app.services.autopilot_object_storage import UploadedBlobMeta
from app.worker import tasks

USER = "c0dec0de-c0de-4c0d-8c0d-c0dec0dec0de"


@pytest.mark.integration
def test_autopilot_upload_and_build_status_flow(sync_client: TestClient) -> None:
    h = {"X-User-ID": USER}
    pr = sync_client.post("/api/projects", json={"name": "Autopilot integration"}, headers=h)
    assert pr.status_code == 201
    project_id = pr.json()["id"]

    def _fake_upload(settings, *, user_id, project_id, payloads):  # noqa: ARG001
        return [
            UploadedBlobMeta(
                object_id=f"autopilot/{user_id}/{project_id}/stub-{i}.txt",
                original_filename=name,
                size_bytes=len(data),
                content_type=ct,
            )
            for i, (name, data, ct) in enumerate(payloads)
        ]

    files = [("files", ("doc.txt", b"integration document body", "text/plain"))]
    with patch("app.routers.autopilot.upload_blobs_sync", side_effect=_fake_upload):
        up = sync_client.post(
            "/api/autopilot/upload",
            data={"projectId": project_id},
            files=files,
            headers=h,
        )
    assert up.status_code == 201
    docs = up.json()["documents"]
    assert len(docs) == 1
    doc_ids = [d["objectId"] for d in docs]

    mock_async = MagicMock()
    mock_async.id = "celery-task-integration-1"
    with patch.object(tasks.run_pipeline_build, "delay", return_value=mock_async):
        start = sync_client.post(
            "/api/autopilot/build",
            json={
                "projectId": project_id,
                "requirements": {"optimizeFor": "quality", "maxIterations": 2},
                "documentIds": doc_ids,
            },
            headers=h,
        )
    assert start.status_code == 202
    bid = start.json()["buildId"]

    st = sync_client.get(f"/api/autopilot/build/{bid}", headers=h)
    assert st.status_code == 200
    detail = st.json()
    assert detail["buildId"] == bid
    assert detail["status"] == "pending"
    assert "analyze" in detail["stages"]


@pytest.mark.integration
def test_autopilot_cancel_pending_build(sync_client: TestClient) -> None:
    h = {"X-User-ID": USER}
    project_id = sync_client.post("/api/projects", json={"name": "Cancel test"}, headers=h).json()[
        "id"
    ]

    with patch(
        "app.routers.autopilot.upload_blobs_sync",
        side_effect=lambda settings, *, user_id, project_id, payloads: [  # noqa: ARG005
            UploadedBlobMeta(
                object_id=f"x/{project_id}/a.txt",
                original_filename=payloads[0][0],
                size_bytes=len(payloads[0][1]),
                content_type=payloads[0][2],
            )
        ],
    ):
        up = sync_client.post(
            "/api/autopilot/upload",
            data={"projectId": project_id},
            files=[("files", ("a.txt", b"z", "text/plain"))],
            headers=h,
        )
    object_id = up.json()["documents"][0]["objectId"]

    mock_async = MagicMock()
    mock_async.id = "celery-task-cancel-1"
    with patch.object(tasks.run_pipeline_build, "delay", return_value=mock_async):
        start = sync_client.post(
            "/api/autopilot/build",
            json={
                "projectId": project_id,
                "requirements": {"optimizeFor": "balanced", "maxIterations": 2},
                "documentIds": [object_id],
            },
            headers=h,
        )
    bid = start.json()["buildId"]

    cancel = sync_client.post(f"/api/autopilot/build/{bid}/cancel", headers=h)
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "cancelled"
