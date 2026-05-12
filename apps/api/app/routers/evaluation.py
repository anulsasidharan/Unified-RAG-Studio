"""Evaluation API — P8-3: run RAGAS evaluations, list history, compare two configs."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.dependencies import DbSession, RequestUserId
from app.schemas.evaluation import (
    CompareConfigsRequest,
    CompareConfigsResponse,
    EvaluationRunListResponse,
    EvaluationRunRequest,
    EvaluationRunResponse,
)
from app.services.evaluation_service import EvaluationService

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])


class SyntheticDatasetJobRequest(BaseModel):
    """Stub request for synthetic QA generation (full job wiring is roadmap)."""

    pipeline_config_id: str | None = Field(default=None, description="Optional pipeline UUID as string")
    num_examples: int = Field(default=10, ge=1, le=500, description="Target number of synthetic QA pairs")


def _svc(session: DbSession) -> EvaluationService:
    return EvaluationService(session)


@router.post(
    "/run",
    response_model=EvaluationRunResponse,
    response_model_exclude_none=True,
    summary="Run RAG evaluation for a pipeline configuration",
)
async def run_evaluation(
    body: EvaluationRunRequest,
    session: DbSession,
    user_id: RequestUserId,
) -> EvaluationRunResponse:
    try:
        out = await _svc(session).run_evaluation(user_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if out is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Configuration not found")
    return out


@router.get(
    "/run/{run_id}",
    response_model=EvaluationRunResponse,
    response_model_exclude_none=True,
    summary="Get evaluation run status and results",
)
async def get_evaluation_run(
    run_id: uuid.UUID,
    session: DbSession,
    user_id: RequestUserId,
) -> EvaluationRunResponse:
    out = await _svc(session).get_run(user_id, run_id)
    if out is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evaluation run not found")
    return out


@router.get(
    "/runs",
    response_model=EvaluationRunListResponse,
    summary="List evaluation runs for a pipeline configuration",
)
async def list_evaluation_runs(
    session: DbSession,
    user_id: RequestUserId,
    config_id: Annotated[uuid.UUID, Query(description="Pipeline configuration UUID")],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> EvaluationRunListResponse:
    out = await _svc(session).list_runs(user_id, config_id, limit=limit)
    if out is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Configuration not found")
    return out


@router.post(
    "/compare",
    response_model=CompareConfigsResponse,
    response_model_exclude_none=True,
    summary="Compare evaluation metrics between two pipeline configurations",
)
async def compare_configurations(
    body: CompareConfigsRequest,
    session: DbSession,
    user_id: RequestUserId,
) -> CompareConfigsResponse:
    try:
        out = await _svc(session).compare(user_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if out is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comparison failed — verify configuration IDs, or use completed evaluation run IDs.",
        )
    return out


@router.post(
    "/synthetic-dataset",
    summary="Enqueue or describe synthetic dataset generation (stub)",
)
async def create_synthetic_dataset_job(
    body: SyntheticDatasetJobRequest,
) -> dict[str, object]:
    """Returns a stable placeholder until corpus-backed synthetic generation ships."""
    return {
        "status": "planned",
        "message": (
            "Synthetic dataset generation is not executed in this build. "
            "Use evaluation runs with a labeled set, or connect a worker job that reads your corpus."
        ),
        "requested_examples": body.num_examples,
        "pipeline_config_id": body.pipeline_config_id,
    }
