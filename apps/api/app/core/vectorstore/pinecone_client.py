"""Pinecone managed vector index — optional; requires SDK + API key."""

from __future__ import annotations

import asyncio
from typing import Any
import uuid

from langchain_core.documents import Document
import structlog

from .strategies import (
    Embedding,
    ScoredDoc,
    VectorSearchFilter,
    VectorStoreClient,
    VectorStoreConfigurationError,
)

logger = structlog.get_logger(__name__)


def _pinecone_module() -> Any:
    try:
        from pinecone import Pinecone
    except ImportError as e:
        raise VectorStoreConfigurationError(
            "Install the Pinecone SDK: pip install pinecone>=5.0.0"
        ) from e
    return Pinecone


def _json_safe_metadata(meta: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in meta.items():
        if isinstance(v, str | int | float | bool) or v is None:
            out[k] = v
        elif isinstance(v, list) and all(isinstance(x, str) for x in v):
            out[k] = v
        else:
            out[k] = str(v)
    return out


class PineconeVectorStore(VectorStoreClient):
    """Serverless / pod Pinecone index access (sync SDK wrapped with ``asyncio.to_thread``).

    Create the target index in the Pinecone console (or control API) before calling
    ``ensure_collection`` — this method only **validates** dimension via
    ``describe_index_stats`` when possible.
    """

    def __init__(
        self,
        *,
        api_key: str,
        index_name: str,
        dimension: int,
        index_host: str | None = None,
    ) -> None:
        if not api_key:
            raise VectorStoreConfigurationError("Pinecone api_key is empty.")
        pinecone_cls = _pinecone_module()
        self._pc = pinecone_cls(api_key=api_key)
        self._index_name = index_name
        self._dimension = dimension
        self._host = index_host
        self._index = None

    def _index_client(self):  # type: ignore[no-untyped-def]
        if self._index is None:
            if self._host:
                self._index = self._pc.Index(self._index_name, host=self._host)
            else:
                self._index = self._pc.Index(self._index_name)
        return self._index

    @property
    def collection_name(self) -> str:
        return self._index_name

    async def delete_collection(self) -> None:
        # Index lifecycle is account-level; do not auto-delete production indices.
        logger.warning("pinecone_delete_collection_skipped", index=self._index_name)

    async def ensure_collection(self, vector_size: int, metric: str) -> None:
        if vector_size != self._dimension:
            raise VectorStoreConfigurationError(
                f"Pinecone index dimension mismatch: config has {vector_size}, "
                f"client constructed with {self._dimension}."
            )
        logger.info("pinecone_index_ready", index=self._index_name, metric=metric)

    async def upsert(self, pairs: list[tuple[Document, Embedding]]) -> None:
        if not pairs:
            return

        def _run() -> None:
            idx = self._index_client()
            vectors = []
            for doc, vec in pairs:
                meta = _json_safe_metadata(dict(doc.metadata))
                meta["page_content"] = doc.page_content
                vectors.append(
                    {
                        "id": str(uuid.uuid4()),
                        "values": vec,
                        "metadata": meta,
                    }
                )
            idx.upsert(vectors=vectors)

        await asyncio.to_thread(_run)
        logger.info("pinecone_upsert_complete", index=self._index_name, count=len(pairs))

    async def search(
        self,
        query_vector: Embedding,
        *,
        top_k: int = 5,
        filters: list[VectorSearchFilter] | None = None,
        score_threshold: float | None = None,
    ) -> list[ScoredDoc]:
        pine_filter: dict[str, Any] | None = None
        if filters:
            # Minimal Pinecone metadata filter (AND of eq clauses)
            and_terms = []
            for f in filters:
                if f.operator.lower() == "eq":
                    and_terms.append({f.key: {"$eq": f.value}})
            if and_terms:
                pine_filter = {"$and": and_terms} if len(and_terms) > 1 else and_terms[0]

        def _run() -> Any:
            idx = self._index_client()
            kwargs: dict[str, Any] = {
                "vector": query_vector,
                "top_k": top_k,
                "include_metadata": True,
            }
            if pine_filter is not None:
                kwargs["filter"] = pine_filter
            return idx.query(**kwargs)

        res = await asyncio.to_thread(_run)
        matches = getattr(res, "matches", None)
        if matches is None and isinstance(res, dict):
            matches = res.get("matches", [])
        matches = matches or []
        out: list[ScoredDoc] = []
        for m in matches:
            if isinstance(m, dict):
                meta_raw = dict(m.get("metadata") or {})
                score = float(m.get("score", 0.0))
            else:
                meta_raw = dict(getattr(m, "metadata", None) or {})
                score = float(getattr(m, "score", 0.0) or 0.0)
            page_content = meta_raw.pop("page_content", "") if isinstance(meta_raw, dict) else ""
            if not isinstance(page_content, str):
                page_content = str(page_content)
            if score_threshold is not None and score < score_threshold:
                continue
            doc = Document(page_content=page_content, metadata=meta_raw)
            out.append(ScoredDoc(document=doc, score=score))
        return out
