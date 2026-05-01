"""Weaviate vector index — optional; uses Weaviate v1 REST + GraphQL (``httpx``).

Works against any Weaviate deployment reachable at ``base_url`` without the
official ``weaviate-client`` package. Class name defaults to ``collection_name``.
"""

from __future__ import annotations

import json
from typing import Any
import uuid

import httpx
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


def _json_safe_metadata(meta: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in meta.items():
        if isinstance(v, (str, int, float, bool)) or v is None:
            out[k] = v
        elif isinstance(v, list) and all(isinstance(x, str) for x in v):
            out[k] = v
        else:
            out[k] = str(v)
    return out


class WeaviateVectorStore(VectorStoreClient):
    """Async Weaviate access via HTTP (schema + batch + GraphQL ``nearVector``)."""

    def __init__(
        self,
        *,
        base_url: str,
        class_name: str,
        vector_size: int,
        api_key: str | None = None,
    ) -> None:
        if not class_name.replace("_", "").isalnum():
            raise VectorStoreConfigurationError(
                "Weaviate class_name must be alphanumeric (underscore allowed) for GraphQL safety."
            )
        self._base = base_url.rstrip("/")
        self._class = class_name
        self._vector_size = vector_size
        self._headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            self._headers["Authorization"] = f"Bearer {api_key}"

    @property
    def collection_name(self) -> str:
        return self._class

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self._base, headers=self._headers, timeout=60.0)

    async def delete_collection(self) -> None:
        async with self._client() as client:
            r = await client.delete(f"/v1/schema/{self._class}")
            if r.status_code not in (200, 204, 404):
                r.raise_for_status()
        logger.info("weaviate_class_deleted", class_name=self._class)

    async def ensure_collection(self, vector_size: int, metric: str) -> None:
        if vector_size != self._vector_size:
            raise VectorStoreConfigurationError(
                f"Weaviate vector size mismatch: {vector_size} vs client {self._vector_size}."
            )
        dist = metric.lower()
        if dist in ("cosine", "cos"):
            distance = "cosine"
        elif dist in ("euclidean", "l2"):
            distance = "l2-squared"
        elif dist in ("dot", "ip"):
            distance = "dot"
        else:
            distance = "cosine"

        async with self._client() as client:
            r = await client.get(f"/v1/schema/{self._class}")
            if r.status_code == 200:
                return
            if r.status_code != 404:
                r.raise_for_status()

            schema = {
                "class": self._class,
                "vectorizer": "none",
                "vectorIndexConfig": {"distance": distance},
                "properties": [
                    {"name": "page_content", "dataType": ["text"]},
                    {"name": "meta_json", "dataType": ["text"]},
                ],
            }
            cr = await client.post("/v1/schema", content=json.dumps(schema))
            if cr.status_code not in (200, 201):
                raise VectorStoreConfigurationError(
                    f"Weaviate schema create failed: {cr.status_code} {cr.text}"
                )
        logger.info("weaviate_class_created", class_name=self._class, distance=distance)

    async def upsert(self, pairs: list[tuple[Document, Embedding]]) -> None:
        if not pairs:
            return
        objects = []
        for doc, vec in pairs:
            if len(vec) != self._vector_size:
                raise ValueError("Embedding length does not match vector_size.")
            meta = _json_safe_metadata(dict(doc.metadata))
            objects.append(
                {
                    "class": self._class,
                    "id": str(uuid.uuid4()),
                    "properties": {
                        "page_content": doc.page_content,
                        "meta_json": json.dumps(meta),
                    },
                    "vector": vec,
                }
            )
        async with self._client() as client:
            br = await client.post("/v1/batch/objects", content=json.dumps({"objects": objects}))
            if br.status_code not in (200, 204):
                raise VectorStoreConfigurationError(
                    f"Weaviate batch upsert failed: {br.status_code} {br.text}"
                )
        logger.info("weaviate_upsert_complete", class_name=self._class, count=len(objects))

    async def search(
        self,
        query_vector: Embedding,
        *,
        top_k: int = 5,
        filters: list[VectorSearchFilter] | None = None,
        score_threshold: float | None = None,
    ) -> list[ScoredDoc]:
        if filters:
            # GraphQL where filter is provider-specific; skip for minimal REST client.
            logger.warning("weaviate_filters_ignored", class_name=self._class)

        gql = f"""
        query NearVec($vector: [Float!]!, $lim: Int!) {{
          Get {{
            {self._class}(nearVector: {{ vector: $vector }}, limit: $lim) {{
              page_content
              meta_json
              _additional {{ distance }}
            }}
          }}
        }}
        """
        body = {"query": gql, "variables": {"vector": query_vector, "lim": top_k}}
        async with self._client() as client:
            gr = await client.post("/v1/graphql", content=json.dumps(body))
            if gr.status_code != 200:
                raise VectorStoreConfigurationError(f"Weaviate GraphQL error: {gr.text}")
            data = gr.json().get("data") or {}
            items = (data.get("Get") or {}).get(self._class) or []

        out: list[ScoredDoc] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            content = item.get("page_content") or ""
            meta_raw: dict[str, Any] = {}
            mj = item.get("meta_json")
            if isinstance(mj, str) and mj:
                try:
                    meta_raw = json.loads(mj)
                except json.JSONDecodeError:
                    meta_raw = {}
            add = item.get("_additional") or {}
            dist = add.get("distance")
            score = 1.0 / (1.0 + float(dist)) if dist is not None else 0.0
            if score_threshold is not None and score < score_threshold:
                continue
            doc = Document(page_content=str(content), metadata=meta_raw)
            out.append(ScoredDoc(document=doc, score=score))
        return out
