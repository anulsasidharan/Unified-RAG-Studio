"""Chunking Service — P2-2.

Entry point for the chunking layer. Provides ChunkingService, which accepts a
list of LangChain Documents (output from IngestionService) and returns a larger
list of chunk Documents with enriched metadata.

Both Designer and Autopilot modes consume this service.

Typical usage:

    from app.core.ingestion import IngestionService, IngestionSource
    from app.core.chunking import ChunkingService, ChunkingConfig

    # Step 1 — ingest
    docs = IngestionService().load(
        IngestionSource(source_type="file", path="report.pdf")
    )

    # Step 2 — chunk
    chunks = ChunkingService().chunk(
        docs,
        ChunkingConfig(strategy="recursive-character", chunk_size=512),
    )

    # Optional — score and filter
    from app.core.chunking import ChunkQualityScorer
    scorer = ChunkQualityScorer(target_size=512)
    high_quality = scorer.filter_low_quality(chunks, min_score=0.5)
"""

from langchain_core.documents import Document
import structlog

from .code_aware import CodeAwareChunker
from .document_based import HTMLSectionChunker, MarkdownHeaderChunker
from .fixed_size import FixedSizeChunker
from .optimizers import ChunkQualityMetrics, ChunkQualityScorer
from .recursive import RecursiveCharacterChunker
from .semantic import SemanticChunker
from .sentence import ParagraphChunker, SentenceChunker
from .strategies import Chunk, ChunkingConfig, TextChunker

logger = structlog.get_logger(__name__)

__all__ = [
    "ChunkingService",
    "ChunkingConfig",
    "ChunkerFactory",
    "Chunk",
    "TextChunker",
    "ChunkQualityScorer",
    "ChunkQualityMetrics",
    # Concrete chunkers exposed for direct use
    "FixedSizeChunker",
    "RecursiveCharacterChunker",
    "SemanticChunker",
    "MarkdownHeaderChunker",
    "HTMLSectionChunker",
    "SentenceChunker",
    "ParagraphChunker",
    "CodeAwareChunker",
]


# ── Strategy dispatch map ──────────────────────────────────────────────────────

_STRATEGY_MAP: dict[str, type[TextChunker]] = {
    "fixed-size": FixedSizeChunker,
    "recursive-character": RecursiveCharacterChunker,
    "semantic": SemanticChunker,
    "markdown-header": MarkdownHeaderChunker,
    "html-section": HTMLSectionChunker,
    "sentence-based": SentenceChunker,
    "paragraph-based": ParagraphChunker,
    "code-aware": CodeAwareChunker,
}


# ── Factory ───────────────────────────────────────────────────────────────────


class ChunkerFactory:
    """Selects the correct TextChunker from a strategy name string."""

    @staticmethod
    def from_strategy(strategy: str) -> TextChunker:
        """Return a chunker instance for the given strategy name."""
        chunker_cls = _STRATEGY_MAP.get(strategy)
        if chunker_cls is None:
            raise ValueError(f"Unsupported chunking strategy: {strategy!r}")
        return chunker_cls()

    @staticmethod
    def supported_strategies() -> list[str]:
        """Return all strategy names registered in the factory."""
        return sorted(_STRATEGY_MAP.keys())


# ── Service ───────────────────────────────────────────────────────────────────


class ChunkingService:
    """Splits ingested Documents into chunks using a configurable strategy.

    The pipeline for each call is:
    1. Resolve strategy → dispatch to ChunkerFactory.
    2. Run the strategy-specific splitting logic.
    3. Each returned chunk Document carries parent metadata plus chunk_index,
       total_chunks, and chunk_strategy fields.
    """

    def chunk(
        self,
        docs: list[Document],
        config: ChunkingConfig | None = None,
    ) -> list[Chunk]:
        """Chunk a list of Documents and return all resulting Chunks."""
        cfg = config or ChunkingConfig()
        chunker = ChunkerFactory.from_strategy(cfg.strategy)
        result = chunker.chunk(docs, cfg)
        logger.info(
            "chunking_complete",
            strategy=cfg.strategy,
            input_docs=len(docs),
            output_chunks=len(result),
        )
        return result

    def chunk_many(
        self,
        docs_groups: list[list[Document]],
        config: ChunkingConfig | None = None,
    ) -> list[Chunk]:
        """Chunk multiple document groups and concatenate all results."""
        all_chunks: list[Chunk] = []
        for docs in docs_groups:
            all_chunks.extend(self.chunk(docs, config))
        return all_chunks
