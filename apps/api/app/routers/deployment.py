"""Deployment API — P8-4: trigger deploy, status, list by project, teardown."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import DbSession, RequestUserId
from app.schemas.deployment import DeployRequest, DeployResponse, DeploymentListResponse, DeploymentStatusResponse
from app.services.deployment_service import DeploymentService

router = APIRouter(prefix="/api/deployment", tags=["deployment"])


def _svc(session: DbSession) -> DeploymentService:
    return DeploymentService(session)


@router.post(
    "/deploy",
    response_model=DeployResponse,
    response_model_exclude_none=True,
    summary="Trigger deployment for a pipeline configuration",
    status_code=status.HTTP_201_CREATED,
)
async def deploy_pipeline(
    body: DeployRequest,
    session: DbSession,
    user_id: RequestUserId,
) -> DeployResponse:
    out = await _svc(session).trigger_deploy(user_id, body)
    if out is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline configuration not found")
    return out


@router.get(
    "/deployments",
    response_model=DeploymentListResponse,
    summary="List deployments for a project",
)
async def list_deployments(
    session: DbSession,
    user_id: RequestUserId,
    project_id: Annotated[uuid.UUID, Query(description="Project UUID")],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> DeploymentListResponse:
    out = await _svc(session).list_for_project(user_id, project_id, page=page, page_size=page_size)
    if out is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return out


@router.get(
    "/{deployment_id}/status",
    response_model=DeploymentStatusResponse,
    response_model_exclude_none=True,
    summary="Get deployment status and endpoints",
)
async def get_deployment_status(
    deployment_id: uuid.UUID,
    session: DbSession,
    user_id: RequestUserId,
) -> DeploymentStatusResponse:
    out = await _svc(session).get_status(user_id, deployment_id)
    if out is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")
    return out


@router.delete(
    "/{deployment_id}",
    response_model=DeploymentStatusResponse,
    response_model_exclude_none=True,
    summary="Tear down a deployment (logical teardown record)",
)
async def teardown_deployment(
    deployment_id: uuid.UUID,
    session: DbSession,
    user_id: RequestUserId,
) -> DeploymentStatusResponse:
    out = await _svc(session).teardown(user_id, deployment_id)
    if out is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")
    return out
