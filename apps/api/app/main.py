"""RAG Studio — FastAPI application entry point."""

import logging
import time
import uuid
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.metadata import API_SEMVER

# ─── Structured logging setup ────────────────────────────────────────────────

def _configure_logging(log_level: str) -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer() if log_level == "DEBUG"
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, log_level, logging.INFO)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )
    logging.basicConfig(level=getattr(logging, log_level, logging.INFO))


logger = structlog.get_logger(__name__)


# ─── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown logic."""
    settings = get_settings()
    _configure_logging(settings.log_level)

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
    )

    # ── CORS ─────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Request ID + latency logging middleware ───────────────
    @app.middleware("http")
    async def request_logging_middleware(request: Request, call_next):
        start = time.perf_counter()
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
        )
        structlog.contextvars.clear_contextvars()
        return response

    # ── Routes ───────────────────────────────────────────────
    from app.routers.autopilot import router as autopilot_router
    from app.routers.designer import router as designer_router
    from app.routers.health import router as health_router
    from app.routers.jobs import router as jobs_router
    from app.routers.monitoring import router as monitoring_router
    from app.routers.projects import router as projects_router
    from app.routers.templates import router as templates_router
    from app.routers.utilities import router as utilities_router

    app.include_router(monitoring_router)
    app.include_router(health_router)
    app.include_router(utilities_router)
    app.include_router(jobs_router)
    app.include_router(autopilot_router)
    app.include_router(projects_router)
    app.include_router(templates_router)
    app.include_router(designer_router)

    return app


app = create_app()
