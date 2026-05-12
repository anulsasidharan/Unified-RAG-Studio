"""Map validated P1-3 pipeline schemas into retrieval runtime dataclasses."""

from __future__ import annotations

from app.core.vectorstore.strategies import VectorSearchFilter
from app.schemas.pipeline import RerankingConfigSchema, RetrievalConfigSchema

from .strategies import HybridFusion, RerankingRuntimeConfig, RetrievalRuntimeConfig


def _normalize_ensemble_member(name: str) -> str:
    if name == "bm25":
        return "hybrid"
    return name


def retrieval_runtime_from_pipeline(cfg: RetrievalConfigSchema) -> RetrievalRuntimeConfig:
    """Convert ``RetrievalConfigSchema`` to ``RetrievalRuntimeConfig``."""
    filters: list[VectorSearchFilter] | None = None
    if cfg.filters:
        filters = []
        for f in cfg.filters:
            op = f.operator if isinstance(f.operator, str) else f.operator.value
            filters.append(VectorSearchFilter(key=f.key, operator=op, value=f.value))
    alpha = 0.5
    fusion: HybridFusion = "rrf"
    if cfg.hybrid_search is not None:
        alpha = cfg.hybrid_search.alpha
        hf = cfg.hybrid_search.fusion
        if hf == "weighted":
            fusion = "weighted"
        elif hf == "rrf":
            fusion = "rrf"
    strat = cfg.strategy if isinstance(cfg.strategy, str) else str(cfg.strategy.value)

    mmr_lambda = 0.5 if cfg.mmr_lambda_mult is None else float(cfg.mmr_lambda_mult)
    mmr_fetch_k = cfg.mmr_fetch_k

    ensemble_raw = cfg.ensemble_strategies or ["similarity", "mmr"]
    ensemble = tuple(_normalize_ensemble_member(s) for s in ensemble_raw)

    rrf_k = 60 if cfg.ensemble_rrf_k is None else int(cfg.ensemble_rrf_k)

    return RetrievalRuntimeConfig(
        strategy=strat,
        top_k=cfg.top_k,
        score_threshold=cfg.score_threshold,
        filters=filters,
        hybrid_search_alpha=alpha,
        hybrid_fusion=fusion,
        mmr_lambda=mmr_lambda,
        mmr_fetch_k=mmr_fetch_k,
        ensemble_strategies=ensemble,
        multi_query_variants=(),
        rrf_k=rrf_k,
    )


def reranking_runtime_from_pipeline(r: RerankingConfigSchema | None) -> RerankingRuntimeConfig | None:
    """Convert optional reranking stage schema to runtime config (``None`` when disabled)."""
    if r is None or not r.enabled:
        return None
    return RerankingRuntimeConfig(
        enabled=True,
        model=r.model,
        top_n=r.top_n,
        provider=r.provider,
        min_relevance_score=r.min_relevance_score,
        diversity_max_similarity=r.diversity_max_similarity,
    )
