"""Base types and abstract vector store client for P2-4.

VectorStoreClient is implemented per provider (Qdrant, Pinecone, Weaviate).
Callers use VectorStoreService + VectorStoreFactory; schemas from P1-3 are
mapped to VectorStoreRuntimeConfig at the router boundary.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

from langchain_core.documents import Document

# Dense vector — same convention as app.core.embedding.
Embedding = list[float]


class VectorStoreConfigurationError(ValueError):
    """Missing dependency, API key, or invalid provider-specific settings."""


@dataclass
class VectorStoreRuntimeConfig:
    """Runtime settings for indexing and search (core layer — not Pydantic).

    ``collection_name`` maps from ``VectorStoreConfigSchema.index_name``.
    """

    collection_name: str
    vector_size: int
    metric: str = "cosine"  # cosine | euclidean | dot
    pinecone_index_host: str | None = None  # serverless: host from Pinecone console
    weaviate_class_name: str | None = None  # defaults to collection_name if unset


@dataclass
class VectorSearchFilter:
    """Payload filter for vector search (mirrors MetadataFilter semantics)."""

    key: str
    operator: str  # eq, ne, gt, gte, lt, lte, in, nin, contains
    value: str | int | float | bool | list[str]


@dataclass
class ScoredDoc:
    """One retrieved chunk with similarity / distance score from the engine."""

    document: Document
    score: float


class VectorStoreClient(ABC):
    """Provider-specific async vector index."""

    @property
    @abstractmethod
    def collection_name(self) -> str:
        """Logical collection / index / class name."""
        ...

    @abstractmethod
    async def delete_collection(self) -> None:
        """Drop the backing collection if it exists; no-op if absent."""
        ...

    @abstractmethod
    async def ensure_collection(self, vector_size: int, metric: str) -> None:
        """Create collection when missing; compatible params assumed if it exists."""
        ...

    @abstractmethod
    async def upsert(self, pairs: list[tuple[Document, Embedding]]) -> None:
        """Upsert (doc, vector) pairs; point IDs are generated per upsert batch."""
        ...

    @abstractmethod
    async def search(
        self,
        query_vector: Embedding,
        *,
        top_k: int = 5,
        filters: list[VectorSearchFilter] | None = None,
        score_threshold: float | None = None,
    ) -> list[ScoredDoc]:
        """Dense vector search with optional payload filters."""
        ...
