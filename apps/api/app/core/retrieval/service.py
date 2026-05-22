"""Retrieval Service — P2-5.

Orchestrates vector store search with optional BM25 hybrid fusion, MMR
diversity, multi-query RRF, ensemble strategies, parent-child uplift, and
Cohere reranking.
"""

from __future__ import annotations

from langchain_core.documents import Document
import structlog

from app.core.context_compression import ContextCompressionRuntimeConfig, apply_context_compression
from app.core.embedding import EmbeddingConfig, EmbeddingService
from app.core.vectorstore import (
    ScoredDoc,
    VectorStoreRuntimeConfig,
    VectorStoreService,
)

from .bm25 import BM25Index, tokenize
from .fusion import mmr_order, reciprocal_rank_fusion_keys, weighted_dense_sparse
from .rerankers import CohereReranker, PassthroughReranker
from .strategies import RerankingRuntimeConfig, RetrievalRuntimeConfig

logger = structlog.get_logger(__name__)


def _doc_key(doc: Document) -> str:
    return doc.page_content.strip()


def _word_jaccard(a: str, b: str, *, max_tokens: int = 120) -> float:
    """Rough lexical overlap in [0, 1] for near-duplicate detection."""
    ta = set((a or "").lower().split()[:max_tokens])
    tb = set((b or "").lower().split()[:max_tokens])
    if not ta and not tb:
        return 1.0
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    union = len(ta | tb)
    return inter / union if union else 0.0


def _diversify_scored_order(
    scored: list[ScoredDoc],
    order: list[int],
    *,
    max_similarity: float,
) -> list[int]:
    """Keep rerank order but skip items too similar to already-kept documents."""
    kept_texts: list[str] = []
    out: list[int] = []
    for idx in order:
        if not (0 <= idx < len(scored)):
            continue
        text = (scored[idx].document.page_content or "")[:2000]
        if any(_word_jaccard(text, prev) >= max_similarity for prev in kept_texts):
            continue
        kept_texts.append(text)
        out.append(idx)
    return out if out else order


def _parent_child_uplift(results: list[ScoredDoc]) -> list[ScoredDoc]:
    """Merge child hits by ``parent_id``; prefer ``parent_page_content`` in metadata."""
    by_parent: dict[str, ScoredDoc] = {}
    for sd in results:
        meta = sd.document.metadata or {}
        pid = meta.get("parent_id") or meta.get("parent_doc_id")
        key = str(pid) if pid is not None else _doc_key(sd.document)
        content = meta.get("parent_page_content")
        doc = sd.document
        if isinstance(content, str) and content.strip():
            doc = Document(page_content=content, metadata=meta)
        cand = ScoredDoc(document=doc, score=sd.score)
        if key not in by_parent or cand.score > by_parent[key].score:
            by_parent[key] = cand
    return sorted(by_parent.values(), key=lambda x: x.score, reverse=True)


class RetrievalService:
    """High-level retrieval over ``VectorStoreService`` + optional fusion/rerank."""

    def __init__(
        self,
        vector_store: VectorStoreService,
        *,
        embedding_service: EmbeddingService | None = None,
    ) -> None:
        self._vs = vector_store
        self._emb = embedding_service

    async def _vector_search(
        self,
        query_vector: list[float],
        provider: str,
        vs_config: VectorStoreRuntimeConfig,
        cfg: RetrievalRuntimeConfig,
        *,
        top_k: int,
    ) -> list[ScoredDoc]:
        return await self._vs.search(
            query_vector,
            provider,
            vs_config,
            top_k=top_k,
            filters=cfg.filters,
            score_threshold=cfg.score_threshold,
        )

    async def _similarity(
        self,
        query_vector: list[float],
        provider: str,
        vs_config: VectorStoreRuntimeConfig,
        cfg: RetrievalRuntimeConfig,
    ) -> list[ScoredDoc]:
        return await self._vector_search(query_vector, provider, vs_config, cfg, top_k=cfg.top_k)

    async def _mmr(
        self,
        query_text: str,
        query_vector: list[float],
        provider: str,
        vs_config: VectorStoreRuntimeConfig,
        cfg: RetrievalRuntimeConfig,
        embedding_config: EmbeddingConfig | None,
    ) -> list[ScoredDoc]:
        fetch = cfg.mmr_fetch_k or max(cfg.top_k * 4, cfg.top_k)
        hits = await self._vector_search(query_vector, provider, vs_config, cfg, top_k=fetch)
        if not hits:
            return []
        if self._emb is None:
            logger.warning("retrieval_mmr_no_embedder", query_preview=query_text[:48])
            return hits[: cfg.top_k]
        em_cfg = embedding_config or EmbeddingConfig()
        chunks = [Document(page_content=h.document.page_content) for h in hits]
        pairs = self._emb.embed(chunks, em_cfg)
        doc_vecs = [p[1] for p in pairs]
        order = mmr_order(
            query_vector,
            doc_vecs,
            k=cfg.top_k,
            lambda_mult=cfg.mmr_lambda,
        )
        out: list[ScoredDoc] = []
        for rank, idx in enumerate(order):
            h = hits[idx]
            out.append(ScoredDoc(h.document, float(cfg.top_k - rank)))
        return out

    async def _hybrid(
        self,
        query_text: str,
        query_vector: list[float],
        provider: str,
        vs_config: VectorStoreRuntimeConfig,
        cfg: RetrievalRuntimeConfig,
        sparse_corpus: list[Document],
    ) -> list[ScoredDoc]:
        if not sparse_corpus:
            logger.warning("retrieval_hybrid_empty_corpus")
            return await self._similarity(query_vector, provider, vs_config, cfg)
        fetch_n = min(max(cfg.top_k * 8, cfg.top_k), len(sparse_corpus))
        dense_hits = await self._vector_search(
            query_vector, provider, vs_config, cfg, top_k=max(fetch_n, cfg.top_k)
        )
        tokenized = [tokenize(d.page_content) for d in sparse_corpus]
        bm25 = BM25Index(tokenized)

        key_to_idx = {_doc_key(d): i for i, d in enumerate(sparse_corpus)}
        dense_by_idx: dict[int, float] = {}
        for h in dense_hits:
            idx = key_to_idx.get(_doc_key(h.document))
            if idx is not None:
                dense_by_idx[idx] = max(dense_by_idx.get(idx, 0.0), float(h.score))

        if cfg.hybrid_fusion == "weighted":
            bm25_scores = bm25.scores(query_text)
            sparse_by_idx = {i: float(bm25_scores[i]) for i in range(len(sparse_corpus))}
            combined = weighted_dense_sparse(
                dense_by_idx,
                sparse_by_idx,
                alpha=cfg.hybrid_search_alpha,
            )
            ranked_idx = sorted(combined, key=lambda i: combined[i], reverse=True)[: cfg.top_k]
            return [ScoredDoc(sparse_corpus[i], combined[i]) for i in ranked_idx]

        dense_keys = [_doc_key(h.document) for h in dense_hits]
        bm25_order = bm25.top_indices(query_text, k=fetch_n)
        bm25_keys = [_doc_key(sparse_corpus[i]) for i in bm25_order]
        fused = reciprocal_rank_fusion_keys([dense_keys, bm25_keys], k=cfg.rrf_k)
        dense_map = {_doc_key(h.document): h for h in dense_hits}
        corpus_map = {_doc_key(d): d for d in sparse_corpus}
        out: list[ScoredDoc] = []
        for key, score in fused[: cfg.top_k]:
            if key in dense_map:
                out.append(ScoredDoc(dense_map[key].document, score))
            elif key in corpus_map:
                out.append(ScoredDoc(corpus_map[key], score))
        return out

    async def _multi_query(
        self,
        query_vector: list[float],
        provider: str,
        vs_config: VectorStoreRuntimeConfig,
        cfg: RetrievalRuntimeConfig,
        variant_vectors: list[list[float]],
    ) -> list[ScoredDoc]:
        all_hits: list[list[ScoredDoc]] = []
        primary = await self._vector_search(
            query_vector, provider, vs_config, cfg, top_k=max(cfg.top_k * 3, cfg.top_k)
        )
        all_hits.append(primary)
        for vvec in variant_vectors:
            hits = await self._vector_search(
                vvec, provider, vs_config, cfg, top_k=max(cfg.top_k * 3, cfg.top_k)
            )
            all_hits.append(hits)
        rankings = [[_doc_key(h.document) for h in hits] for hits in all_hits]
        fused = reciprocal_rank_fusion_keys(rankings, k=cfg.rrf_k)
        doc_lookup: dict[str, Document] = {}
        for hits in all_hits:
            for h in hits:
                doc_lookup.setdefault(_doc_key(h.document), h.document)
        out: list[ScoredDoc] = []
        for key, sc in fused[: cfg.top_k]:
            doc = doc_lookup.get(key)
            if doc is not None:
                out.append(ScoredDoc(doc, sc))
        return out

    async def _ensemble(
        self,
        query_text: str,
        query_vector: list[float],
        provider: str,
        vs_config: VectorStoreRuntimeConfig,
        cfg: RetrievalRuntimeConfig,
        *,
        sparse_corpus: list[Document] | None,
        embedding_config: EmbeddingConfig | None,
        variant_vectors: list[list[float]] | None,
    ) -> list[ScoredDoc]:
        rankings_keys: list[list[str]] = []
        doc_lookup: dict[str, Document] = {}
        for name in cfg.ensemble_strategies:
            if name == "ensemble":
                continue
            if name == "hybrid" and not sparse_corpus:
                logger.warning("ensemble_skip_hybrid_no_corpus")
                continue
            sub = RetrievalRuntimeConfig(
                strategy=name,
                top_k=cfg.top_k,
                score_threshold=cfg.score_threshold,
                filters=cfg.filters,
                hybrid_search_alpha=cfg.hybrid_search_alpha,
                hybrid_fusion=cfg.hybrid_fusion,
                mmr_lambda=cfg.mmr_lambda,
                mmr_fetch_k=cfg.mmr_fetch_k,
                ensemble_strategies=cfg.ensemble_strategies,
                multi_query_variants=cfg.multi_query_variants,
                rrf_k=cfg.rrf_k,
            )
            part = await self._run_strategy(
                query_text,
                query_vector,
                provider,
                vs_config,
                sub,
                sparse_corpus=sparse_corpus,
                embedding_config=embedding_config,
                variant_vectors=variant_vectors,
            )
            for h in part:
                doc_lookup.setdefault(_doc_key(h.document), h.document)
            rankings_keys.append([_doc_key(h.document) for h in part])
        if not rankings_keys:
            return await self._similarity(query_vector, provider, vs_config, cfg)
        fused = reciprocal_rank_fusion_keys(rankings_keys, k=cfg.rrf_k)
        out: list[ScoredDoc] = []
        for key, sc in fused[: cfg.top_k]:
            doc = doc_lookup.get(key)
            if doc is not None:
                out.append(ScoredDoc(doc, sc))
        return out

    async def _run_strategy(
        self,
        query_text: str,
        query_vector: list[float],
        provider: str,
        vs_config: VectorStoreRuntimeConfig,
        cfg: RetrievalRuntimeConfig,
        *,
        sparse_corpus: list[Document] | None,
        embedding_config: EmbeddingConfig | None,
        variant_vectors: list[list[float]] | None,
    ) -> list[ScoredDoc]:
        strat = cfg.strategy
        if strat == "similarity":
            return await self._similarity(query_vector, provider, vs_config, cfg)
        if strat == "mmr":
            return await self._mmr(
                query_text, query_vector, provider, vs_config, cfg, embedding_config
            )
        if strat == "hybrid":
            return await self._hybrid(
                query_text,
                query_vector,
                provider,
                vs_config,
                cfg,
                sparse_corpus or [],
            )
        if strat == "multi-query":
            vv = variant_vectors or []
            if not vv:
                logger.warning("multi_query_no_vectors")
                return await self._similarity(query_vector, provider, vs_config, cfg)
            return await self._multi_query(query_vector, provider, vs_config, cfg, vv)
        if strat == "ensemble":
            return await self._ensemble(
                query_text,
                query_vector,
                provider,
                vs_config,
                cfg,
                sparse_corpus=sparse_corpus,
                embedding_config=embedding_config,
                variant_vectors=variant_vectors,
            )
        if strat == "parent-child":
            hits = await self._similarity(query_vector, provider, vs_config, cfg)
            return _parent_child_uplift(hits)[: cfg.top_k]
        logger.warning("retrieval_unknown_strategy", strategy=strat)
        return await self._similarity(query_vector, provider, vs_config, cfg)

    async def _apply_rerank(
        self,
        query_text: str,
        scored: list[ScoredDoc],
        rerank: RerankingRuntimeConfig | None,
    ) -> list[ScoredDoc]:
        if not scored or rerank is None or not rerank.enabled:
            return scored
        texts = [s.document.page_content for s in scored]
        top_n = rerank.top_n or len(scored)
        prov = (rerank.provider or "").lower()
        model_id = rerank.model or ""
        use_cohere = prov == "cohere" or "cohere" in model_id.lower()
        min_score = rerank.min_relevance_score
        div_max = rerank.diversity_max_similarity

        if use_cohere:
            try:
                rr = CohereReranker(catalog_model_id=model_id or "cohere-rerank-v3")
                if min_score is not None:
                    ranked = await rr.rerank_with_scores(query_text, texts, top_n=top_n)
                    order = [i for i, sc in ranked if sc >= min_score]
                    if not order:
                        order = [i for i, _ in ranked[: max(1, min(3, len(ranked)))]]
                else:
                    order = await rr.rerank(query_text, texts, top_n=top_n)
            except Exception as exc:  # noqa: BLE001 — degrade gracefully
                logger.warning("cohere_rerank_failed", error=str(exc))
                order = list(range(min(top_n, len(scored))))
        else:
            order = await PassthroughReranker().rerank(query_text, texts, top_n=top_n)

        if div_max is not None and 0.0 <= div_max < 1.0:
            order = _diversify_scored_order(scored, order, max_similarity=div_max)

        return [scored[i] for i in order if 0 <= i < len(scored)]

    async def retrieve(
        self,
        query_text: str,
        query_vector: list[float],
        provider: str,
        vs_config: VectorStoreRuntimeConfig,
        cfg: RetrievalRuntimeConfig,
        *,
        sparse_corpus: list[Document] | None = None,
        embedding_config: EmbeddingConfig | None = None,
        multi_query_vectors: list[list[float]] | None = None,
        rerank: RerankingRuntimeConfig | None = None,
        context_compression: ContextCompressionRuntimeConfig | None = None,
    ) -> list[ScoredDoc]:
        """Run retrieval for ``cfg.strategy`` and optional reranking.

        * **hybrid** — pass ``sparse_corpus`` (same chunk texts as indexed) for BM25.
        * **multi-query** — pass ``multi_query_vectors`` (one per variant) or set
          ``cfg.multi_query_variants`` plus ``embedding_service`` to embed them.
        * **ensemble** — uses ``cfg.ensemble_strategies`` (defaults: similarity + mmr).
        """
        strat = cfg.strategy
        variant_vecs = multi_query_vectors
        if strat == "multi-query" and not variant_vecs and cfg.multi_query_variants:
            if self._emb is None:
                raise ValueError(
                    "multi-query with text variants requires embedding_service on "
                    "RetrievalService or pass multi_query_vectors=..."
                )
            em_cfg = embedding_config or EmbeddingConfig()
            variant_vecs = [self._emb.embed_query(t, em_cfg) for t in cfg.multi_query_variants]

        base_cfg = cfg
        if strat == "parent-child":
            base = await self._similarity(query_vector, provider, vs_config, cfg)
            base = _parent_child_uplift(base)[: cfg.top_k]
        else:
            base = await self._run_strategy(
                query_text,
                query_vector,
                provider,
                vs_config,
                base_cfg,
                sparse_corpus=sparse_corpus,
                embedding_config=embedding_config,
                variant_vectors=variant_vecs,
            )

        compressed = apply_context_compression(base, context_compression)

        logger.info(
            "retrieval_complete",
            strategy=strat,
            hits=len(compressed),
            rerank=bool(rerank and rerank.enabled),
        )
        return await self._apply_rerank(query_text, compressed, rerank)
