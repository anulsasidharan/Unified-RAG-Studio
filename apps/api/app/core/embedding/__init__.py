"""Embedding Service — P2-3.

Entry point for the embedding layer. EmbeddingService accepts a list of
LangChain Documents (output from ChunkingService) and returns a parallel list
of (Document, Embedding) pairs ready for upsert into a vector store.

Each output Document's metadata is enriched with embedding_model,
embedding_provider, and embedding_dimensions so every vector is fully
self-describing at the point of insertion into the vector store.

Typical usage:

    from app.core.chunking import ChunkingService, ChunkingConfig
    from app.core.embedding import EmbeddingService, EmbeddingConfig

    chunks = ChunkingService().chunk(docs, ChunkingConfig(strategy="recursive-character"))
    pairs = EmbeddingService().embed(chunks, EmbeddingConfig(provider="openai"))

    # With caching (avoids re-embedding duplicate texts across batches):
    from app.core.embedding import EmbeddingCache
    cache = EmbeddingCache()
    pairs = EmbeddingService(cache=cache).embed(chunks, EmbeddingConfig(provider="openai"))

    # Retrieve a query vector at search time:
    query_vec = EmbeddingService().embed_query("What is RAG?", config)
"""

from langchain_core.documents import Document
import structlog

from .benchmarker import BenchmarkResult, EmbeddingBenchmarker
from .cache import EmbeddingCache
from .cohere import CohereEmbedder
from .google import GoogleEmbedder
from .huggingface import HuggingFaceEmbedder
from .nomic import NomicEmbedder
from .openai import OpenAIEmbedder
from .strategies import Embedding, EmbeddingConfig, TextEmbedder

logger = structlog.get_logger(__name__)

__all__ = [
    "EmbeddingService",
    "EmbeddingConfig",
    "EmbedderFactory",
    "Embedding",
    "TextEmbedder",
    "EmbeddingBenchmarker",
    "BenchmarkResult",
    "EmbeddingCache",
    # Concrete embedders exposed for direct use / testing
    "OpenAIEmbedder",
    "CohereEmbedder",
    "GoogleEmbedder",
    "HuggingFaceEmbedder",
    "NomicEmbedder",
]


# ── Provider dispatch map ──────────────────────────────────────────────────────

_PROVIDER_MAP: dict[str, type[TextEmbedder]] = {
    "openai": OpenAIEmbedder,
    "cohere": CohereEmbedder,
    "google": GoogleEmbedder,
    "huggingface": HuggingFaceEmbedder,
    "nomic": NomicEmbedder,
}


# ── Factory ───────────────────────────────────────────────────────────────────


class EmbedderFactory:
    """Selects the correct TextEmbedder from a provider name string."""

    @staticmethod
    def from_provider(provider: str) -> TextEmbedder:
        """Return an embedder instance for the given provider name."""
        embedder_cls = _PROVIDER_MAP.get(provider)
        if embedder_cls is None:
            raise ValueError(f"Unsupported embedding provider: {provider!r}")
        return embedder_cls()

    @staticmethod
    def supported_providers() -> list[str]:
        """Return all provider names registered in the factory."""
        return sorted(_PROVIDER_MAP.keys())


# ── Service ───────────────────────────────────────────────────────────────────


class EmbeddingService:
    """Converts chunk Documents into (Document, Embedding) pairs.

    The pipeline for each call is:
    1. Resolve provider → dispatch to EmbedderFactory.
    2. Extract page_content from each Document.
    3. Call the embedder — optionally via EmbeddingCache for deduplication.
    4. Enrich each Document's metadata with embedding provenance fields.
    5. Return (enriched_doc, vector) pairs — the caller upserts these into the
       vector store together so the metadata and vector stay co-located.

    Args:
        cache: Optional EmbeddingCache instance. When provided, identical texts
               are served from cache without calling the embedding provider.
    """

    def __init__(self, cache: EmbeddingCache | None = None) -> None:
        self._cache = cache

    def embed(
        self,
        chunks: list[Document],
        config: EmbeddingConfig | None = None,
    ) -> list[tuple[Document, Embedding]]:
        """Embed a list of chunk Documents and return (doc, vector) pairs."""
        cfg = config or EmbeddingConfig()
        embedder = EmbedderFactory.from_provider(cfg.provider)
        texts = [c.page_content for c in chunks]

        if cfg.cache_embeddings:
            layer = self._cache or EmbeddingCache()
            vectors = layer.embed_with_cache(embedder, texts, cfg)
        elif self._cache is not None:
            vectors = self._cache.embed_with_cache(embedder, texts, cfg)
        else:
            vectors = embedder.embed_documents(texts, cfg)

        result: list[tuple[Document, Embedding]] = []
        for chunk, vector in zip(chunks, vectors, strict=False):
            enriched_meta = {
                **chunk.metadata,
                "embedding_model": cfg.model,
                "embedding_provider": cfg.provider,
                "embedding_dimensions": cfg.dimensions,
            }
            if cfg.embedding_version:
                enriched_meta["embedding_version"] = cfg.embedding_version
            result.append(
                (Document(page_content=chunk.page_content, metadata=enriched_meta), vector)
            )

        logger.info(
            "embedding_complete",
            provider=cfg.provider,
            model=cfg.model,
            input_chunks=len(chunks),
        )
        return result

    def embed_query(
        self,
        text: str,
        config: EmbeddingConfig | None = None,
    ) -> Embedding:
        """Embed a single query string for use at retrieval time."""
        cfg = config or EmbeddingConfig()
        embedder = EmbedderFactory.from_provider(cfg.provider)
        return embedder.embed_query(text, cfg)

    def embed_many(
        self,
        chunk_groups: list[list[Document]],
        config: EmbeddingConfig | None = None,
    ) -> list[tuple[Document, Embedding]]:
        """Embed multiple document groups and concatenate all (doc, vector) pairs."""
        all_pairs: list[tuple[Document, Embedding]] = []
        for chunks in chunk_groups:
            all_pairs.extend(self.embed(chunks, config))
        return all_pairs
