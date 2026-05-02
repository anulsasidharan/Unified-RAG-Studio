"""Designer mode API — pipeline configuration CRUD (P4-2), cost estimate (P4-3), export (P4-4)."""

from __future__ import annotations

from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.config import Settings, get_settings
from app.dependencies import DbSession, RequestUserId
from app.schemas.designer import (
    ConfigListResponse,
    CostRequest,
    ExportRequest,
    ExportResponse,
    SaveConfigRequest,
    SaveConfigResponse,
    UpdateDesignerConfigRequest,
)
from app.schemas.pipeline import CostEstimateSchema
from app.services.cost_service import CostService
from app.services.designer_service import DesignerService
from app.services.export_service import ExportService
from app.utils.cost_calculator import PricingLoadError

router = APIRouter(prefix="/api/designer", tags=["designer"])


def _svc(session: DbSession) -> DesignerService:
    return DesignerService(session)


@router.post(
    "/config",
    response_model=SaveConfigResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create pipeline configuration",
)
async def create_config(
    body: SaveConfigRequest,
    session: DbSession,
    user_id: RequestUserId,
) -> SaveConfigResponse:
    out = await _svc(session).save_config(user_id, body)
    if out is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return out


@router.get(
    "/config/{config_id}",
    response_model=SaveConfigResponse,
    summary="Load pipeline configuration by id",
)
async def get_config(
    config_id: uuid.UUID,
    session: DbSession,
    user_id: RequestUserId,
) -> SaveConfigResponse:
    out = await _svc(session).load_config(user_id, config_id)
    if out is None:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return out


@router.put(
    "/config/{config_id}",
    response_model=SaveConfigResponse,
    summary="Update pipeline configuration",
)
async def put_config(
    config_id: uuid.UUID,
    body: UpdateDesignerConfigRequest,
    session: DbSession,
    user_id: RequestUserId,
) -> SaveConfigResponse:
    if body.name is None and body.description is None and body.config is None:
        raise HTTPException(
            status_code=400,
            detail="At least one of name, description, config must be provided",
        )
    out = await _svc(session).update_config(user_id, config_id, body)
    if out is None:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return out


@router.get(
    "/configs",
    response_model=ConfigListResponse,
    summary="List pipeline configurations for a project",
)
async def list_configs(
    project_id: uuid.UUID,
    session: DbSession,
    user_id: RequestUserId,
    settings: Annotated[Settings, Depends(get_settings)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
) -> ConfigListResponse:
    cap = settings.max_page_size
    if page_size > cap:
        raise HTTPException(status_code=400, detail=f"page_size must be <= {cap}")
    out = await _svc(session).list_for_project(
        user_id,
        project_id,
        page=page,
        page_size=page_size,
    )
    if out is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return out


@router.delete(
    "/config/{config_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete pipeline configuration",
)
async def delete_config(
    config_id: uuid.UUID,
    session: DbSession,
    user_id: RequestUserId,
) -> None:
    ok = await _svc(session).delete_config(user_id, config_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return None


@router.post(
    "/export",
    response_model=ExportResponse,
    summary=(
        "Export pipeline as Python, YAML, Terraform, Docker Compose, or Kubernetes YAML"
    ),
)
async def export_pipeline(body: ExportRequest) -> ExportResponse:
    """Return generated file content and a suggested download filename."""
    return ExportService.export(body)


@router.post(
    "/cost",
    response_model=CostEstimateSchema,
    summary="Estimate pipeline cost (per query and per month)",
)
async def estimate_pipeline_cost(
    body: CostRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> CostEstimateSchema:
    """Return ``CostEstimateSchema`` using ``data/pricing.json`` (or ``PRICING_CATALOG_PATH``)."""
    try:
        return CostService(settings).estimate(body)
    except PricingLoadError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
