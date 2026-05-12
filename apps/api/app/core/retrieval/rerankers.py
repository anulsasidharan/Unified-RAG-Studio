"""Reranking adapters (Cohere Rerank API) for post-retrieval precision."""

from __future__ import annotations

import os
from typing import Protocol

import httpx
import structlog

logger = structlog.get_logger(__name__)

_COHERE_MODEL_MAP: dict[str, str] = {
    "cohere-rerank-v3": "rerank-english-v3.0",
}


def cohere_rerank_model_id(catalog_id: str | None) -> str:
    if not catalog_id:
        return "rerank-english-v3.0"
    return _COHERE_MODEL_MAP.get(catalog_id, catalog_id)


class Reranker(Protocol):
    async def rerank(
        self,
        query: str,
        documents: list[str],
        *,
        top_n: int,
    ) -> list[int]:
        """Return indices into ``documents`` in reranked order."""
        ...


class PassthroughReranker:
    """No-op reranker — returns ``range(len(documents))[:top_n]``."""

    async def rerank(
        self,
        query: str,
        documents: list[str],
        *,
        top_n: int,
    ) -> list[int]:
        n = min(top_n, len(documents))
        return list(range(n))


class CohereReranker:
    """Calls Cohere ``/v1/rerank`` (async httpx)."""

    def __init__(
        self,
        api_key: str | None = None,
        *,
        catalog_model_id: str = "cohere-rerank-v3",
    ) -> None:
        self._api_key = api_key or os.environ.get("COHERE_API_KEY")
        if not self._api_key:
            raise ValueError("Cohere rerank requires COHERE_API_KEY or api_key=...")
        self._catalog_model_id = catalog_model_id

    async def rerank(
        self,
        query: str,
        documents: list[str],
        *,
        top_n: int,
    ) -> list[int]:
        if not documents:
            return []
        top_n = min(top_n, len(documents))
        payload = {
            "model": cohere_rerank_model_id(self._catalog_model_id),
            "query": query,
            "documents": documents,
            "top_n": top_n,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        url = "https://api.cohere.ai/v1/rerank"
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        results = data.get("results") or []
        indices = [int(r["index"]) for r in results if "index" in r]
        logger.info("cohere_rerank_complete", top_n=len(indices))
        return indices

    async def rerank_with_scores(
        self,
        query: str,
        documents: list[str],
        *,
        top_n: int,
    ) -> list[tuple[int, float]]:
        """Return ``(original_index, relevance_score)`` sorted by Cohere relevance (desc)."""
        if not documents:
            return []
        top_n = min(top_n, len(documents))
        payload = {
            "model": cohere_rerank_model_id(self._catalog_model_id),
            "query": query,
            "documents": documents,
            "top_n": top_n,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        url = "https://api.cohere.ai/v1/rerank"
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        results = data.get("results") or []
        out: list[tuple[int, float]] = []
        for r in results:
            if "index" not in r:
                continue
            idx = int(r["index"])
            raw = r.get("relevance_score")
            try:
                sc = float(raw) if raw is not None else 0.0
            except (TypeError, ValueError):
                sc = 0.0
            out.append((idx, sc))
        logger.info("cohere_rerank_scored_complete", top_n=len(out))
        return out
