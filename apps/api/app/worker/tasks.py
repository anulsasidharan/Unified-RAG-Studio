"""Celery task definitions — build, evaluation, deployment jobs (P2-8).

Long-running orchestration executes in worker processes via Redis; FastAPI stays
responsive by enqueueing work and exposing status via AsyncResult IDs.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import structlog

from app.core.agents.state import AUTOPILOT_STAGE_ORDER
from app.core.evaluation.service import EvaluationEngine
from app.core.evaluation.strategies import EvaluationExample
from app.models import AutopilotBuild, Deployment, EvaluationRun

from app.worker.celery_app import celery_app
from app.worker.db_sync import sync_session_scope

logger = structlog.get_logger(__name__)


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Stages iterated for Autopilot build progress until the LangGraph orchestrator replaces this stub (Phase 6).
_AUTOPILOT_STAGE_KEYS = AUTOPILOT_STAGE_ORDER


@celery_app.task(bind=True, name="jobs.run_pipeline_build")
def run_pipeline_build(self, build_id: str) -> dict[str, Any]:
    """Advance an Autopilot build row through stubbed stages — real LangGraph replaces this in Phase 6."""
    try:
        bid = uuid.UUID(build_id)
    except ValueError:
        return {"build_id": build_id, "status": "failed", "error": "invalid build_id UUID"}

    with sync_session_scope() as session:
        row = session.get(AutopilotBuild, bid)
        if row is None:
            logger.warning("build_not_found", build_id=build_id)
            return {"build_id": build_id, "status": "failed", "error": "build not found"}

        row.status = "running"
        row.current_stage = "orchestrate"
        row.messages = list(row.messages or [])
        row.messages.append(
            {"timestamp": _iso_now(), "text": "Build job started", "type": "info", "agent": "orchestrator"},
        )

    completed = len(_AUTOPILOT_STAGE_KEYS)

    for i, stage in enumerate(_AUTOPILOT_STAGE_KEYS, start=1):
        with sync_session_scope() as session:
            row = session.get(AutopilotBuild, bid)
            if row is None:
                return {"build_id": build_id, "status": "failed", "error": "build disappeared mid-job"}
            row.progress = min(100, int(100 * i / completed))
            row.current_stage = stage
            row.iteration = 1

            stages: dict[str, Any] = dict(row.stages or {})
            stages[stage] = {
                "status": "complete",
                "started_at": None,
                "completed_at": _iso_now(),
                "message": f"stub stage [{stage}]",
            }
            row.stages = stages

            row.messages.append(
                {
                    "timestamp": _iso_now(),
                    "text": f"completed stage={stage}",
                    "type": "success",
                    "agent": stage,
                },
            )

    with sync_session_scope() as session:
        row = session.get(AutopilotBuild, bid)
        if row is None:
            return {"build_id": build_id, "status": "failed", "error": "build not found"}
        row.status = "complete"
        row.progress = 100
        row.current_stage = "done"
        row.completed_at = datetime.now(timezone.utc)
        row.result = dict(row.result or {})
        row.result.setdefault("stub", True)
        row.result.setdefault("pipeline_ready", False)
        logger.info("build_complete_stub", build_id=build_id)
        return {"build_id": build_id, "status": row.status}


@celery_app.task(bind=True, name="jobs.run_evaluation")
def run_evaluation(
    self,
    evaluation_run_id: str,
    examples: list[dict[str, Any]],
    *,
    metric_names: list[str] | None = None,
) -> dict[str, Any]:
    """Persist RAGAS output onto ``EvaluationRun`` when examples are supplied in the enqueue payload."""

    try:
        eid = uuid.UUID(evaluation_run_id)
    except ValueError:
        return {"evaluation_run_id": evaluation_run_id, "status": "failed", "error": "invalid UUID"}

    if not examples:
        with sync_session_scope() as session:
            row = session.get(EvaluationRun, eid)
            if row:
                row.status = "failed"
                row.error = "No evaluation examples supplied to worker task."
        return {"evaluation_run_id": evaluation_run_id, "status": "failed", "error": "empty examples"}

    ex_models: list[EvaluationExample] = []
    for rec in examples:
        ctx_raw = rec.get("contexts")
        if ctx_raw is None and "context" in rec:
            c = rec.get("context")
            ctx_raw = c if isinstance(c, list) else ([c] if c else [])
        contexts = ctx_raw if isinstance(ctx_raw, list) else []

        ex_models.append(
            EvaluationExample(
                question=str(rec.get("question") or ""),
                answer=str(rec.get("answer") or ""),
                contexts=[str(x) for x in contexts],
                ground_truth=str(rec.get("ground_truth") or ""),
            ),
        )

    with sync_session_scope() as session:
        row = session.get(EvaluationRun, eid)
        if row is None:
            logger.warning("evaluation_run_not_found", evaluation_run_id=evaluation_run_id)
            return {"evaluation_run_id": evaluation_run_id, "status": "failed", "error": "run not found"}
        row.status = "running"

    try:
        engine = EvaluationEngine()
        outcome = engine.evaluate(ex_models, metric_names=metric_names)
    except Exception as exc:
        logger.exception("evaluation_failed", evaluation_run_id=evaluation_run_id)
        with sync_session_scope() as session:
            row = session.get(EvaluationRun, eid)
            if row:
                row.status = "failed"
                row.error = str(exc)
        raise

    metrics_dump = outcome.metrics.model_dump(mode="json")

    with sync_session_scope() as session:
        row = session.get(EvaluationRun, eid)
        if row is None:
            return {"evaluation_run_id": evaluation_run_id, "status": "failed", "error": "run not found"}
        row.status = "complete"
        row.metrics = metrics_dump
        row.failure_analysis = (
            outcome.failure_analysis.model_dump(mode="json") if outcome.failure_analysis else None
        )
        row.test_set_size = len(examples)
        row.completed_at = datetime.now(timezone.utc)
        row.error = None

    return {
        "evaluation_run_id": evaluation_run_id,
        "status": "complete",
        "metrics": metrics_dump,
    }


@celery_app.task(bind=True, name="jobs.run_deployment")
def run_deployment(self, deployment_id: str) -> dict[str, Any]:
    """Marks deployment as progressing then stub-deployed — Terraform/K8s generation lands in Phase 6/12."""

    try:
        did = uuid.UUID(deployment_id)
    except ValueError:
        return {"deployment_id": deployment_id, "status": "failed", "error": "invalid UUID"}

    with sync_session_scope() as session:
        row = session.get(Deployment, did)
        if row is None:
            logger.warning("deployment_not_found", deployment_id=deployment_id)
            return {"deployment_id": deployment_id, "status": "failed", "error": "deployment not found"}

        row.status = "deploying"
        row.endpoint = f"https://stub.rag-studio.local/deployments/{deployment_id}"
        row.health_check_url = f"{row.endpoint}/healthz"
        row.docker_image_tag = row.docker_image_tag or "rag-studio-api:stub"
        row.deployed_at = datetime.now(timezone.utc)
        row.status = "deployed"
        row.deployment_info = dict(row.deployment_info or {})
        row.deployment_info["stub"] = True

        logger.info("deployment_stub_complete", deployment_id=deployment_id)
        return {"deployment_id": deployment_id, "status": row.status, "endpoint": row.endpoint}
