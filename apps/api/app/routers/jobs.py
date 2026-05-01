"""HTTP surface for enqueueing background jobs and inspecting Celery task state."""

from typing import Any, Protocol, cast

from celery.result import AsyncResult
from fastapi import APIRouter
from pydantic import Field

from app.schemas.jobs import (
    SubmitBuildJobResponse,
    SubmitDeploymentJobResponse,
    SubmitEvaluationJobRequest,
    SubmitEvaluationJobResponse,
    TaskStatusResponse,
)
from app.schemas.pipeline import RAGBaseModel
from app.worker.tasks import run_deployment, run_evaluation, run_pipeline_build


router = APIRouter(prefix="/api/jobs", tags=["jobs"])


class _CeleryTaskWithDelay(Protocol):
    """Celery ``@app.task`` objects expose ``delay``; decorators erase that for static analysis."""

    def delay(self, *args: Any, **kwargs: Any) -> AsyncResult: ...


def _as_celery_task(fn: object) -> _CeleryTaskWithDelay:
    return cast(_CeleryTaskWithDelay, fn)


class BuildBody(RAGBaseModel):
    """Optional body for enqueueing a rebuild with future flags."""

    force: bool = Field(default=False, description="Reserved for stale-cache invalidation")


@router.post("/build/{build_id}", response_model=SubmitBuildJobResponse)
async def enqueue_pipeline_build(build_id: str, _body: BuildBody | None = None) -> SubmitBuildJobResponse:
    async_result = _as_celery_task(run_pipeline_build).delay(build_id)
    return SubmitBuildJobResponse(task_id=async_result.id, build_id=build_id)


@router.post("/evaluation", response_model=SubmitEvaluationJobResponse)
async def enqueue_evaluation(body: SubmitEvaluationJobRequest) -> SubmitEvaluationJobResponse:
    payloads = [ex.model_dump(mode="python") for ex in body.examples]
    async_result = _as_celery_task(run_evaluation).delay(
        body.evaluation_run_id,
        payloads,
        metric_names=body.metric_names,
    )
    return SubmitEvaluationJobResponse(task_id=async_result.id, evaluation_run_id=body.evaluation_run_id)


@router.post("/deployment/{deployment_id}", response_model=SubmitDeploymentJobResponse)
async def enqueue_deployment(deployment_id: str) -> SubmitDeploymentJobResponse:
    async_result = _as_celery_task(run_deployment).delay(deployment_id)
    return SubmitDeploymentJobResponse(task_id=async_result.id, deployment_id=deployment_id)


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def task_status(task_id: str) -> TaskStatusResponse:
    from celery.result import AsyncResult

    from app.worker import celery_app

    res = AsyncResult(task_id, app=celery_app)
    payload: dict | list | str | float | bool | None = None
    if res.successful():
        payload = res.result  # type: ignore[assignment]
    elif res.failed():
        err = res.result
        payload = {"error": repr(err) if err is not None else "failure"}
    elif isinstance(res.info, dict):
        payload = res.info
    elif res.info is not None:
        payload = str(res.info)
    return TaskStatusResponse(task_id=task_id, state=str(res.status), result=payload)
