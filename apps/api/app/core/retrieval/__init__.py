"""Retrieval Service — P2-5.

Retrieval strategies (similarity, MMR, hybrid BM25+dense, multi-query RRF,
ensemble RRF, parent-child uplift) plus optional Cohere reranking.

Typical usage::

    from app.core.embedding import EmbeddingService
    from app.core.retrieval import (
        RetrievalRuntimeConfig,
        RetrievalService,
        RerankingRuntimeConfig,
        retrieval_runtime_from_pipeline,
    )
    from app.core.vectorstore import VectorStoreRuntimeConfig, VectorStoreService

    vs = VectorStoreService(qdrant_client=client)
    emb = EmbeddingService()
    r = RetrievalService(vs, embedding_service=emb)
    cfg = RetrievalRuntimeConfig(strategy="mmr", top_k=5)
    qv = emb.embed_query("What is RAG?", None)
    hits = await r.retrieve(
        "What is RAG?",
        qv,
        "qdrant",
        VectorStoreRuntimeConfig(collection_name="kb", vector_size=len(qv)),
        cfg,
    )
"""

from .pipeline_bridge import retrieval_runtime_from_pipeline
from .service import RetrievalService
from .strategies import RerankingRuntimeConfig, RetrievalRuntimeConfig

__all__ = [
    "RetrievalService",
    "RetrievalRuntimeConfig",
    "RerankingRuntimeConfig",
    "retrieval_runtime_from_pipeline",
]
