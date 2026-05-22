"""Unit tests for the P2-3 Embedding Service.

Covers EmbedderFactory, EmbeddingService, EmbeddingCache, and EmbeddingBenchmarker.
Provider SDKs are never called — embedders are faked or mocked.
"""

import time
from unittest.mock import MagicMock, patch

from langchain_core.documents import Document
import pytest

from app.core.embedding import (
    EmbedderFactory,
    EmbeddingBenchmarker,
    EmbeddingCache,
    EmbeddingConfig,
    EmbeddingService,
)
from app.core.embedding.cache import _cache_key, _pack, _unpack
from app.core.embedding.strategies import Embedding, TextEmbedder


class _FakeEmbedder(TextEmbedder):
    """Deterministic embedder for tests (no network)."""

    def embed_documents(self, texts: list[str], config: EmbeddingConfig) -> list[Embedding]:
        dim = config.dimensions
        return [[float(j) / max(dim, 1) for _ in range(dim)] for j in range(len(texts))]

    def embed_query(self, text: str, config: EmbeddingConfig) -> Embedding:
        return [0.25] * config.dimensions


class _SlowFakeEmbedder(TextEmbedder):
    def embed_documents(self, texts: list[str], config: EmbeddingConfig) -> list[Embedding]:
        time.sleep(0.04)
        return [[0.0] * config.dimensions for _ in texts]

    def embed_query(self, text: str, config: EmbeddingConfig) -> Embedding:
        return [0.0] * config.dimensions


@pytest.mark.unit
def test_embedder_factory_supported_providers_sorted_unique():
    providers = EmbedderFactory.supported_providers()
    assert providers == sorted(providers)
    assert set(providers) >= {"openai", "cohere", "google", "huggingface", "nomic"}


@pytest.mark.unit
def test_embedder_factory_unknown_provider_raises():
    with pytest.raises(ValueError, match="Unsupported embedding provider"):
        EmbedderFactory.from_provider("ollama-not-registered")


@pytest.mark.unit
@patch("app.core.embedding.EmbedderFactory.from_provider", return_value=_FakeEmbedder())
def test_embedding_service_enriches_metadata(_mock_from):
    svc = EmbeddingService()
    docs = [
        Document(page_content="hello", metadata={"source": "a.txt"}),
        Document(page_content="world", metadata={"source": "b.txt"}),
    ]
    cfg = EmbeddingConfig(provider="openai", model="text-embedding-3-small", dimensions=8)
    pairs = svc.embed(docs, cfg)
    assert len(pairs) == 2
    doc0, vec0 = pairs[0]
    assert doc0.page_content == "hello"
    assert doc0.metadata["embedding_provider"] == "openai"
    assert doc0.metadata["embedding_model"] == "text-embedding-3-small"
    assert doc0.metadata["embedding_dimensions"] == 8
    assert doc0.metadata["source"] == "a.txt"
    assert len(vec0) == 8


@pytest.mark.unit
@patch("app.core.embedding.EmbedderFactory.from_provider", return_value=_FakeEmbedder())
def test_embedding_service_embed_query(_mock_from):
    svc = EmbeddingService()
    cfg = EmbeddingConfig(dimensions=5)
    q = svc.embed_query("any query", cfg)
    assert len(q) == 5
    assert all(isinstance(x, float) for x in q)


@pytest.mark.unit
@patch("app.core.embedding.EmbedderFactory.from_provider", return_value=_FakeEmbedder())
def test_embedding_service_embed_many_concatenates(_mock_from):
    svc = EmbeddingService()
    cfg = EmbeddingConfig(dimensions=3)
    groups = [
        [Document(page_content="a", metadata={})],
        [
            Document(page_content="b", metadata={}),
            Document(page_content="c", metadata={}),
        ],
    ]
    pairs = svc.embed_many(groups, cfg)
    assert len(pairs) == 3


@pytest.mark.unit
@patch("app.core.embedding.EmbedderFactory.from_provider")
def test_embedding_cache_second_batch_is_all_hits(mock_from_provider):
    """Intra-batch duplicates are still misses once each; after persist, a repeat batch hits cache."""  # noqa: E501
    embedder = MagicMock()
    embedder.embed_documents.side_effect = lambda texts, cfg: [
        [float(i)] * cfg.dimensions for i, _ in enumerate(texts)
    ]
    mock_from_provider.return_value = embedder

    cache = EmbeddingCache()
    cache._redis_checked = True
    cache._redis = None

    svc = EmbeddingService(cache=cache)
    cfg = EmbeddingConfig(provider="openai", model="m", dimensions=4)
    docs = [
        Document(page_content="dup", metadata={}),
        Document(page_content="dup", metadata={}),
        Document(page_content="only-once", metadata={}),
    ]
    svc.embed(docs, cfg)
    assert embedder.embed_documents.call_count == 1
    batch = embedder.embed_documents.call_args[0][0]
    assert batch == ["dup", "dup", "only-once"]

    svc.embed(docs, cfg)
    assert embedder.embed_documents.call_count == 1


@pytest.mark.unit
def test_cache_key_differs_when_dimensions_change():
    base = EmbeddingConfig(provider="openai", model="text-embedding-3-small", dimensions=512)
    other = EmbeddingConfig(provider="openai", model="text-embedding-3-small", dimensions=1536)
    assert _cache_key("same text", base) != _cache_key("same text", other)


@pytest.mark.unit
def test_pack_unpack_roundtrip_float32():
    vec = [1.5, -2.25, 0.0, 3.14159]
    assert _unpack(_pack(vec)) == pytest.approx(vec)


@pytest.mark.unit
@patch("app.core.embedding.EmbedderFactory")
def test_benchmarker_excludes_failed_providers(mock_factory):
    def from_provider(provider: str):
        if provider == "openai":
            raise RuntimeError("missing API key")
        return _FakeEmbedder()

    mock_factory.from_provider.side_effect = from_provider

    bench = EmbeddingBenchmarker()
    results = bench.benchmark(
        ["one", "two"],
        [
            EmbeddingConfig(provider="openai", dimensions=4),
            EmbeddingConfig(provider="huggingface", dimensions=4),
        ],
    )
    assert len(results) == 1
    assert results[0].provider == "huggingface"


@pytest.mark.unit
@patch("app.core.embedding.EmbedderFactory")
def test_benchmarker_sorted_by_texts_per_second_descending(mock_factory):
    def from_provider(provider: str):
        return _SlowFakeEmbedder() if provider == "openai" else _FakeEmbedder()

    mock_factory.from_provider.side_effect = from_provider

    bench = EmbeddingBenchmarker()
    results = bench.benchmark(
        ["t"] * 4,
        [
            EmbeddingConfig(provider="openai", dimensions=2),
            EmbeddingConfig(provider="huggingface", dimensions=2),
        ],
    )
    assert len(results) == 2
    assert results[0].texts_per_second >= results[1].texts_per_second
