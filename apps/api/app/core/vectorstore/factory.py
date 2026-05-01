"""Factory for provider-specific ``VectorStoreClient`` instances."""

from __future__ import annotations

from qdrant_client import AsyncQdrantClient

from .pinecone_client import PineconeVectorStore
from .qdrant_client import QdrantVectorStore
from .strategies import VectorStoreClient, VectorStoreConfigurationError, VectorStoreRuntimeConfig
from .weaviate_client import WeaviateVectorStore


class VectorStoreFactory:
    """Builds a ``VectorStoreClient`` from a provider id and runtime configuration.

    Required keyword arguments depend on ``provider``:

    - **qdrant** — ``qdrant_client: AsyncQdrantClient`` (app singleton or ``:memory:`` in tests)
    - **pinecone** — ``pinecone_api_key: str``; optional ``pinecone_index_host`` on serverless
    - **weaviate** — ``weaviate_url: str``; optional ``weaviate_api_key``
    """

    _SUPPORTED = ("qdrant", "pinecone", "weaviate")

    @staticmethod
    def supported_providers() -> list[str]:
        return sorted(VectorStoreFactory._SUPPORTED)

    @staticmethod
    def create(
        provider: str,
        config: VectorStoreRuntimeConfig,
        *,
        qdrant_client: AsyncQdrantClient | None = None,
        pinecone_api_key: str | None = None,
        weaviate_url: str | None = None,
        weaviate_api_key: str | None = None,
    ) -> VectorStoreClient:
        p = provider.lower().replace("_", "-")
        if p == "qdrant":
            if qdrant_client is None:
                raise VectorStoreConfigurationError(
                    "provider='qdrant' requires keyword argument "
                    "qdrant_client=AsyncQdrantClient(...)."
                )
            return QdrantVectorStore(qdrant_client, config.collection_name)

        if p == "pinecone":
            if not pinecone_api_key:
                raise VectorStoreConfigurationError(
                    "provider='pinecone' requires keyword argument pinecone_api_key=..."
                )
            return PineconeVectorStore(
                api_key=pinecone_api_key,
                index_name=config.collection_name,
                dimension=config.vector_size,
                index_host=config.pinecone_index_host,
            )

        if p == "weaviate":
            if not weaviate_url:
                raise VectorStoreConfigurationError(
                    "provider='weaviate' requires keyword argument weaviate_url=..."
                )
            cls_name = config.weaviate_class_name or config.collection_name
            return WeaviateVectorStore(
                base_url=weaviate_url,
                class_name=cls_name,
                vector_size=config.vector_size,
                api_key=weaviate_api_key,
            )

        raise VectorStoreConfigurationError(
            f"Unsupported vector store provider {provider!r}. "
            f"Supported: {', '.join(VectorStoreFactory._SUPPORTED)}."
        )
