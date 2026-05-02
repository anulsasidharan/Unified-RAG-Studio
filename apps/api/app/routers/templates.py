"""Pipeline templates API — catalog from ``data/templates.json`` (P4-5)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import Settings, get_settings
from app.dependencies import DbSession, RequestUserId
from app.schemas.templates import (
    ApplyTemplateRequest,
    ApplyTemplateResponse,
    PipelineTemplate,
    TemplatesCatalogResponse,
)
from app.services.template_service import TemplateService, TemplatesCatalogError

router = APIRouter(prefix="/api/templates", tags=["templates"])


def _svc(session: DbSession) -> TemplateService:
    return TemplateService(session)


@router.get(
    "",
    response_model=TemplatesCatalogResponse,
    summary="List pipeline templates",
)
async def list_templates(settings: Annotated[Settings, Depends(get_settings)]) -> TemplatesCatalogResponse:
    try:
        return TemplateService.list_templates(settings)
    except TemplatesCatalogError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.get(
    "/{template_id}",
    response_model=PipelineTemplate,
    summary="Get one template by id",
)
async def get_template(
    template_id: str,
    settings: Annotated[Settings, Depends(get_settings)],
) -> PipelineTemplate:
    try:
        entry = TemplateService.get_template(settings, template_id)
    except TemplatesCatalogError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return entry


@router.post(
    "/{template_id}/apply",
    response_model=ApplyTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Apply template — create pipeline config for a project",
)
async def apply_template(
    template_id: str,
    body: ApplyTemplateRequest,
    session: DbSession,
    user_id: RequestUserId,
    settings: Annotated[Settings, Depends(get_settings)],
) -> ApplyTemplateResponse:
    try:
        out = await _svc(session).apply(user_id, template_id, body, settings)
    except TemplatesCatalogError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    if out is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template or project not found",
        )
    return out
