"""Unit tests for P2-4 Vector Store Service (Qdrant in-memory + factory errors)."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from unittest.mock import MagicMock

import httpx
from langchain_core.documents import Document
import pytest
from qdrant_client import AsyncQdrantClient

from app.core.vectorstore import (
    VectorSearchFilter,
    VectorStoreConfigurationError,
    VectorStoreFactory,
    VectorStoreRuntimeConfig,
    VectorStoreService,
)
from app.core.vectorstore.qdrant_client import QdrantVectorStore


@pytest.fixture
async def qdrant_memory() -> AsyncIterator[AsyncQdrantClient]:
    client = AsyncQdrantClient(location=":memory:")
    yield client
    await client.close()


@pytest.mark.unit
def test_factory_supported_providers():
    assert "qdrant" in VectorStoreFactory.supported_providers()


@pytest.mark.unit
def test_factory_qdrant_requires_client():
    cfg = VectorStoreRuntimeConfig(collection_name="c1", vector_size=4)
    with pytest.raises(VectorStoreConfigurationError, match="qdrant_client"):
        VectorStoreFactory.create("qdrant", cfg)


@pytest.mark.unit
def test_factory_pinecone_requires_key():
    cfg = VectorStoreRuntimeConfig(collection_name="idx", vector_size=8)
    with pytest.raises(VectorStoreConfigurationError, match="pinecone_api_key"):
        VectorStoreFactory.create("pinecone", cfg, pinecone_api_key=None)


@pytest.mark.unit
def test_factory_weaviate_requires_url():
    cfg = VectorStoreRuntimeConfig(collection_name="RAGChunk", vector_size=3)
    with pytest.raises(VectorStoreConfigurationError, match="weaviate_url"):
        VectorStoreFactory.create("weaviate", cfg, weaviate_url=None)


@pytest.mark.unit
def test_factory_unknown_provider():
    cfg = VectorStoreRuntimeConfig(collection_name="x", vector_size=3)
    with pytest.raises(VectorStoreConfigurationError, match="Unsupported"):
        VectorStoreFactory.create("chroma", cfg, qdrant_client=MagicMock())


@pytest.mark.asyncio
async def test_qdrant_full_index_and_search(qdrant_memory: AsyncQdrantClient):
    cfg = VectorStoreRuntimeConfig(collection_name="test_kb", vector_size=3, metric="cosine")
    store = QdrantVectorStore(qdrant_memory, cfg.collection_name)
    await store.ensure_collection(cfg.vector_size, cfg.metric)

    docs = [
        Document(page_content="alpha", metadata={"source": "a"}),
        Document(page_content="beta", metadata={"source": "b"}),
    ]
    vectors = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]
    await store.upsert(list(zip(docs, vectors, strict=True)))

    hits = await store.search([1.0, 0.0, 0.0], top_k=2)
    assert len(hits) >= 1
    assert hits[0].document.page_content == "alpha"
    assert hits[0].score is not None


@pytest.mark.asyncio
async def test_qdrant_search_with_eq_filter(qdrant_memory: AsyncQdrantClient):
    cfg = VectorStoreRuntimeConfig(collection_name="filt_kb", vector_size=2, metric="cosine")
    store = QdrantVectorStore(qdrant_memory, cfg.collection_name)
    await store.ensure_collection(cfg.vector_size, cfg.metric)
    await store.upsert(
        [
            (Document(page_content="only-b", metadata={"source": "b"}), [0.0, 1.0]),
            (Document(page_content="only-a", metadata={"source": "a"}), [1.0, 0.0]),
        ]
    )
    hits = await store.search(
        [1.0, 0.0],
        top_k=5,
        filters=[VectorSearchFilter(key="source", operator="eq", value="a")],
    )
    assert len(hits) == 1
    assert hits[0].document.metadata.get("source") == "a"


@pytest.mark.asyncio
async def test_vector_store_service_index_and_search(qdrant_memory: AsyncQdrantClient):
    svc = VectorStoreService(qdrant_client=qdrant_memory)
    cfg = VectorStoreRuntimeConfig(collection_name="svc_kb", vector_size=4, metric="cosine")
    chunks = [Document(page_content="hello", metadata={"k": 1})]
    embeddings = [[0.0, 0.0, 1.0, 0.0]]
    await svc.index(chunks, embeddings, "qdrant", cfg)
    out = await svc.search([0.0, 0.0, 1.0, 0.0], "qdrant", cfg, top_k=3)
    assert len(out) == 1
    assert out[0].document.page_content == "hello"


@pytest.mark.asyncio
async def test_vector_store_service_recreate(qdrant_memory: AsyncQdrantClient):
    svc = VectorStoreService(qdrant_client=qdrant_memory)
    cfg = VectorStoreRuntimeConfig(collection_name="rec_kb", vector_size=2, metric="cosine")
    await svc.index(
        [Document(page_content="old", metadata={})],
        [[1.0, 0.0]],
        "qdrant",
        cfg,
        recreate_collection=True,
    )
    await svc.index(
        [Document(page_content="new", metadata={})],
        [[0.0, 1.0]],
        "qdrant",
        cfg,
        recreate_collection=True,
    )
    hits = await svc.search([0.0, 1.0], "qdrant", cfg, top_k=5)
    texts = {h.document.page_content for h in hits}
    assert "new" in texts
    assert "old" not in texts


@pytest.mark.asyncio
async def test_weaviate_ensure_and_upsert_search_mocked():
    """Weaviate path via REST — mocked httpx (no running Weaviate)."""
    from app.core.vectorstore.weaviate_client import WeaviateVectorStore

    store = WeaviateVectorStore(
        base_url="http://weaviate.test",
        class_name="RAGChunk",
        vector_size=2,
        api_key=None,
    )

    schema_get = httpx.Response(404)
    schema_post = httpx.Response(200)
    batch_post = httpx.Response(200)
    gql_response = {
        "data": {
            "Get": {
                "RAGChunk": [
                    {
                        "page_content": "from gql",
                        "meta_json": json.dumps({"src": "x"}),
                        "_additional": {"distance": 0.5},
                    }
                ]
            }
        }
    }
    gql_post = httpx.Response(200, json=gql_response)

    async def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if request.method == "GET" and path.endswith("/schema/RAGChunk"):
            return schema_get
        if request.method == "POST" and path.endswith("/schema") and "batch" not in path:
            return schema_post
        if request.method == "POST" and path.endswith("/batch/objects"):
            return batch_post
        if request.method == "POST" and path.endswith("/graphql"):
            return gql_post
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)

    def client_factory() -> httpx.AsyncClient:
        return httpx.AsyncClient(
            transport=transport,
            base_url="http://weaviate.test",
            headers=store._headers,
        )

    store._client = client_factory  # type: ignore[method-assign]

    await store.ensure_collection(2, "cosine")
    await store.upsert([(Document(page_content="x", metadata={"a": 1}), [0.1, 0.2])])
    hits = await store.search([0.1, 0.2], top_k=3)

    assert len(hits) == 1
    assert hits[0].document.page_content == "from gql"
    assert hits[0].document.metadata.get("src") == "x"


@pytest.mark.asyncio
async def test_vector_store_service_requires_qdrant_for_qdrant_provider():
    svc = VectorStoreService(qdrant_client=None)
    cfg = VectorStoreRuntimeConfig(collection_name="x", vector_size=2)
    with pytest.raises(VectorStoreConfigurationError):
        await svc.index([Document(page_content="a", metadata={})], [[1.0, 0.0]], "qdrant", cfg)


@pytest.mark.asyncio
async def test_index_length_mismatch_raises():
    svc = VectorStoreService(qdrant_client=MagicMock())
    cfg = VectorStoreRuntimeConfig(collection_name="x", vector_size=2)
    with pytest.raises(ValueError, match="same length"):
        await svc.index(
            [Document(page_content="a", metadata={})],
            [[1.0, 0.0], [0.0, 1.0]],
            "qdrant",
            cfg,
        )
