"""Base abstractions for the chunking service.

Defines the TextChunker ABC, ChunkingConfig dataclass, and Chunk type alias.
Concrete chunker implementations live in separate modules and extend TextChunker.
The Chunk type alias signals that output Documents carry enriched chunk metadata
(chunk_index, total_chunks, chunk_strategy) on top of their parent metadata.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import structlog
from langchain_core.documents import Document

logger = structlog.get_logger(__name__)

# A Chunk is a Document whose metadata carries:
#   chunk_index    — 0-based position within chunks produced from one parent doc
#   total_chunks   — total chunks produced from that parent doc
#   chunk_strategy — name of the strategy that produced this chunk
Chunk = Document


@dataclass
class ChunkingConfig:
    """Runtime configuration for the chunking pipeline.

    Common fields mirror ChunkingConfigSchema (the API-boundary Pydantic type).
    Strategy-specific extras (threshold, headers, language) are also held here
    so callers can pass them through without sub-classing.
    """

    strategy: str = "recursive-character"
    chunk_size: int = 512
    chunk_overlap: int = 50
    separators: list[str] | None = None

    # ── Semantic chunking ──────────────────────────────────────────────────────
    breakpoint_threshold: float = 0.95
    buffer_size: int = 1
    embedding_model: str = "all-MiniLM-L6-v2"

    # ── Markdown / HTML header chunking ───────────────────────────────────────
    headers_to_split_on: list[tuple[str, str]] | None = None
    return_each_line: bool = False

    # ── Code-aware chunking ───────────────────────────────────────────────────
    language: str = "auto"

    # ── Sentence-based chunking ───────────────────────────────────────────────
    sentences_per_chunk: int = 3
    sentence_overlap: int = 1


class TextChunker(ABC):
    """Abstract base for all text chunkers.

    Each concrete implementation receives a list of LangChain Documents and
    returns a (generally larger) list of Documents where each output represents
    one chunk. Parent document metadata is always propagated to every child chunk.
    """

    @abstractmethod
    def chunk(self, docs: list[Document], config: ChunkingConfig) -> list[Chunk]:
        """Split documents into chunks and return enriched chunk Documents."""
        ...

    def _make_chunk(
        self,
        text: str,
        parent_meta: dict[str, Any],
        chunk_index: int,
        total_chunks: int,
        strategy: str,
    ) -> Chunk:
        """Build a chunk Document by merging parent metadata with chunk fields."""
        meta = {
            **parent_meta,
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "chunk_strategy": strategy,
        }
        return Document(page_content=text, metadata=meta)
