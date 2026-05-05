"""Celery task definitions — build, evaluation, deployment jobs (P2-8).

Long-running orchestration executes in worker processes via Redis; FastAPI stays
responsive by enqueueing work and exposing status via AsyncResult IDs.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import structlog

from langchain_core.messages import AIMessage

from app.core.agents.graph import invoke_autopilot_orchestrator
from app.core.agents.state import AUTOPILOT_STAGE_ORDER, initial_autopilot_graph_state
from app.core.evaluation.service import EvaluationEngine
from app.core.evaluation.strategies import EvaluationExample
from app.models import AutopilotBuild, Deployment, EvaluationRun
from app.config import get_settings
from app.observability.rag_metrics import (
    record_autopilot_terminal,
    record_evaluation_terminal,
)
from app.services.autopilot_build_result import compose_build_result_payload
from app.services.mlflow_tracking import log_autopilot_build_to_mlflow

from app.worker.celery_app import celery_app
from app.worker.db_sync import sync_session_scope

logger = structlog.get_logger(__name__)


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


_AUTOPILOT_STAGE_KEYS = AUTOPILOT_STAGE_ORDER


def _compact_stage_outputs(stage_outputs: dict[str, Any] | None) -> dict[str, Any]:
    """Strip very large lists before persisting onto ``AutopilotBuild.result``."""

    out: dict[str, Any] = {}
    for key, val in (stage_outputs or {}).items():
        if not isinstance(val, dict):
            out[key] = val
            continue
        slim = {k: v for k, v in val.items() if k != "per_row_scores"}
        out[key] = slim
    return out


def _stages_from_graph(stage_outputs: dict[str, Any] | None) -> dict[str, Any]:
    """Align ``row.stages`` keys with ``AUTOPILOT_STAGE_ORDER`` for the status API."""

    so = dict(stage_outputs or {})
    stages: dict[str, Any] = {}
    for stage in _AUTOPILOT_STAGE_KEYS:
        if stage == "generation":
            stages[stage] = {
                "status": "complete",
                "started_at": None,
                "completed_at": _iso_now(),
                "message": "Generation config remains Designer-led; graph runs analyze→deployment (P6-8).",
            }
            continue
        payload = so.get(stage)
        if not isinstance(payload, dict):
            stages[stage] = {
                "status": "pending",
                "started_at": None,
                "completed_at": None,
                "message": None,
            }
            continue
        ok = payload.get("status") == "complete"
        stages[stage] = {
            "status": "complete" if ok else "failed",
            "started_at": None,
            "completed_at": _iso_now(),
            "message": (payload.get("rationale") or payload.get("reason") or stage)[:500],
        }
    return stages


@celery_app.task(bind=True, name="jobs.run_pipeline_build")
def run_pipeline_build(self, build_id: str) -> dict[str, Any]:
    """Run the P6-8 LangGraph orchestrator and persist trace, stages, and progress onto the build row."""
    try:
        bid = uuid.UUID(build_id)
    except ValueError:
        return {"build_id": build_id, "status": "failed", "error": "invalid build_id UUID"}

    snapshot: dict[str, Any] = {}
    with sync_session_scope() as session:
        row = session.get(AutopilotBuild, bid)
        if row is None:
            logger.warning("build_not_found", build_id=build_id)
            return {"build_id": build_id, "status": "failed", "error": "build not found"}

        if row.status == "cancelled":
            logger.info("build_skipped_already_cancelled", build_id=build_id)
            return {"build_id": build_id, "status": "cancelled"}

        row.status = "running"
        row.current_stage = "orchestrate"
        row.messages = list(row.messages or [])
        row.messages.append(
            {"timestamp": _iso_now(), "text": "Build job started", "type": "info", "agent": "orchestrator"},
        )
        reqs = dict(row.requirements or {})
        snapshot = {
            "requirements": reqs,
            "project_id": str(row.project_id),
            "document_ids": [str(x) for x in (reqs.get("document_ids") or [])],
            "pipeline_config": reqs.get("base_config") if isinstance(reqs.get("base_config"), dict) else None,
        }

    graph_state = initial_autopilot_graph_state(
        build_id=str(bid),
        project_id=str(snapshot["project_id"]),
        document_ids=list(snapshot["document_ids"]),
        requirements=dict(snapshot["requirements"]),
        pipeline_config=snapshot.get("pipeline_config"),
    )

    try:
        final = invoke_autopilot_orchestrator(graph_state, checkpointer=None)
    except Exception as exc:
        logger.exception("run_pipeline_build_graph_failed", build_id=build_id)
        with sync_session_scope() as session:
            row = session.get(AutopilotBuild, bid)
            if row and row.status == "cancelled":
                return {"build_id": build_id, "status": "cancelled"}
            if row:
                row.status = "failed"
                row.error = str(exc)
                row.completed_at = datetime.now(timezone.utc)
        record_autopilot_terminal("failed")
        log_autopilot_build_to_mlflow(
            build_id=str(bid),
            project_id=str(snapshot.get("project_id") or ""),
            requirements=dict(snapshot.get("requirements") or {}),
            stage_outputs={},
            iteration=0,
            build_status="failed",
            error_message=str(exc),
        )
        return {"build_id": build_id, "status": "failed", "error": str(exc)}

    traces: list[dict[str, Any]] = list(final.get("agent_trace") or [])
    stage_outputs = final.get("stage_outputs") if isinstance(final.get("stage_outputs"), dict) else {}
    progress_vals = [t["progress"] for t in traces if isinstance(t.get("progress"), int)]
    last_progress = max(progress_vals) if progress_vals else 0

    new_messages: list[dict[str, Any]] = []
    for m in final.get("messages") or []:
        if isinstance(m, AIMessage) and m.content:
            new_messages.append(
                {
                    "timestamp": _iso_now(),
                    "text": str(m.content)[:4000],
                    "type": "info",
                    "agent": "orchestrator",
                },
            )
    for t in traces:
        if t.get("event") != "orchestration_gate":
            continue
        evt = "orchestration_gate"
        pct = t.get("progress")
        detail = str(t.get("detail") or t.get("reason") or t.get("decision") or evt)[:400]
        suffix = f" — {pct}%" if isinstance(pct, int) else ""
        new_messages.append(
            {
                "timestamp": _iso_now(),
                "text": f"{evt}{suffix}: {detail}",
                "type": "info",
                "agent": "orchestrator",
            },
        )

    with sync_session_scope() as session:
        row = session.get(AutopilotBuild, bid)
        if row is None:
            return {"build_id": build_id, "status": "failed", "error": "build not found"}
        if row.status == "cancelled":
            logger.info("build_cancelled_before_persist", build_id=build_id)
            return {"build_id": build_id, "status": "cancelled"}
        row.status = "complete"
        dep_ok = (stage_outputs.get("deployment") or {}).get("status") == "complete"
        row.progress = 100 if final.get("current_stage") == "deployment_complete" or dep_ok else last_progress
        row.current_stage = str(final.get("current_stage") or "done")
        total_iter = int(final.get("evaluation_pass_index") or 0) + 1
        row.iteration = total_iter
        row.stages = _stages_from_graph(stage_outputs)
        merged_msgs = list(row.messages or [])
        merged_msgs.extend(new_messages)
        row.messages = merged_msgs
        compact_outputs = _compact_stage_outputs(stage_outputs)
        prev = dict(row.result or {})
        prev.update(
            {
                "autopilot_graph": True,
                "stub": False,
                "pipeline_ready": (stage_outputs.get("deployment") or {}).get("status") == "complete",
                "final_stage": row.current_stage,
                "stage_outputs": compact_outputs,
            },
        )
        norm = compose_build_result_payload(
            build_id=str(bid),
            stage_outputs=compact_outputs,
            base_pipeline_config=snapshot.get("pipeline_config"),
            requirements=dict(snapshot.get("requirements") or {}),
            total_iterations=total_iter,
        )
        if norm:
            prev.update(norm)

        mlflow_rid = log_autopilot_build_to_mlflow(
            build_id=str(bid),
            project_id=str(snapshot.get("project_id") or ""),
            requirements=dict(snapshot.get("requirements") or {}),
            stage_outputs=dict(compact_outputs),
            iteration=total_iter,
            build_status="complete",
            result_keys=list(prev.keys()),
        )
        if mlflow_rid:
            cfg = get_settings()
            prev["mlflow_run_id"] = mlflow_rid
            prev["mlflow_tracking_uri"] = cfg.mlflow_tracking_uri
            prev["mlflow_experiment_name"] = cfg.mlflow_experiment_name

        row.result = prev
        row.completed_at = datetime.now(timezone.utc)
        row.error = None

    record_autopilot_terminal("complete")
    logger.info("build_complete_graph", build_id=build_id, trace_events=len(traces))
    return {"build_id": build_id, "status": "complete"}


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
        record_evaluation_terminal("failed")
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
        record_evaluation_terminal("failed")
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

    record_evaluation_terminal("complete")
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
