"""Pipeline cost estimation from ``data/pricing.json`` (P4-3).

Formulas align with ``costCalculatorFormulas`` in the pricing catalog:
  - Embedding (query path): retrieved context token estimate × embedding $/1M tokens
  - Storage: corpus vector footprint × vector-store $/GB/month
  - Retrieval: provider read/query units where priced (Pinecone, Vertex AI Vector Search)
  - Reranking: catalog ``costPer1KQueries`` scaled per query; optional ``top_k`` factor for
    paid APIs billed per candidate document (approximation)
  - Generation: context (retrieval + user prompt) × input $/1M + output × output $/1M
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import json
from numbers import Real
from pathlib import Path
import re

from app.config import Settings, get_settings
from app.schemas.designer import CostRequest
from app.schemas.pipeline import (
    CostBreakdownSchema,
    CostEstimateSchema,
    PipelineConfigurationSchema,
    RetrievalStrategy,
)


class PricingLoadError(OSError):
    """Raised when no pricing catalogue can be resolved on disk."""


def _resolver_paths(settings: Settings) -> list[Path]:
    if settings.pricing_catalog_path.strip():
        return [Path(settings.pricing_catalog_path).expanduser().resolve()]
    pkg_api = Path(__file__).resolve().parents[2]  # apps/api
    return [
        pkg_api / "catalogs" / "pricing.json",
        pkg_api.parent.parent / "data" / "pricing.json",
    ]


@lru_cache(maxsize=8)
def _load_json(path_str: str) -> dict[str, object]:
    with Path(path_str).open(encoding="utf-8") as fh:
        return json.load(fh)


def load_pricing(settings: Settings | None = None) -> dict[str, object]:
    """Load ``pricing.json`` from configured path or default search order."""
    cfg = settings or get_settings()
    for candidate in _resolver_paths(cfg):
        try:
            if candidate.is_file():
                return _load_json(str(candidate))
        except OSError:
            continue
    raise PricingLoadError(
        "pricing.json not found — set PRICING_CATALOG_PATH or keep apps/api/catalogs/pricing.json",
    )


def invalidate_pricing_cache() -> None:
    _load_json.cache_clear()


def _dig(d: dict[str, object] | object, key: str) -> dict[str, object]:
    if isinstance(d, dict):
        inner = d.get(key)
        if isinstance(inner, dict):
            return inner
    return {}


def _models_block(pricing: dict[str, object], section: str) -> dict[str, object]:
    return _dig(_dig(pricing, section), "models")


def _json_float(mapping: dict[str, object], key: str, default: float) -> float:
    v = mapping.get(key, default)
    if isinstance(v, Real):
        return float(v)
    if isinstance(v, str):
        try:
            return float(v.strip())
        except (TypeError, ValueError, OverflowError):
            return default
    return default


def _normalize_model_key(model_id: str) -> str:
    s = model_id.strip()
    if not s:
        return s
    lowered = s.lower().replace("_", "-")
    # pricing.json uses all-minilm-l6-v2
    if "minilm" in lowered:
        return re.sub(r"all-[^-]+-l6-v2", "all-minilm-l6-v2", lowered, flags=re.I)
    return lowered


@dataclass
class _Totals:
    embedding: float = 0.0
    storage: float = 0.0
    retrieval: float = 0.0
    reranking: float = 0.0
    generation: float = 0.0


def _retrieval_variant_multiplier(stages: object) -> float:
    """Extra retrieval / embedding work for multi-query and ensemble strategies."""
    r = getattr(stages, "retrieval", None)
    if r is None:
        return 1.0
    strat = r.strategy
    strat_val = strat.value if hasattr(strat, "value") else str(strat)
    m = 1.0
    if strat_val == RetrievalStrategy.MULTI_QUERY.value:
        mq = r.multi_query_config
        if mq is not None and mq.num_variants >= 1:
            m *= float(mq.num_variants)
    elif strat_val == RetrievalStrategy.ENSEMBLE.value:
        m *= 1.25
    elif strat_val == RetrievalStrategy.HYBRID.value:
        m *= 1.1
    return m


def calculate_cost(body: CostRequest, pricing: dict[str, object]) -> CostEstimateSchema:
    """Compute ``CostEstimateSchema`` from a validated request and loaded pricing dict."""
    return CostEstimator(pricing).estimate(body)


class CostEstimator:
    """Heuristic calculator aligned with ``costCalculatorFormulas`` in pricing.json."""

    def __init__(self, pricing: dict[str, object]) -> None:
        self._p = pricing

    def estimate(self, body: CostRequest) -> CostEstimateSchema:
        qp_m = float(body.queries_per_month)
        doc_n = float(body.documents_count)
        doc_tokens = float(body.avg_document_tokens)

        _raw_ass = self._p.get("assumptions")
        ass: dict[str, object] = {**_raw_ass} if isinstance(_raw_ass, dict) else {}
        avg_in_ass = _json_float(ass, "avgInputTokensPerQuery", 500.0)
        avg_out_ass = _json_float(ass, "avgOutputTokensPerQuery", 300.0)

        stages = body.config.stages
        chunk_sz = float(stages.chunking.chunk_size)
        top_k = float(stages.retrieval.top_k)
        emb_dims = float(stages.embedding.dimensions)

        variant_m = _retrieval_variant_multiplier(stages)

        emb_model = _normalize_model_key(stages.embedding.model)
        gen_model = stages.generation.model
        embed_1m = self._embedding_rate(emb_model)
        in_gen, out_gen = self._generation_rates(gen_model)

        # Query-path embedding: approximate tokens = top_k chunk windows (see pricing.json formula)
        embedding_per_query = (top_k * chunk_sz / 1_000_000.0) * embed_1m * variant_m

        max_out = float(stages.generation.max_tokens)
        eff_out = min(avg_out_ass, max_out) if max_out > 0 else avg_out_ass
        context_tokens_per_q = top_k * chunk_sz + avg_in_ass
        generation_per_query = (context_tokens_per_q / 1_000_000.0) * in_gen + (
            eff_out / 1_000_000.0
        ) * out_gen

        rerank_per_query = 0.0
        if stages.reranking and stages.reranking.enabled and stages.reranking.model:
            rerank_per_query = self._rerank_per_query_cost(stages.reranking.model)

        total_doc_tokens = doc_n * doc_tokens
        gb = total_doc_tokens / max(chunk_sz, 1.0) * emb_dims * 4.0 / (1024.0**3)
        prov_key = stages.vector_store.provider
        vs_provider = prov_key.value if hasattr(prov_key, "value") else str(prov_key)
        storage_mo = self._storage_monthly(vs_provider, gb)
        retrieval_mo = self._retrieval_read_units_monthly(vs_provider, qp_m) * variant_m

        totals = _Totals(
            embedding=embedding_per_query * qp_m,
            generation=generation_per_query * qp_m,
            reranking=rerank_per_query * qp_m,
            storage=storage_mo,
            retrieval=retrieval_mo,
        )

        monthly = (
            totals.embedding
            + totals.generation
            + totals.reranking
            + totals.storage
            + totals.retrieval
        )
        per_query = embedding_per_query + generation_per_query + rerank_per_query
        if qp_m > 0:
            per_query += totals.retrieval / qp_m

        breakdown: list[CostBreakdownSchema] = []
        for component, amt in (
            ("embedding", totals.embedding),
            ("vector_storage", totals.storage),
            ("retrieval_ops", totals.retrieval),
            ("reranking", totals.reranking),
            ("generation", totals.generation),
        ):
            pct = round(100.0 * amt / monthly, 2) if monthly > 0 else 0.0
            breakdown.append(
                CostBreakdownSchema(
                    component=component,
                    unit_cost=round(amt / max(qp_m, 1.0), 8)
                    if component != "vector_storage"
                    else round(amt, 8),
                    estimated_usage=float(qp_m if component != "vector_storage" else 1.0),
                    total_cost=round(amt, 8),
                    percentage=pct,
                ),
            )

        return CostEstimateSchema(
            embedding=round(totals.embedding, 6),
            storage=round(totals.storage, 6),
            retrieval=round(totals.retrieval, 6),
            reranking=round(totals.reranking, 6),
            generation=round(totals.generation, 6),
            total=round(monthly, 6),
            per_query=round(per_query, 8),
            per_month=round(monthly, 6),
            currency="USD",
            breakdown=breakdown,
        )

    def _embedding_rate(self, model_id: str) -> float:
        models = _models_block(self._p, "embedding")
        row = models.get(model_id) or models.get(_normalize_model_key(model_id))
        if isinstance(row, dict):
            return float(row.get("costPer1MTokens", 0.0))
        for k, v in models.items():
            if isinstance(k, str) and k.lower() == model_id.lower() and isinstance(v, dict):
                return float(v.get("costPer1MTokens", 0.0))
        fallback = models.get("text-embedding-3-small")
        return float(fallback["costPer1MTokens"]) if isinstance(fallback, dict) else 0.02

    def _generation_rates(self, model_id: str) -> tuple[float, float]:
        models = _models_block(self._p, "generation")
        row = models.get(model_id)
        if isinstance(row, dict):
            return float(row.get("inputCostPer1MTokens", 0.0)), float(
                row.get("outputCostPer1MTokens", 0.0),
            )
        for k, v in models.items():
            if isinstance(k, str) and k.lower() == model_id.lower() and isinstance(v, dict):
                return float(v.get("inputCostPer1MTokens", 0.0)), float(
                    v.get("outputCostPer1MTokens", 0.0),
                )
        fb = models.get("gpt-4o-mini")
        if isinstance(fb, dict):
            return float(fb.get("inputCostPer1MTokens", 0.15)), float(
                fb.get("outputCostPer1MTokens", 0.6),
            )
        return 0.15, 0.6

    def _rerank_per_query_cost(self, model_id: str) -> float:
        """Rerank cost per query: ``costPer1KQueries / 1000`` from catalog (USD per query)."""
        models = _models_block(self._p, "reranking")
        key = _normalize_model_key(model_id)
        row = models.get(model_id) or models.get(key)
        if not isinstance(row, dict):
            for mk, mv in models.items():
                if isinstance(mk, str) and mk.lower() == model_id.lower() and isinstance(mv, dict):
                    row = mv
                    break
        if not isinstance(row, dict):
            return 0.0
        raw = float(row.get("costPer1KQueries", 0.0))
        return raw / 1000.0

    def _storage_monthly(self, provider: str, gb: float) -> float:
        providers = _dig(self._p, "vectorStorage").get("providers")
        if not isinstance(providers, dict):
            return 0.0
        prow = providers.get(provider)
        if not isinstance(prow, dict):
            return 0.0
        if "managedCloud" in prow and isinstance(prow["managedCloud"], dict):
            tier = prow["managedCloud"]
            rate = float(tier.get("costPerGBPerMonth", 0.0))
            base = gb * rate
            m = tier.get("minimumPerMonth")
            if m is not None:
                base = max(base, float(m))
            return base
        if "serverless" in prow and isinstance(prow["serverless"], dict):
            return gb * float(prow["serverless"].get("costPerGBPerMonth", 0.0))
        if "selfHosted" in prow and isinstance(prow["selfHosted"], dict):
            return gb * float(prow["selfHosted"].get("costPerGBPerMonth", 0.0))
        if "managed" in prow and isinstance(prow["managed"], dict):
            return gb * float(prow["managed"].get("costPerGBPerMonth", 0.0))
        return 0.0

    def _retrieval_read_units_monthly(self, provider: str, queries_month: float) -> float:
        providers = _dig(self._p, "vectorStorage").get("providers")
        if not isinstance(providers, dict):
            return 0.0
        prow = providers.get(provider)
        if not isinstance(prow, dict):
            return 0.0
        srv = prow.get("serverless")
        if isinstance(srv, dict) and srv.get("costPerReadUnit"):
            return queries_month * float(srv["costPerReadUnit"])
        vert = prow.get("managed")
        if isinstance(vert, dict) and vert.get("queryUnitCostPer1M"):
            return (queries_month / 1_000_000.0) * float(vert["queryUnitCostPer1M"])
        return 0.0


def estimate_pipeline_cost(
    cfg: PipelineConfigurationSchema,
    pricing: dict[str, object],
) -> CostEstimateSchema:
    return CostEstimator(pricing).estimate(CostRequest(config=cfg))


def calculate_pipeline_cost(
    cfg: PipelineConfigurationSchema,
    pricing: dict[str, object],
) -> CostEstimateSchema:
    """Alias for :func:`estimate_pipeline_cost`."""
    return estimate_pipeline_cost(cfg, pricing)
