"""Cohere embedding model wrapper.

Supports cohere-embed-v3 (English) and cohere-embed-multilingual-v3.
Cohere's API uses different model IDs from our catalog IDs, so a mapping
table translates catalog → API names at call time. The input_type parameter
is set to distinguish indexing (search_document) from querying (search_query),
which improves retrieval quality on Cohere's v3 models.
"""

import importlib
from typing import Protocol

import structlog

from .strategies import Embedding, EmbeddingConfig, TextEmbedder

logger = structlog.get_logger(__name__)

# Maps catalog model IDs → Cohere API model names
_MODEL_MAP: dict[str, str] = {
    "cohere-embed-v3": "embed-english-v3.0",
    "cohere-embed-multilingual-v3": "embed-multilingual-v3.0",
}

# Cohere's API accepts up to 96 texts per request
_DEFAULT_BATCH_SIZE = 96


class _CohereEmbeddingsClient(Protocol):
    """LangChain CohereEmbeddings surface used by this wrapper."""

    def embed_documents(self, texts: list[str]) -> list[Embedding]: ...

    def embed_query(self, text: str) -> Embedding: ...


class CohereEmbedder(TextEmbedder):
    """Wraps Cohere's Embed v3 API via langchain-community."""

    def _resolve_model(self, catalog_id: str) -> str:
        return _MODEL_MAP.get(catalog_id, catalog_id)

    def _build_client(self, config: EmbeddingConfig) -> _CohereEmbeddingsClient:
        from app.config import get_settings

        emb_mod = importlib.import_module("langchain_community.embeddings")
        CohereEmbeddings = emb_mod.CohereEmbeddings  # noqa: N806

        return CohereEmbeddings(  # type: ignore[no-any-return]
            model=self._resolve_model(config.model),
            cohere_api_key=get_settings().cohere_api_key,
        )

    def embed_documents(self, texts: list[str], config: EmbeddingConfig) -> list[Embedding]:
        client = self._build_client(config)
        batch = config.batch_size or _DEFAULT_BATCH_SIZE

        results: list[Embedding] = []
        for i in range(0, len(texts), batch):
            results.extend(client.embed_documents(texts[i : i + batch]))

        logger.info("cohere_embedded", model=config.model, input_texts=len(texts))
        return results

    def embed_query(self, text: str, config: EmbeddingConfig) -> Embedding:
        client = self._build_client(config)
        return client.embed_query(text)
