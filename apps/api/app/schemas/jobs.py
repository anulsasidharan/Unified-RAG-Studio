"""Request/response payloads for enqueueing Celery jobs (P2-8).

These schemas support the provisional ``/api/jobs`` surface until Phase 6/8
Autopilot & evaluation routers consolidate routing.
"""

from typing import Any, Literal

from pydantic import Field, model_validator

from app.schemas.pipeline import RAGBaseModel


class EvaluationExamplePayload(RAGBaseModel):
    question: str
    ground_truth: str
    answer: str = ""
    contexts: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def merge_legacy_context(cls, data: Any) -> Any:
        if isinstance(data, dict) and "context" in data and data.get("contexts") is None:
            c = data.get("context")
            data["contexts"] = c if isinstance(c, list) else []
        return data


class SubmitEvaluationJobRequest(RAGBaseModel):
    evaluation_run_id: str
    examples: list[EvaluationExamplePayload]
    metric_names: list[str] | None = None


class TaskAcceptedResponse(RAGBaseModel):
    """Queued Celery AsyncResult identifiers."""

    task_id: str
    state: Literal["PENDING", "STARTED"] = "PENDING"


class TaskStatusResponse(RAGBaseModel):
    task_id: str
    state: str
    result: dict | list | str | float | bool | None = None


class SubmitBuildJobResponse(TaskAcceptedResponse):
    build_id: str


class SubmitEvaluationJobResponse(TaskAcceptedResponse):
    evaluation_run_id: str


class SubmitDeploymentJobResponse(TaskAcceptedResponse):
    deployment_id: str
