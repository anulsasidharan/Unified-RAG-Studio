"""Recursive character text splitter — LangChain's default general-purpose chunker.

Tries progressively finer separators (\n\n → \n → ". " → " " → char-by-char)
until chunks fit within chunk_size. Produces natural-sounding splits for most
document types (prose, PDFs, DOCX, HTML body text).
"""

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
import structlog

from .strategies import Chunk, ChunkingConfig, TextChunker

logger = structlog.get_logger(__name__)

_DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""]


class RecursiveCharacterChunker(TextChunker):
    """Splits text with LangChain's RecursiveCharacterTextSplitter.

    Respects natural language boundaries by trying coarse separators first and
    falling back to finer ones only when a split would still exceed chunk_size.
    Custom separators can be supplied via ChunkingConfig.separators.
    """

    def chunk(self, docs: list[Document], config: ChunkingConfig) -> list[Chunk]:
        separators = config.separators or _DEFAULT_SEPARATORS
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=config.chunk_size,
            chunk_overlap=config.chunk_overlap,
            separators=separators,
            length_function=len,
        )

        result: list[Chunk] = []
        for doc in docs:
            if not doc.page_content.strip():
                continue

            splits = splitter.split_text(doc.page_content)
            total = len(splits)
            for i, text in enumerate(splits):
                if text.strip():
                    result.append(
                        self._make_chunk(text, doc.metadata, i, total, "recursive-character")
                    )

        logger.info("recursive_char_chunked", input_docs=len(docs), output_chunks=len(result))
        return result
