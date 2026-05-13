"""Qdrant async vector store — create, delete, upsert, dense search."""

from __future__ import annotations

from typing import Any, cast
import uuid

from langchain_core.documents import Document
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Condition,
    Distance,
    FieldCondition,
    Filter,
    MatchAny,
    MatchText,
    MatchValue,
    PointStruct,
    VectorParams,
)
import structlog

from .strategies import (
    Embedding,
    ScoredDoc,
    VectorSearchFilter,
    VectorStoreClient,
)

logger = structlog.get_logger(__name__)


def _distance(metric: str) -> Distance:
    m = metric.lower().strip()
    if m in ("cosine", "cos"):
        return Distance.COSINE
    if m in ("euclidean", "l2", "euclid"):
        return Distance.EUCLID
    if m in ("dot", "dot_product", "ip"):
        return Distance.DOT
    raise ValueError(f"Unsupported Qdrant metric: {metric!r}")


def _payload_key(filter_key: str) -> str:
    if "." in filter_key:
        return filter_key
    return f"metadata.{filter_key}"


def _match_value_scalar(v: str | int | float | bool) -> str | int | bool:
    """Map filter values to Qdrant ``MatchValue.value`` (``ValueVariants``: str | int | bool).

    ``MatchValue`` rejects ``float`` at validation time; whole-number floats become ``int``,
    other floats become ``str`` (fractional numeric equality vs payload is best-effort).
    """
    if isinstance(v, bool):
        return v
    if isinstance(v, int):
        return v
    if isinstance(v, str):
        return v
    if isinstance(v, float):
        return int(v) if v.is_integer() else str(v)
    raise TypeError(f"unsupported scalar filter value type: {type(v)!r}")


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


def _build_qdrant_filter(filters: list[VectorSearchFilter] | None) -> Filter | None:
    if not filters:
        return None
    must: list[Condition] = []
    for f in filters:
        key = _payload_key(f.key)
        op = f.operator.lower().strip()
        if op == "eq":
            if isinstance(f.value, list):
                continue
            must.append(
                FieldCondition(key=key, match=MatchValue(value=_match_value_scalar(f.value)))
            )
        elif op == "in" and isinstance(f.value, list):
            must.append(FieldCondition(key=key, match=MatchAny(any=list(f.value))))
        elif op == "contains" and isinstance(f.value, str):
            must.append(FieldCondition(key=key, match=MatchText(text=f.value)))
        elif op in ("ne", "nin"):
            # Qdrant must_not; simplified: skip complex nested for P2-4
            continue
        else:
            if isinstance(f.value, list):
                continue
            must.append(
                FieldCondition(key=key, match=MatchValue(value=_match_value_scalar(f.value)))
            )
    if not must:
        return None
    return Filter(must=must)


class QdrantVectorStore(VectorStoreClient):
    """Async Qdrant collection lifecycle + upsert + vector search."""

    def __init__(self, client: AsyncQdrantClient, collection_name: str) -> None:
        self._client = client
        self._collection = collection_name

    @property
    def collection_name(self) -> str:
        return self._collection

    async def delete_collection(self) -> None:
        try:
            await self._client.delete_collection(collection_name=self._collection)
            logger.info("qdrant_collection_deleted", collection=self._collection)
        except Exception as exc:  # noqa: BLE001 — absent collection varies by version
            msg = str(exc).lower()
            if "404" in msg or "not found" in msg or "doesn't exist" in msg:
                return
            raise

    async def ensure_collection(self, vector_size: int, metric: str) -> None:
        if await self._client.collection_exists(collection_name=self._collection):
            return
        await self._client.create_collection(
            collection_name=self._collection,
            vectors_config=VectorParams(size=vector_size, distance=_distance(metric)),
        )
        logger.info(
            "qdrant_collection_created",
            collection=self._collection,
            vector_size=vector_size,
            metric=metric,
        )

    def _to_point(self, doc: Document, vector: Embedding) -> PointStruct:
        payload: dict[str, Any] = {
            "page_content": doc.page_content,
            "metadata": _json_safe_metadata(dict(doc.metadata)),
        }
        return PointStruct(id=str(uuid.uuid4()), vector=vector, payload=payload)

    async def upsert(self, pairs: list[tuple[Document, Embedding]]) -> None:
        if not pairs:
            return
        points = [self._to_point(doc, vec) for doc, vec in pairs]
        # Stubs use List[Union[PointStruct, pb2.PointStruct]]; list is invariant.
        await self._client.upsert(
            collection_name=self._collection,
            points=cast(Any, points),
        )
        logger.info("qdrant_upsert_complete", collection=self._collection, points=len(points))

    async def search(
        self,
        query_vector: Embedding,
        *,
        top_k: int = 5,
        filters: list[VectorSearchFilter] | None = None,
        score_threshold: float | None = None,
    ) -> list[ScoredDoc]:
        qf = _build_qdrant_filter(filters)
        hits = await self._client.search(
            collection_name=self._collection,
            query_vector=query_vector,
            limit=top_k,
            query_filter=qf,
            with_payload=True,
            score_threshold=score_threshold,
        )
        out: list[ScoredDoc] = []
        for hit in hits:
            pl = hit.payload or {}
            meta = pl.get("metadata") if isinstance(pl.get("metadata"), dict) else {}
            content = pl.get("page_content")
            if not isinstance(content, str):
                content = ""
            out.append(
                ScoredDoc(
                    document=Document(page_content=content, metadata=meta),
                    score=float(hit.score),
                )
            )
        return out
