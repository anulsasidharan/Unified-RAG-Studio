"""Kubernetes-style health endpoints (live vs ready probes)."""

import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
import redis.asyncio as aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qdrant_client import AsyncQdrantClient

from app.config import Settings, get_settings
from app.dependencies import get_db_session
from app.metadata import API_SEMVER

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", summary="Combined liveness (process up)")
async def health_root() -> JSONResponse:
    """Docker ``HEALTHCHECK`` and legacy callers use this route."""
    return JSONResponse({"status": "ok", "version": API_SEMVER})


@router.get("/live", summary="Liveness probe")
async def live() -> dict[str, str]:
    """Process is accepting traffic (no upstream checks)."""
    return {"status": "alive"}


@router.get("/ready", summary="Readiness probe")
async def ready(
    settings: Annotated[Settings, Depends(get_settings)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> JSONResponse:
    """Verifies Postgres plus Redis/Qdrant when not in ``APP_ENV=test``.

    Redis/Qdrant clients are opened per request so pytest does not eagerly
    connect via shared ``Depends`` factories before the handler short-circuits.
    """
    if settings.is_test:
        return JSONResponse(
            status_code=200,
            content={
                "status": "ready",
                "skipped": ["APP_ENV=test: dependency probes not run"],
                "version": API_SEMVER,
            },
        )

    checks: dict[str, dict[str, object]] = {}

    try:
        await session.execute(text("SELECT 1"))
        checks["database"] = {"ok": True}
    except Exception as exc:  # noqa: BLE001 — probe surface
        checks["database"] = {"ok": False, "detail": str(exc)}
        logger.warning("readiness_db_failed", extra={"error": str(exc)})

    redis_client: aioredis.Redis | None = None
    try:
        redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=5,
        )
        pong = await asyncio.wait_for(redis_client.ping(), timeout=2.0)
        checks["redis"] = {"ok": pong is True}
    except Exception as exc:  # noqa: BLE001
        checks["redis"] = {"ok": False, "detail": str(exc)}
    finally:
        if redis_client is not None:
            await redis_client.aclose()

    qc: AsyncQdrantClient | None = None
    try:
        qc = AsyncQdrantClient(url=settings.qdrant_url)
        await asyncio.wait_for(qc.get_collections(), timeout=3.0)
        checks["qdrant"] = {"ok": True}
    except Exception as exc:  # noqa: BLE001
        checks["qdrant"] = {"ok": False, "detail": str(exc)}
    finally:
        if qc is not None:
            await qc.close()

    all_ok = all(c.get("ok") is True for c in checks.values())
    payload: dict[str, object] = {
        "status": "ready" if all_ok else "not_ready",
        "checks": checks,
        "version": API_SEMVER,
    }
    return JSONResponse(status_code=200 if all_ok else 503, content=payload)
