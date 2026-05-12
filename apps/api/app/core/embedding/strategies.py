"""Base abstractions for the embedding service.

Defines the TextEmbedder ABC, EmbeddingConfig dataclass, and Embedding type alias.
Concrete embedder implementations live in separate modules and extend TextEmbedder.
The Embedding type alias signals that outputs are raw float vectors ready for
upsert into a vector store.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

import structlog

logger = structlog.get_logger(__name__)

# An Embedding is a list of floats — one per dimension of the model's output space.
# The length equals EmbeddingConfig.dimensions for the chosen model.
Embedding = list[float]


@dataclass
class EmbeddingConfig:
    """Runtime configuration for the embedding pipeline.

    Common fields mirror EmbeddingConfigSchema (the API-boundary Pydantic type).
    Defaults match text-embedding-3-small so callers can construct with no args
    for prototyping and override specific fields for production.
    """

    model: str = "text-embedding-3-small"
    provider: str = "openai"
    dimensions: int = 1536
    batch_size: int | None = None   # None = use provider-specific default
    max_tokens: int | None = None   # None = use model's published maximum
    cache_embeddings: bool = False
    embedding_version: str | None = None


class TextEmbedder(ABC):
    """Abstract base for all embedding model wrappers.

    Each concrete implementation receives a list of plain strings and returns a
    parallel list of float vectors. Document metadata handling and batching are
    the caller's responsibility; the embedder only transforms text → vector.
    """

    @abstractmethod
    def embed_documents(self, texts: list[str], config: EmbeddingConfig) -> list[Embedding]:
        """Embed a batch of texts and return one vector per text."""
        ...

    @abstractmethod
    def embed_query(self, text: str, config: EmbeddingConfig) -> Embedding:
        """Embed a single query string and return its vector.

        Query embedding may differ from document embedding for models that
        distinguish retrieval roles (e.g. Cohere input_type, E5 prefixes).
        """
        ...
