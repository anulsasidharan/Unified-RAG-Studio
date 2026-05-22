"""MLflow experiment tracking for Autopilot builds (P9-1).

Logs one run per Celery ``run_pipeline_build`` completion (or graph failure) with tags,
flattened parameters, evaluation metrics, optional embedding benchmark scores, and a JSON
artifact of stage outputs. Tracking is best-effort: MLflow or network errors never fail the build.
"""

from __future__ import annotations

import json
from pathlib import Path
import tempfile
from typing import Any

import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)

_PARAM_MAX_LEN = 240
_MAX_PARAMS = 80
_MAX_TAGS = 24


def _clip(s: str, max_len: int = _PARAM_MAX_LEN) -> str:
    s = str(s).strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def _flatten(prefix: str, obj: Any, out: dict[str, str], *, depth: int = 0) -> None:
    if depth > 5 or len(out) >= _MAX_PARAMS:
        return
    if obj is None:
        return
    if isinstance(obj, bool):
        out[prefix] = "true" if obj else "false"
    elif isinstance(obj, int | float):
        out[prefix] = str(obj)
    elif isinstance(obj, str):
        if prefix:
            out[prefix] = _clip(obj)
    elif isinstance(obj, dict):
        for k, v in obj.items():
            if not isinstance(k, str) or k.startswith("_"):
                continue
            key = f"{prefix}.{k}" if prefix else k
            _flatten(key, v, out, depth=depth + 1)
    elif isinstance(obj, list):
        if not obj or len(out) >= _MAX_PARAMS:
            return
        head = obj[:12]
        if all(isinstance(x, str | int | float | bool) or x is None for x in head):
            out[prefix] = _clip(",".join("" if x is None else str(x) for x in head))


def _collect_stage_params(stage_outputs: dict[str, Any], out: dict[str, str]) -> None:
    for stage in ("analyze", "chunking", "embedding", "retrieval", "evaluation", "deployment"):
        payload = stage_outputs.get(stage)
        if not isinstance(payload, dict):
            continue
        base = {k: payload[k] for k in payload if k not in ("per_row_scores", "candidates_tried")}
        _flatten(f"stage.{stage}", base, out)

    emb = stage_outputs.get("embedding")
    if isinstance(emb, dict):
        sel = emb.get("selected")
        if isinstance(sel, dict):
            p, m = str(sel.get("provider") or "").strip(), str(sel.get("model") or "").strip()
            if p:
                out["embedding.selected_provider"] = _clip(p)
            if m:
                out["embedding.selected_model"] = _clip(m)

    chunk = stage_outputs.get("chunking")
    if isinstance(chunk, dict) and isinstance(chunk.get("strategy"), str):
        out["chunking.strategy"] = _clip(chunk["strategy"])

    retr = stage_outputs.get("retrieval")
    if isinstance(retr, dict):
        sel = retr.get("selected")
        if isinstance(sel, dict) and isinstance(sel.get("strategy"), str):
            out["retrieval.strategy"] = _clip(sel["strategy"])


def _collect_metrics(stage_outputs: dict[str, Any]) -> dict[str, float]:
    metrics: dict[str, float] = {}
    ev = stage_outputs.get("evaluation")
    if isinstance(ev, dict):
        m = ev.get("metrics")
        if isinstance(m, dict):
            for key in (
                "faithfulness",
                "answer_relevance",
                "context_precision",
                "context_recall",
                "avg_latency_ms",
            ):
                v = m.get(key)
                if isinstance(v, int | float):
                    metrics[f"eval.{key}"] = float(v)
        if isinstance(ev.get("meets_targets"), bool):
            metrics["eval.meets_targets"] = 1.0 if ev["meets_targets"] else 0.0

    emb = stage_outputs.get("embedding")
    if isinstance(emb, dict):
        rows = emb.get("candidates_tried")
        if isinstance(rows, list):
            for i, r in enumerate(rows[:8]):
                if not isinstance(r, dict) or r.get("error"):
                    continue
                label = f"cand_{i}"
                if isinstance(r.get("composite_score"), int | float):
                    metrics[f"embedding.{label}.composite_score"] = float(r["composite_score"])
                if isinstance(r.get("avg_latency_ms"), int | float):
                    metrics[f"embedding.{label}.avg_latency_ms"] = float(r["avg_latency_ms"])

    dep = stage_outputs.get("deployment")
    if isinstance(dep, dict) and dep.get("status") == "complete":
        metrics["deployment.complete"] = 1.0
    elif isinstance(dep, dict):
        metrics["deployment.complete"] = 0.0

    return metrics


def log_autopilot_build_to_mlflow(
    *,
    build_id: str,
    project_id: str,
    requirements: dict[str, Any],
    stage_outputs: dict[str, Any],
    iteration: int,
    build_status: str,
    error_message: str | None = None,
    result_keys: list[str] | None = None,
) -> str | None:
    """Push a single MLflow run; swallow all errors (build success does not depend on MLflow).

    Returns the MLflow run id when a run is created successfully; otherwise ``None``.
    """
    settings = get_settings()
    if not settings.mlflow_enabled:
        return None

    try:
        import mlflow
    except ImportError:
        logger.warning("mlflow_not_installed")
        return None

    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)

    try:
        mlflow.set_experiment(settings.mlflow_experiment_name)
    except Exception as exc:
        logger.warning("mlflow_set_experiment_failed", error=str(exc))
        return None

    raw_params: dict[str, str] = {}
    _flatten("requirements", requirements, raw_params)
    _collect_stage_params(stage_outputs, raw_params)

    metrics = _collect_metrics(stage_outputs)
    metrics["autopilot.iteration"] = float(max(0, iteration))

    tags: dict[str, str] = {
        "build_id": build_id,
        "project_id": project_id,
        "build_status": build_status,
        "source": "rag-studio-autopilot",
    }
    if error_message:
        tags["error"] = _clip(error_message, 500)

    artifact_payload: dict[str, Any] = {
        "build_id": build_id,
        "project_id": project_id,
        "build_status": build_status,
        "iteration": iteration,
        "requirements": requirements,
        "stage_outputs": stage_outputs,
    }
    if result_keys:
        artifact_payload["normalized_result_top_level_keys"] = result_keys

    run_id: str | None = None
    try:
        with mlflow.start_run(run_name=f"autopilot-{build_id[:8]}"):
            active = mlflow.active_run()
            if active is not None and active.info is not None:
                run_id = active.info.run_id
            for i, (tk, tv) in enumerate(tags.items()):
                if i >= _MAX_TAGS:
                    break
                mlflow.set_tag(tk, _clip(tv, 500))

            for i, (pk, pv) in enumerate(raw_params.items()):
                if i >= _MAX_PARAMS:
                    break
                try:
                    mlflow.log_param(pk, pv)
                except Exception as exc:
                    logger.debug("mlflow_log_param_error", key=pk, error=str(exc))
                    continue

            for mk, mv in metrics.items():
                try:
                    mlflow.log_metric(mk, mv)
                except Exception as exc:
                    logger.debug("mlflow_log_metric_error", key=mk, error=str(exc))
                    continue

            with tempfile.NamedTemporaryFile(
                mode="w",
                suffix=".json",
                delete=False,
                encoding="utf-8",
            ) as tmp:
                json.dump(artifact_payload, tmp, indent=2, default=str)
                tmp_path = tmp.name
            try:
                mlflow.log_artifact(tmp_path, artifact_path="autopilot")
            finally:
                Path(tmp_path).unlink(missing_ok=True)

    except Exception as exc:
        logger.warning("mlflow_log_run_failed", build_id=build_id, error=str(exc))
        return None

    return run_id
