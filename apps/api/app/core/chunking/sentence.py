"""Sentence-based and paragraph-based chunkers.

SentenceChunker  — groups N consecutive sentences per chunk (regex boundary detection)
ParagraphChunker — splits on double-newline paragraph breaks
"""

import re

import structlog
from langchain_core.documents import Document

from .strategies import Chunk, ChunkingConfig, TextChunker

logger = structlog.get_logger(__name__)

# Splits on whitespace that follows a sentence-ending punctuation mark.
# Works well for English prose; does not require NLTK or spaCy.
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences on punctuation + whitespace boundaries."""
    parts = _SENTENCE_RE.split(text.strip())
    return [s.strip() for s in parts if s.strip()]


class SentenceChunker(TextChunker):
    """Groups N consecutive sentences into each chunk with optional overlap.

    `sentences_per_chunk` (default 3) controls how many sentences form a chunk.
    `sentence_overlap` (default 1) controls how many trailing sentences from the
    previous chunk are re-included at the start of the next chunk.
    """

    def chunk(self, docs: list[Document], config: ChunkingConfig) -> list[Chunk]:
        n = config.sentences_per_chunk
        overlap = min(config.sentence_overlap, n - 1)
        step = max(n - overlap, 1)

        result: list[Chunk] = []
        for doc in docs:
            sentences = _split_sentences(doc.page_content)
            if not sentences:
                continue

            raw_chunks: list[str] = []
            start = 0
            while start < len(sentences):
                window = sentences[start : start + n]
                raw_chunks.append(" ".join(window))
                if start + n >= len(sentences):
                    break
                start += step

            total = len(raw_chunks)
            for i, text in enumerate(raw_chunks):
                if text.strip():
                    result.append(
                        self._make_chunk(text, doc.metadata, i, total, "sentence-based")
                    )

        logger.info("sentence_chunked", input_docs=len(docs), output_chunks=len(result))
        return result


class ParagraphChunker(TextChunker):
    """Splits text on paragraph boundaries (two or more consecutive newlines).

    Paragraphs that exceed chunk_size × 2 characters are further split with
    RecursiveCharacterTextSplitter to keep chunks within a manageable size.
    """

    def chunk(self, docs: list[Document], config: ChunkingConfig) -> list[Chunk]:
        result: list[Chunk] = []

        for doc in docs:
            paragraphs = re.split(r"\n{2,}", doc.page_content.strip())
            paragraphs = [p.strip() for p in paragraphs if p.strip()]
            if not paragraphs:
                continue

            # Split oversized paragraphs with recursive splitter
            final_paras: list[str] = []
            for para in paragraphs:
                if len(para) > config.chunk_size * 2:
                    from langchain_text_splitters import RecursiveCharacterTextSplitter

                    splitter = RecursiveCharacterTextSplitter(
                        chunk_size=config.chunk_size,
                        chunk_overlap=config.chunk_overlap,
                    )
                    final_paras.extend(splitter.split_text(para))
                else:
                    final_paras.append(para)

            total = len(final_paras)
            for i, text in enumerate(final_paras):
                if text.strip():
                    result.append(
                        self._make_chunk(text, doc.metadata, i, total, "paragraph-based")
                    )

        logger.info("paragraph_chunked", input_docs=len(docs), output_chunks=len(result))
        return result
