"""Cross-cutting helpers: pipeline validation (Pydantic) and cost previews."""

from __future__ import annotations

import platform
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.core.utilities.cost import CostEstimator, PricingLoadError, load_pricing
from app.metadata import API_SEMVER
from app.schemas.designer import CostRequest, RagPreviewRequest, RagPreviewResponse
from app.schemas.pipeline import CostEstimateSchema, PipelineConfigurationSchema
from app.schemas.utilities import InfoResponse, ValidatePipelineResponse
from app.services.rag_preview_service import run_rag_preview

router = APIRouter(prefix="/api/utilities", tags=["utilities"])


@router.get("/info", response_model=InfoResponse)
async def service_info(settings: Annotated[Settings, Depends(get_settings)]) -> InfoResponse:
    """Static service metadata useful for dashboards and debugging."""
    return InfoResponse(
        service="rag-studio-api",
        version=API_SEMVER,
        environment=settings.app_env,
        python_version=platform.python_version(),
    )


@router.post("/validate-pipeline", response_model=ValidatePipelineResponse)
async def validate_pipeline(body: dict[str, Any]) -> ValidatePipelineResponse:
    """Validate a Designer/Autopilot pipeline JSON without persisting."""
    try:
        PipelineConfigurationSchema.model_validate(body)
        return ValidatePipelineResponse(valid=True, errors=[])
    except ValidationError as exc:
        return ValidatePipelineResponse(
            valid=False,
            errors=exc.errors(include_url=False),
        )


@router.post("/cost", response_model=CostEstimateSchema)
async def estimate_monthly_cost(
    body: CostRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> CostEstimateSchema:
    """Rough monthly / per-query cost using shared ``pricing.json``."""
    try:
        pricing = load_pricing(settings)
    except PricingLoadError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return CostEstimator(pricing).estimate(body)


@router.post(
    "/rag-preview",
    response_model=RagPreviewResponse,
    summary="Guarded RAG preview (same contract as POST /api/designer/rag-preview)",
)
async def utilities_rag_preview(body: RagPreviewRequest) -> RagPreviewResponse:
    """Shared entry for Autopilot-style callers that post a pipeline config + query."""
    return await run_rag_preview(body)
