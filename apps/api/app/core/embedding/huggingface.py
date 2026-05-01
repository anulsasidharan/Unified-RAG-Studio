"""HuggingFace / sentence-transformers embedding model wrapper.

Supports BGE-large-en-v1.5, E5-large-v2, and all-MiniLM-L6-v2.
Models are loaded via sentence-transformers and cached per-instance to avoid
repeated disk I/O and weight loading across successive embed() calls.

All vectors are L2-normalised before returning so cosine similarity in the
vector store equals a simple dot product, matching upstream catalog metadata
(normalizable: true for all HF models in embeddings.json).
"""

from typing import Any

import structlog

from .strategies import Embedding, EmbeddingConfig, TextEmbedder

logger = structlog.get_logger(__name__)

# Maps catalog model IDs → HuggingFace model card names
_MODEL_MAP: dict[str, str] = {
    "bge-large-en": "BAAI/bge-large-en-v1.5",
    "e5-large-v2": "intfloat/e5-large-v2",
    "all-minilm-l6-v2": "sentence-transformers/all-MiniLM-L6-v2",
}

_DEFAULT_BATCH_SIZE = 32


class HuggingFaceEmbedder(TextEmbedder):
    """Wraps local HuggingFace sentence-transformer models.

    The model is cached per-instance so repeated calls to embed_documents()
    reuse the already-loaded weights without re-reading from disk.
    """

    def __init__(self) -> None:
        self._model_cache: dict[str, Any] = {}

    def _resolve_model(self, catalog_id: str) -> str:
        return _MODEL_MAP.get(catalog_id, catalog_id)

    def _get_model(self, hf_model_name: str) -> Any:
        if hf_model_name not in self._model_cache:
            from sentence_transformers import SentenceTransformer

            self._model_cache[hf_model_name] = SentenceTransformer(hf_model_name)
        return self._model_cache[hf_model_name]

    def embed_documents(self, texts: list[str], config: EmbeddingConfig) -> list[Embedding]:
        hf_name = self._resolve_model(config.model)
        model = self._get_model(hf_name)
        batch = config.batch_size or _DEFAULT_BATCH_SIZE

        results: list[Embedding] = []
        for i in range(0, len(texts), batch):
            embeddings = model.encode(
                texts[i : i + batch],
                show_progress_bar=False,
                normalize_embeddings=True,
            )
            results.extend(embeddings.tolist())

        logger.info("huggingface_embedded", model=config.model, input_texts=len(texts))
        return results

    def embed_query(self, text: str, config: EmbeddingConfig) -> Embedding:
        hf_name = self._resolve_model(config.model)
        model = self._get_model(hf_name)
        embedding = model.encode(text, normalize_embeddings=True)
        return embedding.tolist()
