"""Semantic chunker — splits at embedding cosine-similarity drops.

Algorithm:
1. Split each document into sentences using regex boundary detection.
2. Build buffered windows (±buffer_size sentences) to give embeddings more context.
3. Encode all windows with a sentence-transformers model.
4. Compute cosine similarity between each adjacent window pair.
5. Mark a split wherever similarity drops below breakpoint_threshold.
6. Combine sentences between split boundaries into chunk text.
7. Oversized chunks are further split with RecursiveCharacterTextSplitter.
"""

import re
from typing import Any

import structlog
from langchain_core.documents import Document

from .strategies import Chunk, ChunkingConfig, TextChunker

logger = structlog.get_logger(__name__)

_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences on punctuation boundaries."""
    parts = _SENTENCE_RE.split(text.strip())
    return [s.strip() for s in parts if s.strip()]


class SemanticChunker(TextChunker):
    """Splits documents at semantic boundaries using embedding similarity.

    Requires sentence-transformers (available in requirements.txt). The model is
    cached per-instance so repeated calls to chunk() reuse the loaded weights.
    """

    def __init__(self) -> None:
        self._model_cache: dict[str, Any] = {}

    def _get_model(self, model_name: str) -> Any:
        if model_name not in self._model_cache:
            from sentence_transformers import SentenceTransformer

            self._model_cache[model_name] = SentenceTransformer(model_name)
        return self._model_cache[model_name]

    @staticmethod
    def _cosine_similarity(a: Any, b: Any) -> float:
        """Cosine similarity between two numpy embedding vectors."""
        import numpy as np

        norm_a = float(np.linalg.norm(a))
        norm_b = float(np.linalg.norm(b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    def chunk(self, docs: list[Document], config: ChunkingConfig) -> list[Chunk]:
        model = self._get_model(config.embedding_model)
        result: list[Chunk] = []

        for doc in docs:
            text = doc.page_content
            sentences = _split_sentences(text)

            if len(sentences) <= 1:
                if text.strip():
                    result.append(self._make_chunk(text, doc.metadata, 0, 1, "semantic"))
                continue

            # Build context windows around each sentence
            buf = config.buffer_size
            windows = [
                " ".join(sentences[max(0, i - buf) : i + buf + 1])
                for i in range(len(sentences))
            ]

            # Embed all windows in a single batch
            embeddings = model.encode(windows, show_progress_bar=False)

            # Identify split boundaries where similarity drops below threshold
            split_points: list[int] = []
            for i in range(len(embeddings) - 1):
                sim = self._cosine_similarity(embeddings[i], embeddings[i + 1])
                if sim < config.breakpoint_threshold:
                    split_points.append(i + 1)

            # Group sentences into semantic chunks
            boundaries = [0] + split_points + [len(sentences)]
            raw_chunks = [
                " ".join(sentences[boundaries[j] : boundaries[j + 1]])
                for j in range(len(boundaries) - 1)
            ]

            # Post-process: further split oversized chunks
            final_chunks: list[str] = []
            for chunk_text in raw_chunks:
                if len(chunk_text) > config.chunk_size * 4:
                    from langchain_text_splitters import RecursiveCharacterTextSplitter

                    splitter = RecursiveCharacterTextSplitter(
                        chunk_size=config.chunk_size,
                        chunk_overlap=config.chunk_overlap,
                    )
                    final_chunks.extend(splitter.split_text(chunk_text))
                else:
                    final_chunks.append(chunk_text)

            total = len(final_chunks)
            for i, chunk_text in enumerate(final_chunks):
                if chunk_text.strip():
                    result.append(
                        self._make_chunk(chunk_text, doc.metadata, i, total, "semantic")
                    )

        logger.info("semantic_chunked", input_docs=len(docs), output_chunks=len(result))
        return result
