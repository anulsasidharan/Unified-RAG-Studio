"""Autopilot Mode HTTP API — document upload (P7-1), build lifecycle (P6-9), SSE, cancel, artifacts."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from datetime import UTC, datetime
import json
from typing import Annotated, Any, Literal, cast
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
import structlog

from app.config import Settings, get_settings
from app.core.agents.state import AUTOPILOT_STAGE_ORDER
from app.dependencies import DbSession, RequestUserId, get_session_factory
from app.models.build_history import AutopilotBuild
from app.models.project import Project
from app.schemas.autopilot import (
    AutopilotBuildListItemSchema,
    AutopilotBuildListResponse,
    AutopilotDashboardMetricsSchema,
    AutopilotUploadResponse,
    BuildArtifactResultResponse,
    BuildMessageSchema,
    BuildResultSchema,
    BuildStatusResponse,
    CancelBuildResponse,
    StageStatusSchema,
    StartBuildRequest,
    StartBuildResponse,
    UploadedDocumentItem,
)
from app.services.autopilot_build_service import AutopilotBuildService
from app.services.autopilot_dashboard_metrics import extract_dashboard_metrics
from app.services.autopilot_object_storage import (
    AutopilotStorageUnavailableError,
    AutopilotUploadError,
    upload_blobs_sync,
    validate_upload_candidate,
)
from app.worker import celery_app
from app.worker.tasks import run_pipeline_build

router = APIRouter(prefix="/api/autopilot", tags=["autopilot"])
logger = structlog.get_logger(__name__)


def _svc(session: DbSession) -> AutopilotBuildService:
    return AutopilotBuildService(session)


def _dt_iso(v: datetime | None) -> str | None:
    if v is None:
        return None
    return v.isoformat()


def _normalize_stages(raw: dict[str, Any] | None) -> dict[str, StageStatusSchema]:
    out: dict[str, StageStatusSchema] = {}
    for key in AUTOPILOT_STAGE_ORDER:
        cell = (raw or {}).get(key)
        if isinstance(cell, dict):
            try:
                out[key] = StageStatusSchema.model_validate(cell)
                continue
            except ValidationError:
                pass
        out[key] = StageStatusSchema(
            status="pending",
            started_at=None,
            completed_at=None,
            message=None,
        )
    return out


def _normalize_messages(raw: list[Any] | None) -> list[BuildMessageSchema]:
    items: list[BuildMessageSchema] = []
    for m in raw or []:
        if not isinstance(m, dict):
            continue
        try:
            items.append(BuildMessageSchema.model_validate(m))
        except ValidationError:
            raw_t = m.get("type")
            safe_t: Literal["info", "success", "warning", "error"] = (
                raw_t if raw_t in ("info", "success", "warning", "error") else "info"
            )
            items.append(
                BuildMessageSchema(
                    timestamp=str(m.get("timestamp") or datetime.now(UTC).isoformat()),
                    text=str(m.get("text") or ""),
                    type=safe_t,
                    agent=m.get("agent") if isinstance(m.get("agent"), str) else None,
                ),
            )
    return items


def _optional_typed_result(raw: dict[str, Any] | None) -> BuildResultSchema | None:
    if not raw:
        return None
    try:
        return BuildResultSchema.model_validate(raw)
    except ValidationError:
        return None


def _optional_dashboard_metrics(raw: dict[str, Any] | None) -> AutopilotDashboardMetricsSchema | None:
    extracted = extract_dashboard_metrics(raw)
    if not extracted:
        return None
    try:
        return AutopilotDashboardMetricsSchema.model_validate(extracted)
    except ValidationError:
        return None


def _coerce_build_status(
    raw: str,
) -> Literal["pending", "running", "complete", "failed", "cancelled"]:
    allowed: tuple[str, ...] = ("pending", "running", "complete", "failed", "cancelled")
    if raw in allowed:
        return cast(Literal["pending", "running", "complete", "failed", "cancelled"], raw)
    return "failed"


async def _require_owned_project(
    session: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    proj = await session.get(Project, project_id)
    if proj is None or proj.user_id != user_id or proj.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


@router.post(
    "/upload",
    response_model=AutopilotUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Autopilot corpus files to object storage",
)
async def upload_autopilot_documents(
    project_id: Annotated[str, Form(alias="projectId")],
    files: Annotated[list[UploadFile], File(description="Corpus files for Autopilot")],
    session: DbSession,
    user_id: RequestUserId,
    settings: Annotated[Settings, Depends(get_settings)],
) -> AutopilotUploadResponse:
    try:
        pid = uuid.UUID(project_id.strip())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid projectId"
        ) from exc

    await _require_owned_project(session, pid, user_id)

    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="At least one file is required"
        )

    max_files = max(1, int(settings.autopilot_upload_max_files))
    if len(files) > max_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many files (max {max_files})",
        )

    max_bytes = max(1024, int(settings.autopilot_upload_max_bytes_per_file))
    payloads: list[tuple[str, bytes, str | None]] = []
    for upload in files:
        raw_name = (upload.filename or "upload").strip() or "upload"
        data = await upload.read()
        try:
            validate_upload_candidate(raw_name, len(data), max_bytes=max_bytes)
        except AutopilotUploadError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        payloads.append((raw_name, data, upload.content_type))

    try:
        uploaded = await asyncio.to_thread(
            upload_blobs_sync,
            settings,
            user_id=user_id,
            project_id=pid,
            payloads=payloads,
        )
    except AutopilotUploadError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except AutopilotStorageUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    items = [
        UploadedDocumentItem(
            object_id=u.object_id,
            original_filename=u.original_filename,
            size_bytes=u.size_bytes,
            content_type=u.content_type,
        )
        for u in uploaded
    ]
    return AutopilotUploadResponse(documents=items)


def _build_list_item(row: AutopilotBuild, project_name: str) -> AutopilotBuildListItemSchema:
    return AutopilotBuildListItemSchema(
        build_id=str(row.id),
        project_id=str(row.project_id),
        project_name=project_name,
        status=_coerce_build_status(str(row.status or "pending")),
        progress=int(row.progress or 0),
        current_stage=row.current_stage or "queued",
        iteration=int(row.iteration or 0),
        created_at=_dt_iso(row.created_at) or "",
        updated_at=_dt_iso(row.updated_at) or "",
        completed_at=_dt_iso(row.completed_at),
        error=row.error,
    )


def build_status_response(row: AutopilotBuild) -> BuildStatusResponse:
    raw_result = row.result if isinstance(row.result, dict) else None
    return BuildStatusResponse(
        build_id=str(row.id),
        status=_coerce_build_status(str(row.status or "pending")),
        progress=int(row.progress or 0),
        current_stage=row.current_stage or "queued",
        iteration=int(row.iteration or 0),
        stages=_normalize_stages(row.stages if isinstance(row.stages, dict) else None),
        messages=_normalize_messages(row.messages if isinstance(row.messages, list) else None),
        result=_optional_typed_result(raw_result),
        dashboard_metrics=_optional_dashboard_metrics(raw_result),
        error=row.error,
        created_at=_dt_iso(row.created_at) or "",
        updated_at=_dt_iso(row.updated_at) or "",
        completed_at=_dt_iso(row.completed_at),
    )


@router.get(
    "/builds",
    response_model=AutopilotBuildListResponse,
    summary="List Autopilot builds for the current user (newest first)",
)
async def list_autopilot_builds(
    session: DbSession,
    user_id: RequestUserId,
    settings: Annotated[Settings, Depends(get_settings)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    project_id: str | None = Query(None, description="Optional project UUID to filter builds"),
) -> AutopilotBuildListResponse:
    cap = settings.max_page_size
    if page_size > cap:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"page_size must be <= {cap}",
        )

    pid_filter: uuid.UUID | None = None
    if project_id is not None and project_id.strip():
        try:
            pid_filter = uuid.UUID(project_id.strip())
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="invalid project_id",
            ) from exc
        await _require_owned_project(session, pid_filter, user_id)

    total, rows = await _svc(session).list_for_user(
        user_id,
        project_id=pid_filter,
        page=page,
        page_size=page_size,
    )
    items = [_build_list_item(b, name) for b, name in rows]
    return AutopilotBuildListResponse.from_rows(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/build",
    response_model=StartBuildResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start an Autopilot build",
)
async def start_build(
    body: StartBuildRequest,
    session: DbSession,
    user_id: RequestUserId,
) -> StartBuildResponse:
    try:
        build = await _svc(session).create_pending_build(user_id, body)
    except LookupError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        ) from None
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    async_result = run_pipeline_build.delay(str(build.id))
    await _svc(session).attach_celery_task_id(build.id, async_result.id)

    return StartBuildResponse(
        build_id=str(build.id),
        status="pending",
        message="Autopilot build queued.",
    )


@router.get(
    "/build/{build_id}",
    response_model=BuildStatusResponse,
    summary="Poll Autopilot build status",
)
async def get_build_status(
    build_id: uuid.UUID,
    session: DbSession,
    user_id: RequestUserId,
) -> BuildStatusResponse:
    row = await _svc(session).get_owned(build_id, user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Build not found")
    return build_status_response(row)


@router.get(
    "/build/{build_id}/stream",
    summary="Server-Sent Events stream of build status",
)
async def stream_build_status(
    build_id: uuid.UUID,
    user_id: RequestUserId,
    factory: Annotated[async_sessionmaker[AsyncSession], Depends(get_session_factory)],
) -> StreamingResponse:
    async def gen() -> AsyncIterator[bytes]:
        while True:
            async with factory() as session:
                row = await AutopilotBuildService(session).get_owned(build_id, user_id)
                if row is None:
                    payload = {"error": "not_found", "buildId": str(build_id)}
                    yield f"data: {json.dumps(payload)}\n\n".encode()
                    return
                data = build_status_response(row).model_dump(mode="json", by_alias=True)
                yield f"data: {json.dumps(data, default=str)}\n\n".encode()
                if row.status in ("complete", "failed", "cancelled"):
                    return
            await asyncio.sleep(1.0)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/build/{build_id}/cancel",
    response_model=CancelBuildResponse,
    summary="Cancel a pending or running Autopilot build",
)
async def cancel_build(
    build_id: uuid.UUID,
    session: DbSession,
    user_id: RequestUserId,
) -> CancelBuildResponse:
    row = await _svc(session).get_owned(build_id, user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Build not found")
    if row.status in ("complete", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Build is already {row.status}",
        )

    task_id = None
    if isinstance(row.requirements, dict):
        tid = row.requirements.get("_celery_task_id")
        if isinstance(tid, str) and tid.strip():
            task_id = tid.strip()

    if task_id:
        try:
            celery_app.control.revoke(task_id, terminate=False)
        except Exception:
            logger.warning("autopilot_celery_revoke_failed", task_id=task_id, exc_info=True)

    await _svc(session).mark_cancelled(build_id)
    return CancelBuildResponse(build_id=str(build_id))


@router.get(
    "/build/{build_id}/result",
    response_model=BuildArtifactResultResponse,
    summary="Fetch raw orchestrator result JSON for a build",
)
async def get_build_result(
    build_id: uuid.UUID,
    session: DbSession,
    user_id: RequestUserId,
) -> BuildArtifactResultResponse:
    row = await _svc(session).get_owned(build_id, user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Build not found")
    if row.result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No result persisted yet")
    if not isinstance(row.result, dict):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid result shape"
        )
    return BuildArtifactResultResponse.model_validate(row.result)
