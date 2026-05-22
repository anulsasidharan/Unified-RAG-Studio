"""Nomic embedding model wrapper (nomic-embed-text-v1).

Nomic's open-source model is loaded via sentence-transformers but requires
trust_remote_code=True because the model uses custom pooling code hosted on
the HuggingFace Hub. The model is cached after first load to avoid repeated
remote-code fetches across calls within the same service lifetime.

Context window: 8192 tokens — the largest of any open-source model in the
catalog, making it suitable for long-document corpora.
"""

from typing import Any

import structlog

from .strategies import Embedding, EmbeddingConfig, TextEmbedder

logger = structlog.get_logger(__name__)

_NOMIC_HF_ID = "nomic-ai/nomic-embed-text-v1"
_DEFAULT_BATCH_SIZE = 32


class NomicEmbedder(TextEmbedder):
    """Wraps nomic-embed-text-v1 via sentence-transformers.

    The model requires trust_remote_code=True and is cached after the first
    call to avoid the remote-code fetch overhead on every embed_documents call.
    """

    def __init__(self) -> None:
        self._model: Any | None = None

    def _get_model(self) -> Any:
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(
                _NOMIC_HF_ID,
                trust_remote_code=True,
            )
        return self._model

    def embed_documents(self, texts: list[str], config: EmbeddingConfig) -> list[Embedding]:
        model = self._get_model()
        batch = config.batch_size or _DEFAULT_BATCH_SIZE

        results: list[Embedding] = []
        for i in range(0, len(texts), batch):
            embeddings = model.encode(
                texts[i : i + batch],
                show_progress_bar=False,
                normalize_embeddings=True,
            )
            results.extend(embeddings.tolist())

        logger.info("nomic_embedded", model=config.model, input_texts=len(texts))
        return results

    def embed_query(self, text: str, config: EmbeddingConfig) -> Embedding:
        model = self._get_model()
        embedding = model.encode(text, normalize_embeddings=True)
        return embedding.tolist()  # type: ignore[no-any-return]
