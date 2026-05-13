"""Deployment Agent — packaging previews, IaC sketches, gated cloud deployer stubs (P6-7).

When ``pipeline_config`` validates as ``PipelineConfigurationSchema``, reuse P4 export
generators for Docker Compose, Kubernetes, and Terraform. Otherwise emit compact
**fallback** sketches derived from Autopilot stage selections (embedding, retrieval,
chunking) so CI stays deterministic without a full Designer payload.

Real ``terraform apply`` / cloud provisioning remains operator-gated (see
``cloud_deployers[*].apply_gated``).
"""

from __future__ import annotations

import json
import re
from typing import Any

from pydantic import ValidationError
import structlog

from app.schemas.pipeline import PipelineConfigurationSchema
from app.services.export_generators import (
    generate_docker_compose,
    generate_kubernetes,
    generate_terraform,
)

logger = structlog.get_logger(__name__)


def _slug(name: str) -> str:
    s = re.sub(r"[^\w\s-]", "", name.lower())
    s = re.sub(r"[-\s]+", "-", s).strip("-")
    return s or "rag-pipeline"


def _fallback_sketches(
    *,
    label: str,
    retrieval: dict[str, Any],
    embedding: dict[str, Any],
    chunking: dict[str, Any],
) -> dict[str, str]:
    """Minimal artefacts when no full ``PipelineConfigurationSchema`` is available."""

    slug = _slug(label)
    r_sel = retrieval.get("selected") if isinstance(retrieval.get("selected"), dict) else {}
    e_sel = embedding.get("selected") if isinstance(embedding.get("selected"), dict) else {}
    c_sel = chunking.get("selected") if isinstance(chunking.get("selected"), dict) else {}
    strat = str(r_sel.get("strategy") or "similarity")
    top_k = int(r_sel.get("top_k") or 5)
    emb_model = str(e_sel.get("model") or "text-embedding-3-small")
    ch_strat = str(c_sel.get("strategy") or "recursive-character")

    compose = f"""# Autopilot deployment sketch — {label}
# (fallback; validate in Designer for full export)
name: {slug}
services:
  api:
    image: {slug}-api:latest
    environment:
      - RETRIEVAL_STRATEGY={strat}
      - TOP_K={top_k}
      - EMBEDDING_MODEL={emb_model}
      - CHUNKING_STRATEGY={ch_strat}
    ports:
      - "8000:8000"
"""
    k8s = f"""# Autopilot K8s sketch — {label}
apiVersion: v1
kind: Namespace
metadata:
  name: {slug[:63]}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {slug}-autopilot-hints
data:
  retrieval_strategy: "{strat}"
  top_k: "{top_k}"
  embedding_model: "{emb_model}"
  chunking_strategy: "{ch_strat}"
"""
    tf = f"""# Terraform stub — {label} (no full pipeline config; expand after Designer export)
# Cloud apply is GATED — run ``terraform plan`` only after operator approval.
variable "environment" {{
  type    = string
  default = "staging"
}}

# Placeholder module wiring for RAG API + vector store — replace with modules from Designer export.
output "deployment_note" {{
  value = "Autopilot fallback sketch for {slug}"
}}
"""
    return {"docker_compose": compose, "kubernetes_manifest": k8s, "terraform_stub": tf}


def _cloud_deployer_stubs(*, cloud_hint: str | None) -> dict[str, Any]:
    """Per-provider dry-run placeholders; nothing calls external APIs."""

    base = {
        "aws": {
            "mode": "stub",
            "apply_gated": True,
            "would_run": ["aws sts get-caller-identity", "terraform plan"],
            "documentation": "https://docs.aws.amazon.com/cli/",
        },
        "gcp": {
            "mode": "stub",
            "apply_gated": True,
            "would_run": ["gcloud config list", "terraform plan"],
            "documentation": "https://cloud.google.com/sdk/gcloud",
        },
        "azure": {
            "mode": "stub",
            "apply_gated": True,
            "would_run": ["az account show", "terraform plan"],
            "documentation": "https://learn.microsoft.com/cli/azure/",
        },
    }
    hint = (cloud_hint or "").lower().strip()
    for k in base:
        base[k]["preferred"] = hint in k or (hint == "aws" and k == "aws")
    return base


def run_deployment_agent(
    *,
    evaluation_payload: dict[str, Any],
    retrieval_payload: dict[str, Any],
    chunking_payload: dict[str, Any],
    embedding_payload: dict[str, Any],
    requirements: dict[str, Any],
    pipeline_config: dict[str, Any] | None,
    build_id: str,
    project_id: str,
) -> dict[str, Any]:
    """Produce ``stage_outputs['deployment']`` after upstream stages."""

    if retrieval_payload.get("status") != "complete":
        return {
            "status": "failed",
            "reason": "retrieval_not_complete",
            "artefacts": None,
            "cloud_deployers": None,
        }
    if embedding_payload.get("status") != "complete":
        return {
            "status": "failed",
            "reason": "embedding_not_complete",
            "artefacts": None,
            "cloud_deployers": None,
        }
    if chunking_payload.get("status") != "complete":
        return {
            "status": "failed",
            "reason": "chunking_not_complete",
            "artefacts": None,
            "cloud_deployers": None,
        }

    eval_ok = evaluation_payload.get("status") == "complete"
    warnings: list[str] = []
    if not eval_ok:
        warnings.append(
            "evaluation stage incomplete — artefacts use retrieval/embedding/chunking only"
        )

    cloud_hint: str | None = None
    if isinstance(pipeline_config, dict):
        raw = pipeline_config.get("cloud_provider") or pipeline_config.get("cloudProvider")
        if isinstance(raw, str):
            cloud_hint = raw
    if not cloud_hint:
        tgt = requirements.get("target_cloud")
        cloud_hint = str(tgt) if isinstance(tgt, str) else None

    label = f"build-{build_id[:8]}"
    synthesized_from = "stage_outputs_fallback"
    artefacts: dict[str, str]
    if pipeline_config:
        try:
            cfg = PipelineConfigurationSchema.model_validate(pipeline_config)
            artefacts = {
                "docker_compose": generate_docker_compose(cfg),
                "kubernetes_manifest": generate_kubernetes(cfg),
                "terraform_stub": generate_terraform(cfg),
            }
            synthesized_from = "pipeline_config"
            label = cfg.name
        except ValidationError as exc:
            logger.warning("deployment_agent_pipeline_config_fallback", error=str(exc))
            warnings.append(f"pipeline_config invalid for export generators: {exc}")
            artefacts = _fallback_sketches(
                label=label,
                retrieval=retrieval_payload,
                embedding=embedding_payload,
                chunking=chunking_payload,
            )
    else:
        artefacts = _fallback_sketches(
            label=label,
            retrieval=retrieval_payload,
            embedding=embedding_payload,
            chunking=chunking_payload,
        )

    metrics = (
        evaluation_payload.get("metrics")
        if isinstance(evaluation_payload.get("metrics"), dict)
        else {}
    )
    meets = evaluation_payload.get("meets_targets")
    rationale = (
        f"Packaging preview for **{label}** (synthesized_from={synthesized_from}). "
        f"Compose/K8s/Terraform lengths: "
        f"{len(artefacts['docker_compose'])}/"
        f"{len(artefacts['kubernetes_manifest'])}/"
        f"{len(artefacts['terraform_stub'])} chars. "
    )
    if eval_ok:
        rationale += (
            f"Evaluation proxies: faithfulness≈{metrics.get('faithfulness')}, "
            f"meets_targets={meets}. "
        )
    rationale += "All cloud **apply** paths are stubbed and operator-gated."

    payload: dict[str, Any] = {
        "status": "complete",
        "artefacts": artefacts,
        "artefact_keys": list(artefacts.keys()),
        "cloud_deployers": _cloud_deployer_stubs(cloud_hint=cloud_hint),
        "synthesized_from": synthesized_from,
        "warnings": warnings,
        "rationale": rationale,
        "operator_notes": (
            "Review generated files, inject secrets via vault/CI, then run "
            "`terraform plan` / `kubectl diff` before any apply."
        ),
    }
    logger.info(
        "deployment_agent_complete",
        build_id=build_id,
        synthesized_from=synthesized_from,
        warnings=len(warnings),
    )
    return payload


def human_readable_deployment_message(payload: dict[str, Any]) -> str:
    if payload.get("status") != "complete":
        return f"Deployment agent: **failed** — {payload.get('reason', 'unknown')}."

    src = payload.get("synthesized_from")
    keys = payload.get("artefact_keys") or []
    w = payload.get("warnings") or []
    extra = f" ({len(w)} warning(s))" if w else ""
    return (
        f"Deployment agent: artefacts ready ({', '.join(keys)}) "
        f"from **{src}**; cloud deployers are stubbed/gated{extra}."
    )


def run_deployment_agent_from_json(
    evaluation_json: str,
    retrieval_json: str,
    chunking_json: str,
    embedding_json: str,
    requirements_json: str,
    pipeline_config_json: str,
    build_id: str,
    project_id: str,
) -> str:
    """JSON in / JSON out for LangChain tools."""

    def _loads(label: str, raw: str) -> dict[str, Any]:
        try:
            obj = json.loads(raw) if raw.strip() else {}
        except json.JSONDecodeError as exc:
            return {"__error__": f"invalid {label}", "detail": str(exc)}
        if not isinstance(obj, dict):
            return {"__error__": f"{label} must be a JSON object"}
        return obj

    evaluation = _loads("evaluation_json", evaluation_json)
    if "__error__" in evaluation:
        return json.dumps(evaluation, ensure_ascii=False)

    retrieval = _loads("retrieval_json", retrieval_json)
    if "__error__" in retrieval:
        return json.dumps(retrieval, ensure_ascii=False)

    chunking = _loads("chunking_json", chunking_json)
    if "__error__" in chunking:
        return json.dumps(chunking, ensure_ascii=False)

    embedding = _loads("embedding_json", embedding_json)
    if "__error__" in embedding:
        return json.dumps(embedding, ensure_ascii=False)

    req = _loads("requirements_json", requirements_json)
    if "__error__" in req:
        return json.dumps(req, ensure_ascii=False)

    pipe_raw = pipeline_config_json.strip()
    pipeline_config: dict[str, Any] | None = None
    if pipe_raw:
        try:
            p = json.loads(pipe_raw)
        except json.JSONDecodeError as exc:
            return json.dumps({"error": "invalid pipeline_config_json", "detail": str(exc)})
        pipeline_config = p if isinstance(p, dict) else None

    payload = run_deployment_agent(
        evaluation_payload=dict(evaluation),
        retrieval_payload=dict(retrieval),
        chunking_payload=dict(chunking),
        embedding_payload=dict(embedding),
        requirements=dict(req),
        pipeline_config=pipeline_config,
        build_id=build_id,
        project_id=project_id,
    )
    return json.dumps(payload, ensure_ascii=False)
