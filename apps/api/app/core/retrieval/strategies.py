"""Runtime configuration types for P2-5 retrieval.

These mirror ``RetrievalConfigSchema`` / ``HybridSearchConfig`` from
``app.schemas.pipeline`` but use core-layer ``VectorSearchFilter`` so the
retrieval package does not need Pydantic at runtime for hot paths.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from app.core.vectorstore.strategies import VectorSearchFilter

HybridFusion = Literal["rrf", "weighted"]


@dataclass
class RerankingRuntimeConfig:
    """Optional cross-encoder / API rerank after initial retrieval."""

    enabled: bool = False
    model: str | None = None
    top_n: int | None = None
    provider: str | None = None  # cohere | huggingface | custom


@dataclass
class RetrievalRuntimeConfig:
    """Strategy and hyper-parameters for ``RetrievalService.retrieve``."""

    strategy: str = "similarity"
    top_k: int = 5
    score_threshold: float | None = None
    filters: list[VectorSearchFilter] | None = None
    hybrid_search_alpha: float = 0.5
    hybrid_fusion: HybridFusion = "rrf"
    mmr_lambda: float = 0.5
    mmr_fetch_k: int | None = None
    ensemble_strategies: tuple[str, ...] = ("similarity", "mmr")
    multi_query_variants: tuple[str, ...] = field(default_factory=tuple)
