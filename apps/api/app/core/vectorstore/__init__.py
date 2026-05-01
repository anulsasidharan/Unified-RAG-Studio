"""Vector Store Service — P2-4.

Indexes (document, embedding) pairs into the configured provider and runs dense
vector search returning ``ScoredDoc`` (LangChain ``Document`` + score).

Typical usage (Qdrant, shared async client from FastAPI dependencies):

    from qdrant_client import AsyncQdrantClient

    from app.core.vectorstore import VectorStoreRuntimeConfig, VectorStoreService

    cfg = VectorStoreRuntimeConfig(collection_name="my_kb", vector_size=1536)
    svc = VectorStoreService(qdrant_client=client)
    await svc.index(chunks, vectors, "qdrant", cfg)
    hits = await svc.search(query_vec, "qdrant", cfg, top_k=5)

``index`` accepts parallel ``chunks`` and ``embeddings`` lists. Use
``index_pairs`` when you already have ``list[tuple[Document, Embedding]]`` from
``EmbeddingService``.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

from langchain_core.documents import Document
import structlog

from .factory import VectorStoreFactory
from .pinecone_client import PineconeVectorStore
from .qdrant_client import QdrantVectorStore
from .strategies import (
    Embedding,
    ScoredDoc,
    VectorSearchFilter,
    VectorStoreClient,
    VectorStoreConfigurationError,
    VectorStoreRuntimeConfig,
)
from .weaviate_client import WeaviateVectorStore

if TYPE_CHECKING:
    from qdrant_client import AsyncQdrantClient

logger = structlog.get_logger(__name__)

__all__ = [
    "VectorStoreFactory",
    "VectorStoreService",
    "VectorStoreRuntimeConfig",
    "VectorSearchFilter",
    "ScoredDoc",
    "Embedding",
    "VectorStoreClient",
    "VectorStoreConfigurationError",
    "QdrantVectorStore",
    "PineconeVectorStore",
    "WeaviateVectorStore",
]


class VectorStoreService:
    """High-level async API over ``VectorStoreFactory`` + ``VectorStoreClient``."""

    def __init__(
        self,
        *,
        qdrant_client: AsyncQdrantClient | None = None,
        pinecone_api_key: str | None = None,
        weaviate_url: str | None = None,
        weaviate_api_key: str | None = None,
    ) -> None:
        self._qdrant = qdrant_client
        self._pinecone_key = pinecone_api_key or os.environ.get("PINECONE_API_KEY")
        self._weaviate_url = weaviate_url or os.environ.get("WEAVIATE_URL")
        self._weaviate_key = weaviate_api_key or os.environ.get("WEAVIATE_API_KEY")

    def _create_client(self, provider: str, config: VectorStoreRuntimeConfig) -> VectorStoreClient:
        return VectorStoreFactory.create(
            provider,
            config,
            qdrant_client=self._qdrant,
            pinecone_api_key=self._pinecone_key,
            weaviate_url=self._weaviate_url,
            weaviate_api_key=self._weaviate_key,
        )

    async def index(
        self,
        chunks: list[Document],
        embeddings: list[Embedding],
        provider: str,
        config: VectorStoreRuntimeConfig,
        *,
        recreate_collection: bool = False,
    ) -> None:
        """Create collection (if needed) and upsert parallel chunk / embedding lists."""
        if len(chunks) != len(embeddings):
            raise ValueError("chunks and embeddings must have the same length.")
        pairs = list(zip(chunks, embeddings, strict=True))
        await self.index_pairs(pairs, provider, config, recreate_collection=recreate_collection)

    async def index_pairs(
        self,
        pairs: list[tuple[Document, Embedding]],
        provider: str,
        config: VectorStoreRuntimeConfig,
        *,
        recreate_collection: bool = False,
    ) -> None:
        """Upsert pre-built (Document, vector) pairs — output shape of ``EmbeddingService``."""
        client = self._create_client(provider, config)
        if recreate_collection:
            await client.delete_collection()
        await client.ensure_collection(config.vector_size, config.metric)
        await client.upsert(pairs)
        logger.info(
            "vectorstore_index_complete",
            provider=provider,
            collection=config.collection_name,
            points=len(pairs),
        )

    async def search(
        self,
        query_vector: Embedding,
        provider: str,
        config: VectorStoreRuntimeConfig,
        *,
        top_k: int = 5,
        filters: list[VectorSearchFilter] | None = None,
        score_threshold: float | None = None,
    ) -> list[ScoredDoc]:
        """Dense vector search; returns ranked ``ScoredDoc`` list."""
        client = self._create_client(provider, config)
        await client.ensure_collection(config.vector_size, config.metric)
        results = await client.search(
            query_vector,
            top_k=top_k,
            filters=filters,
            score_threshold=score_threshold,
        )
        logger.info(
            "vectorstore_search_complete",
            provider=provider,
            collection=config.collection_name,
            hits=len(results),
        )
        return results
