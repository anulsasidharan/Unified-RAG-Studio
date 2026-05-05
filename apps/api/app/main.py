"""RAG Studio — FastAPI application entry point."""

import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.metadata import API_SEMVER
from app.observability.context import bind_request_observability, clear_observability_context
from app.observability.logging_setup import configure_logging
from app.observability.rag_metrics import observe_http_request


logger = structlog.get_logger(__name__)
_rate_limit_buckets: dict[str, list[float]] = {}


@dataclass(frozen=True)
class _RateLimitResult:
    allowed: bool
    remaining: int


def _route_template(request: Request) -> str:
    route = request.scope.get("route")
    raw = getattr(route, "path", None) if route is not None else None
    if isinstance(raw, str) and raw:
        return raw
    return request.url.path


# ─── Lifespan ────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown logic."""
    settings = get_settings()
    configure_logging(settings.log_level)

    logger.info(
        "RAG Studio API starting",
        env=settings.app_env,
        log_level=settings.log_level,
        database_kind="sqlite" if settings.database_url.startswith("sqlite") else "other",
    )

    # Host dev with SQLite: create tables from ORM metadata (Docker Postgres uses Alembic).
    if settings.database_url.startswith("sqlite"):
        from app.models import Base

        engine = create_async_engine(
            settings.database_url,
            echo=settings.is_development,
            poolclass=NullPool,
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()

    yield  # Application runs here

    logger.info("RAG Studio API shutting down")


# ─── Application factory ─────────────────────────────────────────────────────


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="RAG Studio API",
        description="Unified RAG Development Platform — Designer Mode + Autopilot Mode",
        version=API_SEMVER,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
        lifespan=lifespan,
        redirect_slashes=False,
    )

    # ── CORS ─────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=512)

    def _check_rate_limit(request: Request) -> _RateLimitResult:
        limit = max(1, int(settings.auth_rate_limit_per_minute))
        now = time.time()
        period_start = now - 60
        client_host = getattr(request.client, "host", "unknown") or "unknown"
        key = f"{client_host}:{request.method}:{request.url.path}"
        bucket = _rate_limit_buckets.setdefault(key, [])
        alive = [t for t in bucket if t >= period_start]
        if len(alive) >= limit:
            _rate_limit_buckets[key] = alive
            return _RateLimitResult(allowed=False, remaining=0)
        alive.append(now)
        _rate_limit_buckets[key] = alive
        return _RateLimitResult(allowed=True, remaining=max(0, limit - len(alive)))

    # ── Request ID, correlation ID, Prometheus HTTP metrics, latency JSON logs ───
    @app.middleware("http")
    async def observability_http_middleware(request: Request, call_next):
        start = time.perf_counter()
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            rate_limit = _check_rate_limit(request)
            if not rate_limit.allowed:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded"},
                    headers={"Retry-After": "60", "X-RateLimit-Remaining": "0"},
                )

        inbound_rid = (
            request.headers.get("X-Request-ID") or request.headers.get("x-request-id") or ""
        ).strip()
        request_id = inbound_rid if inbound_rid else str(uuid.uuid4())
        inbound_cid = (
            request.headers.get("X-Correlation-ID") or request.headers.get("x-correlation-id") or ""
        ).strip()
        correlation_id = inbound_cid if inbound_cid else request_id

        route_path = _route_template(request)

        bind_request_observability(
            request_id=request_id,
            correlation_id=correlation_id,
        )

        try:
            response = await call_next(request)
            elapsed = max(time.perf_counter() - start, 1e-9)
            duration_ms = round(elapsed * 1000, 2)
            status_code = response.status_code

            response.headers["X-Request-ID"] = request_id
            response.headers.setdefault("X-Correlation-ID", correlation_id)
            response.headers.setdefault("X-Content-Type-Options", "nosniff")
            response.headers.setdefault("X-Frame-Options", "DENY")
            response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
            response.headers.setdefault(
                "Permissions-Policy",
                "camera=(), microphone=(), geolocation=(), interest-cohort=()",
            )
            response.headers.setdefault(
                "Content-Security-Policy",
                "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
                "script-src 'self' 'unsafe-inline'; connect-src 'self' http: https: ws: wss:",
            )

            logger.info(
                "request",
                method=request.method,
                path=route_path,
                status_code=status_code,
                duration_ms=duration_ms,
                client_host=(
                    getattr(request.client, "host", None) if settings.is_development else None
                ),
            )

            if settings.prometheus_metrics_enabled:
                observe_http_request(
                    method=request.method,
                    route_template=route_path,
                    status_code=status_code,
                    duration_seconds=elapsed,
                )

            return response

        except Exception:
            elapsed = max(time.perf_counter() - start, 1e-9)

            logger.exception(
                "request_failed",
                method=request.method,
                path=route_path,
                duration_ms=round(elapsed * 1000, 2),
            )

            if settings.prometheus_metrics_enabled:
                observe_http_request(
                    method=request.method,
                    route_template=route_path,
                    status_code=500,
                    duration_seconds=elapsed,
                )

            raise

        finally:
            clear_observability_context()

    # ── Routes ───────────────────────────────────────────────
    from app.routers.analytics import router as analytics_router
    from app.routers.auth import router as auth_router
    from app.routers.autopilot import router as autopilot_router
    from app.routers.deployment import router as deployment_router
    from app.routers.designer import router as designer_router
    from app.routers.evaluation import router as evaluation_router
    from app.routers.health import router as health_router
    from app.routers.jobs import router as jobs_router
    from app.routers.monitoring import router as monitoring_router
    from app.routers.projects import router as projects_router
    from app.routers.templates import router as templates_router
    from app.routers.utilities import router as utilities_router

    app.include_router(monitoring_router)
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(utilities_router)
    app.include_router(jobs_router)
    app.include_router(analytics_router)
    app.include_router(autopilot_router)
    app.include_router(projects_router)
    app.include_router(templates_router)
    app.include_router(designer_router)
    app.include_router(evaluation_router)
    app.include_router(deployment_router)

    return app


app = create_app()
