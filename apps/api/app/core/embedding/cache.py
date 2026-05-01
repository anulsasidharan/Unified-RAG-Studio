"""Embedding cache layer.

EmbeddingCache sits transparently in front of any TextEmbedder. On a cache hit
the stored vector is returned without calling the embedding provider, eliminating
redundant API calls and their associated cost and latency.

Storage backends:
  Redis  — preferred when the Redis URL is reachable. Vectors are packed into
           compact binary (4 bytes / float) and stored with a configurable TTL.
  Memory — in-process dict fallback used when Redis is unavailable (tests,
           local dev without the Docker stack). Data is lost on process exit.

Cache key derivation:
  SHA-256 of "provider:model:dimensions:text" — stable across restarts and
  independent of batch ordering. Changing any config field invalidates old keys.
"""

import hashlib
import struct

import structlog

from .strategies import Embedding, EmbeddingConfig, TextEmbedder

logger = structlog.get_logger(__name__)

_KEY_PREFIX = "emb:"


def _cache_key(text: str, config: EmbeddingConfig) -> str:
    """Build a stable, collision-resistant cache key."""
    payload = f"{config.provider}:{config.model}:{config.dimensions}:{text}"
    digest = hashlib.sha256(payload.encode()).hexdigest()
    return _KEY_PREFIX + digest


def _pack(embedding: Embedding) -> bytes:
    """Serialize embedding to compact IEEE-754 binary (4 bytes per float)."""
    return struct.pack(f"{len(embedding)}f", *embedding)


def _unpack(data: bytes) -> Embedding:
    """Deserialize binary embedding back to list[float]."""
    n = len(data) // 4
    return list(struct.unpack(f"{n}f", data))


class EmbeddingCache:
    """Transparent embedding cache with Redis + in-memory fallback.

    Args:
        ttl_seconds: Redis key TTL. Defaults to 24 h. Ignored for memory cache.

    Usage:

        cache = EmbeddingCache()
        service = EmbeddingService(cache=cache)
        pairs = service.embed(chunks, config)
    """

    def __init__(self, ttl_seconds: int = 86_400) -> None:
        self._ttl = ttl_seconds
        self._memory: dict[str, Embedding] = {}
        self._redis: object | None = None
        self._redis_checked = False

    def _get_redis(self) -> object | None:
        """Return a live Redis client or None if unavailable."""
        if self._redis_checked:
            return self._redis

        self._redis_checked = True
        try:
            import redis
            from app.config import get_settings

            client = redis.from_url(get_settings().redis_url, decode_responses=False)
            client.ping()
            self._redis = client
        except Exception:
            self._redis = None

        return self._redis

    def get(self, text: str, config: EmbeddingConfig) -> Embedding | None:
        """Return a cached embedding or None on a cache miss."""
        key = _cache_key(text, config)

        r = self._get_redis()
        if r is not None:
            try:
                raw = r.get(key)
                if raw is not None:
                    return _unpack(raw)
            except Exception:
                pass

        return self._memory.get(key)

    def set(self, text: str, config: EmbeddingConfig, embedding: Embedding) -> None:
        """Store an embedding in the cache."""
        key = _cache_key(text, config)
        packed = _pack(embedding)

        r = self._get_redis()
        if r is not None:
            try:
                r.setex(key, self._ttl, packed)
                return
            except Exception:
                pass

        self._memory[key] = embedding

    def embed_with_cache(
        self,
        embedder: TextEmbedder,
        texts: list[str],
        config: EmbeddingConfig,
    ) -> list[Embedding]:
        """Embed texts, returning cached vectors for hits and fresh ones for misses.

        Only texts that are absent from the cache are forwarded to the embedder.
        The relative order of the returned list always matches the input list.
        """
        results: list[Embedding | None] = [None] * len(texts)
        miss_indices: list[int] = []
        miss_texts: list[str] = []

        for i, text in enumerate(texts):
            cached = self.get(text, config)
            if cached is not None:
                results[i] = cached
            else:
                miss_indices.append(i)
                miss_texts.append(text)

        if miss_texts:
            fresh = embedder.embed_documents(miss_texts, config)
            for idx, text, embedding in zip(miss_indices, miss_texts, fresh):
                self.set(text, config, embedding)
                results[idx] = embedding

        hits = len(texts) - len(miss_texts)
        logger.info(
            "embedding_cache_result",
            total=len(texts),
            hits=hits,
            misses=len(miss_texts),
        )
        return results  # type: ignore[return-value]
