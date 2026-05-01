"""Map validated P1-3 pipeline schemas into retrieval runtime dataclasses."""

from __future__ import annotations

from app.core.vectorstore.strategies import VectorSearchFilter
from app.schemas.pipeline import RetrievalConfigSchema

from .strategies import RetrievalRuntimeConfig


def retrieval_runtime_from_pipeline(cfg: RetrievalConfigSchema) -> RetrievalRuntimeConfig:
    """Convert ``RetrievalConfigSchema`` to ``RetrievalRuntimeConfig``."""
    filters: list[VectorSearchFilter] | None = None
    if cfg.filters:
        filters = []
        for f in cfg.filters:
            op = f.operator if isinstance(f.operator, str) else f.operator.value
            filters.append(VectorSearchFilter(key=f.key, operator=op, value=f.value))
    alpha = 0.5
    fusion = "rrf"
    if cfg.hybrid_search is not None:
        alpha = cfg.hybrid_search.alpha
    strat = cfg.strategy if isinstance(cfg.strategy, str) else str(cfg.strategy.value)
    return RetrievalRuntimeConfig(
        strategy=strat,
        top_k=cfg.top_k,
        score_threshold=cfg.score_threshold,
        filters=filters,
        hybrid_search_alpha=alpha,
        hybrid_fusion=fusion,
        mmr_lambda=0.5,
        mmr_fetch_k=None,
        ensemble_strategies=("similarity", "mmr"),
        multi_query_variants=(),
    )
