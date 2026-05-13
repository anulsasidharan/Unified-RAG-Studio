"""OpenAI embedding model wrapper.

Supports text-embedding-3-small, text-embedding-3-large, and text-embedding-ada-002.
The v3 models accept a `dimensions` parameter for Matryoshka dimensionality reduction;
ada-002 does not and that parameter is silently ignored.
"""

import importlib
from typing import Any, Protocol

import structlog

from .strategies import Embedding, EmbeddingConfig, TextEmbedder

logger = structlog.get_logger(__name__)

# Models that support the dimensions parameter (Matryoshka compression)
_DIMENSIONS_SUPPORTED = {"text-embedding-3-small", "text-embedding-3-large"}
_DEFAULT_BATCH_SIZE = 100


class _OpenAIEmbeddingsClient(Protocol):
    """LangChain OpenAIEmbeddings surface used by this wrapper."""

    def embed_documents(self, texts: list[str]) -> list[Embedding]: ...

    def embed_query(self, text: str) -> Embedding: ...


class OpenAIEmbedder(TextEmbedder):
    """Wraps OpenAI's embedding API via langchain-openai."""

    def _build_client(self, config: EmbeddingConfig) -> _OpenAIEmbeddingsClient:
        from app.config import get_settings

        openai_mod = importlib.import_module("langchain_openai")
        OpenAIEmbeddings = openai_mod.OpenAIEmbeddings  # noqa: N806

        kwargs: dict[str, Any] = {
            "model": config.model,
            "openai_api_key": get_settings().openai_api_key,
        }
        if config.model in _DIMENSIONS_SUPPORTED and config.dimensions:
            kwargs["dimensions"] = config.dimensions

        return OpenAIEmbeddings(**kwargs)

    def embed_documents(self, texts: list[str], config: EmbeddingConfig) -> list[Embedding]:
        client = self._build_client(config)
        batch = config.batch_size or _DEFAULT_BATCH_SIZE

        results: list[Embedding] = []
        for i in range(0, len(texts), batch):
            results.extend(client.embed_documents(texts[i : i + batch]))

        logger.info("openai_embedded", model=config.model, input_texts=len(texts))
        return results

    def embed_query(self, text: str, config: EmbeddingConfig) -> Embedding:
        client = self._build_client(config)
        return client.embed_query(text)
