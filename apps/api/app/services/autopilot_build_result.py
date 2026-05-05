"""Compose ``BuildResultSchema`` from orchestrator ``stage_outputs`` (P7-6).

The worker historically persisted only diagnostic keys on ``AutopilotBuild.result``;
this module synthesises a **typed** ``config`` / ``metrics`` / ``decisions`` /
``deployment`` bundle so ``GET /api/autopilot/build/{id}`` can populate ``result``
for the Decision Explainer and Results Summary UI.
"""

from __future__ import annotations

import copy
from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError
import structlog

from app.schemas.autopilot import BuildResultSchema
from app.schemas.pipeline import (
    ChunkingStrategy,
    CloudProvider,
    EmbeddingProvider,
    PipelineConfigurationSchema,
    RetrievalStrategy,
)

logger = structlog.get_logger(__name__)


def _iso_now() -> str:
    return datetime.now(UTC).isoformat()


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def _coerce_chunking_strategy(raw: str) -> str:
    allowed = {e.value for e in ChunkingStrategy}
    if raw in allowed:
        return raw
    return ChunkingStrategy.RECURSIVE_CHARACTER.value


def _coerce_retrieval_strategy(raw: str) -> str:
    allowed = {e.value for e in RetrievalStrategy}
    if raw in allowed:
        return raw
    return RetrievalStrategy.SIMILARITY.value


def _coerce_embedding_provider(raw: str) -> str:
    allowed = {e.value for e in EmbeddingProvider}
    low = str(raw or "").strip().lower()
    if low in allowed:
        return low
    return EmbeddingProvider.OPENAI.value


def _coerce_cloud_provider(raw: str | None) -> str:
    if not raw:
        return CloudProvider.AWS.value
    low = str(raw).strip().lower().replace("-", "_")
    mapping = {
        "aws": CloudProvider.AWS.value,
        "gcp": CloudProvider.GCP.value,
        "azure": CloudProvider.AZURE.value,
        "multi_cloud": CloudProvider.MULTI_CLOUD.value,
        "multi-cloud": CloudProvider.MULTI_CLOUD.value,
    }
    return mapping.get(low, CloudProvider.AWS.value)


def _default_pipeline_shell(
    *,
    build_id: str,
    cloud_provider: str,
) -> dict[str, Any]:
    now = _iso_now()
    return {
        "id": f"autopilot-{build_id}",
        "name": f"Autopilot build {build_id[:8]}",
        "description": "Synthesised from Autopilot stage outputs (P7-6).",
        "cloud_provider": cloud_provider,
        "stages": {
            "chunking": {
                "strategy": "recursive-character",
                "chunk_size": 512,
                "chunk_overlap": 50,
            },
            "embedding": {
                "model": "text-embedding-3-small",
                "provider": "openai",
                "dimensions": 1536,
            },
            "vector_store": {
                "provider": "qdrant",
                "index_name": f"autopilot-{build_id[:8]}",
            },
            "retrieval": {
                "strategy": "similarity",
                "top_k": 5,
            },
            "generation": {
                "model": "gpt-4o-mini",
                "provider": "openai",
                "temperature": 0.7,
                "max_tokens": 1024,
            },
        },
        "metadata": {
            "created_at": now,
            "updated_at": now,
            "version": "1.0.0",
            "source": "autopilot",
            "build_id": build_id,
        },
    }


def _deep_merge_pipeline(base: dict[str, Any], patch_stages: dict[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    stages = out.setdefault("stages", {})
    for key, val in patch_stages.items():
        if isinstance(val, dict) and isinstance(stages.get(key), dict):
            stages[key] = {**stages[key], **val}
        else:
            stages[key] = val
    return out


def _embedding_benchmark_rows(candidates: list[Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not isinstance(candidates, list):
        return rows
    for r in candidates:
        if not isinstance(r, dict) or r.get("error"):
            continue
        prov = str(r.get("provider") or "").strip().lower()
        mod = str(r.get("model") or "").strip()
        label = f"{prov}/{mod}".strip("/") if prov else mod
        if not label:
            continue
        comp = r.get("composite_score")
        score = 0.5
        if isinstance(comp, int | float):
            score = _clamp01(float(comp))
        lat = r.get("avg_latency_ms")
        latency_ms = float(lat) if isinstance(lat, int | float) else 0.0
        cost = float(r.get("cost_per_1m_tokens") or r.get("costPer1MTokens") or 0.0)
        if cost < 0:
            cost = 0.0
        rows.append(
            {
                "model": label,
                "score": score,
                "cost_per_1m_tokens": cost,
                "latency_ms": latency_ms,
            },
        )
    return rows


def compose_build_result_payload(
    *,
    build_id: str,
    stage_outputs: dict[str, Any],
    base_pipeline_config: dict[str, Any] | None,
    requirements: dict[str, Any],
    total_iterations: int,
) -> dict[str, Any] | None:
    """Return JSON-compatible dict validated by ``BuildResultSchema``, or ``None`` if impossible."""

    reqs = dict(requirements or {})
    cloud_hint = reqs.get("cloud_provider") or reqs.get("cloudProvider")
    cloud = _coerce_cloud_provider(str(cloud_hint) if cloud_hint is not None else None)

    shell = _default_pipeline_shell(build_id=build_id, cloud_provider=cloud)
    base_cfg: dict[str, Any] = shell
    if isinstance(base_pipeline_config, dict) and base_pipeline_config:
        try:
            validated_base = PipelineConfigurationSchema.model_validate(base_pipeline_config)
            base_cfg = validated_base.model_dump(mode="python")
        except ValidationError as exc:
            logger.warning("autopilot_build_result_base_config_invalid", error=str(exc))

    patch_stages: dict[str, Any] = {}

    ch = stage_outputs.get("chunking")
    if isinstance(ch, dict) and ch.get("status") == "complete":
        sel = ch.get("selected")
        if isinstance(sel, dict):
            strat_raw = str(sel.get("strategy") or "recursive-character")
            patch_stages["chunking"] = {
                "strategy": _coerce_chunking_strategy(strat_raw),
                "chunk_size": int(sel.get("chunk_size") or 512),
                "chunk_overlap": int(sel.get("chunk_overlap") or 50),
            }

    emb = stage_outputs.get("embedding")
    if isinstance(emb, dict) and emb.get("status") == "complete":
        sel = emb.get("selected")
        if isinstance(sel, dict):
            prov = _coerce_embedding_provider(str(sel.get("provider") or "openai"))
            patch_stages["embedding"] = {
                "model": str(sel.get("model") or "text-embedding-3-small"),
                "provider": prov,
                "dimensions": int(sel.get("dimensions") or 1536),
            }

    ret = stage_outputs.get("retrieval")
    if isinstance(ret, dict) and ret.get("status") == "complete":
        sel = ret.get("selected")
        if isinstance(sel, dict):
            strat = _coerce_retrieval_strategy(str(sel.get("strategy") or "similarity"))
            rc: dict[str, Any] = {
                "strategy": strat,
                "top_k": int(sel.get("top_k") or 5),
            }
            if strat == "hybrid":
                ha = sel.get("hybrid_alpha")
                if isinstance(ha, int | float):
                    rc["hybrid_search"] = {"alpha": float(ha)}
            if sel.get("reranking_enabled"):
                patch_stages["reranking"] = {
                    "enabled": True,
                    "model": "rerank-english-v3.0",
                    "top_n": int(sel.get("rerank_top_n") or 5),
                    "provider": "cohere",
                }
            patch_stages["retrieval"] = rc

    merged = _deep_merge_pipeline(base_cfg, patch_stages)
    merged["metadata"] = {
        **(merged.get("metadata") or {}),
        "updated_at": _iso_now(),
        "source": "autopilot",
        "build_id": build_id,
    }

    try:
        config = PipelineConfigurationSchema.model_validate(merged)
    except ValidationError as exc:
        logger.warning("autopilot_build_result_config_failed", error=str(exc))
        return None

    gen_stage = config.stages.generation

    ev = stage_outputs.get("evaluation")
    metrics_src: dict[str, Any] = {}
    if isinstance(ev, dict) and isinstance(ev.get("metrics"), dict):
        metrics_src = dict(ev["metrics"])

    faith = float(metrics_src.get("faithfulness") or 0.5)
    ar = float(metrics_src.get("answer_relevance") or metrics_src.get("answer_relevancy") or 0.5)
    cp = float(metrics_src.get("context_precision") or 0.5)
    cr = float(metrics_src.get("context_recall") or 0.5)
    lat = metrics_src.get("avg_latency_ms")
    avg_latency = float(lat) if isinstance(lat, int | float) else None

    metrics = {
        "faithfulness": _clamp01(faith),
        "answer_relevance": _clamp01(ar),
        "context_precision": _clamp01(cp),
        "context_recall": _clamp01(cr),
        "avg_latency_ms": avg_latency,
        "cost_per_query": None,
    }

    decisions: dict[str, Any] = {}

    if isinstance(ch, dict) and ch.get("status") == "complete":
        sel = ch.get("selected")
        if isinstance(sel, dict):
            alts = ch.get("alternatives_tested")
            if not isinstance(alts, list):
                alts = []
            ch_st = patch_stages.get("chunking") or {}
            ch_strat = str(sel.get("strategy") or ch_st.get("strategy") or "recursive-character")
            decisions["chunking"] = {
                "strategy": ch_strat,
                "chunk_size": int(sel.get("chunk_size") or 512),
                "reasoning": str(sel.get("rationale") or "Chunking optimiser selection."),
                "alternatives_tested": [str(x) for x in alts],
            }

    if isinstance(emb, dict) and emb.get("status") == "complete":
        sel = emb.get("selected")
        if isinstance(sel, dict):
            benches = _embedding_benchmark_rows(list(emb.get("candidates_tried") or []))
            if not benches:
                prov = str(sel.get("provider") or "openai")
                mod = str(sel.get("model") or "unknown")
                benches = [
                    {
                        "model": f"{prov}/{mod}",
                        "score": _clamp01(float(sel.get("composite_score") or 0.5)),
                        "cost_per_1m_tokens": 0.0,
                        "latency_ms": float(sel.get("avg_latency_ms") or 0.0),
                    },
                ]
            decisions["embedding"] = {
                "model": str(sel.get("model") or ""),
                "reasoning": str(sel.get("rationale") or "Embedding tester selection."),
                "benchmark_results": benches,
            }

    if isinstance(ret, dict) and ret.get("status") == "complete":
        sel = ret.get("selected")
        if isinstance(sel, dict):
            perf: dict[str, float] = {}
            mrr = sel.get("mrr")
            if isinstance(mrr, int | float):
                perf["mrr"] = float(mrr)
            cs = sel.get("composite_score")
            if isinstance(cs, int | float):
                perf["composite_score"] = float(cs)
            decisions["retrieval"] = {
                "strategy": str(sel.get("strategy") or "similarity"),
                "top_k": int(sel.get("top_k") or 5),
                "reasoning": str(sel.get("rationale") or "Retrieval optimiser selection."),
                "performance": perf,
                "reranking_enabled": bool(sel.get("reranking_enabled")),
            }

    decisions["generation"] = {
        "model": str(gen_stage.model),
        "reasoning": "Generation parameters are carried from the merged pipeline configuration "
        "(the Autopilot LangGraph does not mutate the generation stage in v1).",
    }

    dep = stage_outputs.get("deployment")
    deployment: dict[str, Any] | None = None
    if isinstance(dep, dict) and dep.get("status") == "complete":
        artefacts: dict[str, str] = {}
        raw_art = dep.get("artefacts")
        if isinstance(raw_art, dict):
            for k in ("docker_compose", "kubernetes_manifest", "terraform_stub"):
                if isinstance(raw_art.get(k), str):
                    artefacts[k] = raw_art[k]
        deployment = {
            "provider": cloud,
            "status": "preview",
            "artefacts": artefacts,
            "synthesized_from": dep.get("synthesized_from", "stage_outputs_fallback"),
            "operator_notes": dep.get("operator_notes", ""),
            "warnings": dep.get("warnings") or [],
        }

    raw_result: dict[str, Any] = {
        "config": config.model_dump(mode="json", by_alias=True),
        "metrics": metrics,
        "decisions": decisions,
        "deployment": deployment,
        "total_iterations": max(1, int(total_iterations)),
    }

    try:
        return BuildResultSchema.model_validate(raw_result).model_dump(mode="json", by_alias=True)
    except ValidationError as exc:
        logger.warning("autopilot_build_result_validate_failed", error=str(exc))
        return None
