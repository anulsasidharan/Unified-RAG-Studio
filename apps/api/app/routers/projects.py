"""Project CRUD API (P4-1)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.config import Settings, get_settings
from app.dependencies import DbSession, RequestUserId
from app.schemas.project import (
    PaginatedProjectsResponse,
    ProjectCreateRequest,
    ProjectDetailResponse,
    ProjectSummary,
    ProjectUpdateRequest,
)
from app.services.project_service import ProjectService

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _service(session: DbSession) -> ProjectService:
    return ProjectService(session)


@router.post(
    "",
    response_model=ProjectSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project",
)
async def create_project(
    body: ProjectCreateRequest,
    session: DbSession,
    user_id: RequestUserId,
) -> ProjectSummary:
    try:
        return await _service(session).create(user_id, body)
    except LookupError:
        raise HTTPException(status_code=404, detail="User not found") from None
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.get(
    "",
    response_model=PaginatedProjectsResponse,
    summary="List projects (paginated)",
)
async def list_projects(
    session: DbSession,
    user_id: RequestUserId,
    settings: Annotated[Settings, Depends(get_settings)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
) -> PaginatedProjectsResponse:
    cap = settings.max_page_size
    if page_size > cap:
        raise HTTPException(
            status_code=400,
            detail=f"page_size must be <= {cap}",
        )
    return await _service(session).list_page(
        user_id,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{project_id}",
    response_model=ProjectDetailResponse,
    summary="Get project with pipeline configs and autopilot builds",
)
async def get_project(
    project_id: uuid.UUID,
    session: DbSession,
    user_id: RequestUserId,
) -> ProjectDetailResponse:
    row = await _service(session).get_detail(project_id, user_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return row


@router.put(
    "/{project_id}",
    response_model=ProjectSummary,
    summary="Update project name or description",
)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdateRequest,
    session: DbSession,
    user_id: RequestUserId,
) -> ProjectSummary:
    if body.name is None and body.description is None:
        raise HTTPException(
            status_code=400,
            detail="At least one of name, description must be provided",
        )
    out = await _service(session).update(project_id, user_id, body)
    if out is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return out


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Soft-delete a project",
)
async def delete_project(
    project_id: uuid.UUID,
    session: DbSession,
    user_id: RequestUserId,
) -> None:
    ok = await _service(session).soft_delete(project_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found")
    return None
