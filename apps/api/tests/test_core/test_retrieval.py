"""Unit tests for P2-5 Retrieval Service (Qdrant in-memory, mocks for MMR/rerank)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from unittest.mock import AsyncMock, MagicMock

from langchain_core.documents import Document
import pytest
from qdrant_client import AsyncQdrantClient

from app.core.retrieval import (
    RerankingRuntimeConfig,
    RetrievalRuntimeConfig,
    RetrievalService,
    reranking_runtime_from_pipeline,
    retrieval_runtime_from_pipeline,
)
from app.core.retrieval.fusion import mmr_order, reciprocal_rank_fusion_keys
from app.core.retrieval.service import _parent_child_uplift
from app.core.vectorstore import VectorStoreRuntimeConfig, VectorStoreService
from app.schemas.pipeline import (
    FilterOperator,
    HybridSearchConfig,
    MetadataFilter,
    RetrievalConfigSchema,
    RetrievalStrategy,
)


@pytest.fixture
async def qdrant_memory() -> AsyncIterator[AsyncQdrantClient]:
    client = AsyncQdrantClient(location=":memory:")
    yield client
    await client.close()


@pytest.mark.unit
def test_rrf_keys_prefers_consensus():
    r = reciprocal_rank_fusion_keys([["a", "b", "c"], ["b", "a", "d"]])
    keys = [k for k, _ in r]
    assert keys[0] == "a" or keys[0] == "b"


@pytest.mark.unit
def test_mmr_order_diversifies():
    q = [1.0, 0.0, 0.0, 0.0]
    docs = [
        [0.99, 0.1, 0.0, 0.0],
        [0.98, 0.12, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
    ]
    order = mmr_order(q, docs, k=2, lambda_mult=0.5)
    assert len(order) == 2
    assert 2 in order


@pytest.mark.unit
def test_parent_child_uplift_merges_by_parent():
    from app.core.vectorstore import ScoredDoc

    results = [
        Document(
            page_content="child1",
            metadata={"parent_id": "p1", "parent_page_content": "FULL PARENT TEXT"},
        ),
        Document(
            page_content="child2",
            metadata={"parent_id": "p1", "parent_page_content": "FULL PARENT TEXT"},
        ),
    ]
    proper = [
        ScoredDoc(results[0], 0.9),
        ScoredDoc(results[1], 0.8),
    ]
    out = _parent_child_uplift(proper)
    assert len(out) == 1
    assert out[0].document.page_content == "FULL PARENT TEXT"


@pytest.mark.asyncio
async def test_retrieval_similarity(qdrant_memory: AsyncQdrantClient):
    vs = VectorStoreService(qdrant_client=qdrant_memory)
    cfg_vs = VectorStoreRuntimeConfig(collection_name="r1", vector_size=2, metric="cosine")
    await vs.index(
        [
            Document(page_content="apple pie", metadata={}),
            Document(page_content="banana bread", metadata={}),
        ],
        [[1.0, 0.0], [0.0, 1.0]],
        "qdrant",
        cfg_vs,
    )
    r = RetrievalService(vs)
    rcfg = RetrievalRuntimeConfig(strategy="similarity", top_k=2)
    hits = await r.retrieve(
        "fruit",
        [0.0, 1.0],
        "qdrant",
        cfg_vs,
        rcfg,
    )
    assert len(hits) >= 1
    assert "banana" in hits[0].document.page_content


@pytest.mark.asyncio
async def test_retrieval_hybrid_rrf(qdrant_memory: AsyncQdrantClient):
    vs = VectorStoreService(qdrant_client=qdrant_memory)
    corpus = [
        Document(page_content="quantum field theory basics", metadata={"id": "1"}),
        Document(page_content="baking sourdough starter tips", metadata={"id": "2"}),
    ]
    cfg_vs = VectorStoreRuntimeConfig(collection_name="r2", vector_size=2, metric="cosine")
    await vs.index(
        corpus,
        [[1.0, 0.0], [0.0, 1.0]],
        "qdrant",
        cfg_vs,
    )
    r = RetrievalService(vs)
    rcfg = RetrievalRuntimeConfig(strategy="hybrid", top_k=2, hybrid_fusion="rrf")
    hits = await r.retrieve(
        "sourdough baking",
        [1.0, 0.0],
        "qdrant",
        cfg_vs,
        rcfg,
        sparse_corpus=corpus,
    )
    texts = " ".join(h.document.page_content for h in hits)
    assert "sourdough" in texts or "baking" in texts


@pytest.mark.asyncio
async def test_retrieval_mmr_with_mock_embedder(qdrant_memory: AsyncQdrantClient):
    vs = VectorStoreService(qdrant_client=qdrant_memory)
    cfg_vs = VectorStoreRuntimeConfig(collection_name="r3", vector_size=4, metric="cosine")
    docs = [
        Document(page_content="aaaa", metadata={}),
        Document(page_content="bbbb", metadata={}),
        Document(page_content="zzzz", metadata={}),
    ]
    await vs.index(
        docs,
        [[1.0, 0.0, 0.0, 0.0], [0.95, 0.1, 0.0, 0.0], [0.0, 0.0, 0.0, 1.0]],
        "qdrant",
        cfg_vs,
    )

    emb = MagicMock()
    emb.embed = MagicMock(
        side_effect=lambda chunks, cfg=None: [
            (c, [float(len(c.page_content)), 0.0, 0.0, 1.0]) for c in chunks
        ]
    )
    emb.embed_query = MagicMock(return_value=[1.0, 0.0, 0.0, 0.0])

    r = RetrievalService(vs, embedding_service=emb)
    rcfg = RetrievalRuntimeConfig(strategy="mmr", top_k=2, mmr_lambda=0.6)
    hits = await r.retrieve("q", [1.0, 0.0, 0.0, 0.0], "qdrant", cfg_vs, rcfg)
    assert len(hits) == 2
    emb.embed.assert_called_once()


@pytest.mark.asyncio
async def test_rerank_passthrough_when_not_cohere(qdrant_memory: AsyncQdrantClient):
    vs = VectorStoreService(qdrant_client=qdrant_memory)
    cfg_vs = VectorStoreRuntimeConfig(collection_name="r4", vector_size=1, metric="cosine")
    await vs.index(
        [Document(page_content="first", metadata={}), Document(page_content="second", metadata={})],
        [[1.0], [0.5]],
        "qdrant",
        cfg_vs,
    )
    r = RetrievalService(vs)
    rcfg = RetrievalRuntimeConfig(strategy="similarity", top_k=2)
    rr = RerankingRuntimeConfig(enabled=True, provider="custom", top_n=1)
    hits = await r.retrieve(
        "x",
        [1.0],
        "qdrant",
        cfg_vs,
        rcfg,
        rerank=rr,
    )
    assert len(hits) == 1


@pytest.mark.asyncio
async def test_cohere_reranker_uses_httpx(monkeypatch):
    from app.core.retrieval.rerankers import CohereReranker

    async def fake_post(url, json=None, headers=None, timeout=None):
        class R:
            def raise_for_status(self):
                return None

            def json(self):
                return {"results": [{"index": 1}, {"index": 0}]}

        return R()

    mock_client = MagicMock()
    mock_client.post = AsyncMock(side_effect=fake_post)
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_client)
    mock_cm.__aexit__ = AsyncMock(return_value=None)

    monkeypatch.setattr(
        "app.core.retrieval.rerankers.httpx.AsyncClient",
        lambda timeout=60.0: mock_cm,
    )
    rr = CohereReranker(api_key="test-key")
    out = await rr.rerank("q", ["a", "b"], top_n=2)
    assert out == [1, 0]


@pytest.mark.unit
def test_retrieval_runtime_from_pipeline_maps_filters():
    p = RetrievalConfigSchema(
        strategy=RetrievalStrategy.SIMILARITY,
        top_k=7,
        score_threshold=0.25,
        filters=[
            MetadataFilter(key="source", operator=FilterOperator.EQ, value="wiki"),
        ],
        hybrid_search=HybridSearchConfig(alpha=0.7, fusion="weighted"),
    )
    rt = retrieval_runtime_from_pipeline(p)
    assert rt.strategy == "similarity"
    assert rt.top_k == 7
    assert rt.score_threshold == 0.25
    assert rt.filters is not None and rt.filters[0].key == "source"
    assert abs(rt.hybrid_search_alpha - 0.7) < 1e-6
    assert rt.hybrid_fusion == "weighted"


@pytest.mark.unit
def test_retrieval_runtime_from_pipeline_mmr_and_ensemble():
    p = RetrievalConfigSchema(
        strategy=RetrievalStrategy.MMR,
        top_k=5,
        mmr_fetch_k=40,
        mmr_lambda_mult=0.62,
    )
    rt = retrieval_runtime_from_pipeline(p)
    assert rt.mmr_fetch_k == 40
    assert abs(rt.mmr_lambda - 0.62) < 1e-9

    ens = RetrievalConfigSchema(
        strategy=RetrievalStrategy.ENSEMBLE,
        top_k=8,
        ensemble_strategies=["mmr", "hybrid"],
        ensemble_rrf_k=42,
    )
    rt2 = retrieval_runtime_from_pipeline(ens)
    assert rt2.ensemble_strategies == ("mmr", "hybrid")
    assert rt2.rrf_k == 42


@pytest.mark.unit
def test_reranking_runtime_from_pipeline_maps_thresholds():
    from app.schemas.pipeline import RerankingConfigSchema

    rr = RerankingConfigSchema(
        enabled=True,
        model="cohere-rerank-v3",
        top_n=10,
        provider="cohere",
        min_relevance_score=0.33,
        diversity_max_similarity=0.9,
    )
    rt = reranking_runtime_from_pipeline(rr)
    assert rt is not None
    assert rt.enabled is True
    assert rt.min_relevance_score == pytest.approx(0.33)
    assert rt.diversity_max_similarity == pytest.approx(0.9)
