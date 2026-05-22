"""Fixed-size chunker — splits text by raw character count.

Produces maximally uniform chunk sizes with no preference for natural language
boundaries. Best suited for structured data (CSV rows, log lines) or when
downstream token budgets must be tightly controlled.
"""

from langchain_core.documents import Document
import structlog

from .strategies import Chunk, ChunkingConfig, TextChunker

logger = structlog.get_logger(__name__)


class FixedSizeChunker(TextChunker):
    """Splits text into fixed-length character windows with overlap.

    Each chunk is exactly `chunk_size` characters wide (except the last, which
    may be shorter). The sliding window advances by `chunk_size - chunk_overlap`
    characters per step.
    """

    def chunk(self, docs: list[Document], config: ChunkingConfig) -> list[Chunk]:
        size = config.chunk_size
        overlap = min(config.chunk_overlap, size - 1)
        step = max(size - overlap, 1)

        result: list[Chunk] = []
        for doc in docs:
            text = doc.page_content
            if not text.strip():
                continue

            raw_chunks: list[str] = []
            start = 0
            while start < len(text):
                raw_chunks.append(text[start : start + size])
                if start + size >= len(text):
                    break
                start += step

            total = len(raw_chunks)
            for i, chunk_text in enumerate(raw_chunks):
                if chunk_text.strip():
                    result.append(
                        self._make_chunk(chunk_text, doc.metadata, i, total, "fixed-size")
                    )

        logger.info("fixed_size_chunked", input_docs=len(docs), output_chunks=len(result))
        return result
