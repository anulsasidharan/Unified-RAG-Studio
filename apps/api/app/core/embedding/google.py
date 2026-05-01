"""Google embedding model wrapper.

Supports google-textembedding-gecko (text-embedding-004) via the
langchain-google-genai package. The Gemini Embeddings API is used rather
than Vertex AI, so only a google_api_key is required (no service account).
"""

import importlib
from typing import Protocol

import structlog

from .strategies import Embedding, EmbeddingConfig, TextEmbedder

logger = structlog.get_logger(__name__)

# Maps catalog model IDs → Google Generative AI model names
_MODEL_MAP: dict[str, str] = {
    "google-textembedding-gecko": "models/text-embedding-004",
}

_DEFAULT_BATCH_SIZE = 100


class _GoogleGenerativeAIEmbeddingsClient(Protocol):
    """LangChain GoogleGenerativeAIEmbeddings surface used by this wrapper."""

    def embed_documents(self, texts: list[str]) -> list[Embedding]: ...

    def embed_query(self, text: str) -> Embedding: ...


class GoogleEmbedder(TextEmbedder):
    """Wraps Google's text-embedding-004 via langchain-google-genai."""

    def _resolve_model(self, catalog_id: str) -> str:
        return _MODEL_MAP.get(catalog_id, catalog_id)

    def _build_client(self, config: EmbeddingConfig) -> _GoogleGenerativeAIEmbeddingsClient:
        from app.config import get_settings

        genai_mod = importlib.import_module("langchain_google_genai")
        GoogleGenerativeAIEmbeddings = getattr(genai_mod, "GoogleGenerativeAIEmbeddings")

        return GoogleGenerativeAIEmbeddings(
            model=self._resolve_model(config.model),
            google_api_key=get_settings().google_api_key,
        )

    def embed_documents(self, texts: list[str], config: EmbeddingConfig) -> list[Embedding]:
        client = self._build_client(config)
        batch = config.batch_size or _DEFAULT_BATCH_SIZE

        results: list[Embedding] = []
        for i in range(0, len(texts), batch):
            results.extend(client.embed_documents(texts[i : i + batch]))

        logger.info("google_embedded", model=config.model, input_texts=len(texts))
        return results

    def embed_query(self, text: str, config: EmbeddingConfig) -> Embedding:
        client = self._build_client(config)
        return client.embed_query(text)
