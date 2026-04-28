"""RAG Studio — FastAPI application entry point."""

import logging
import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings

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
    )

    yield  # Application runs here

    logger.info("RAG Studio API shutting down")


# ─── Application factory ─────────────────────────────────────────────────────

def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="RAG Studio API",
        description="Unified RAG Development Platform — Designer Mode + Autopilot Mode",
        version="1.0.0",
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
        request_id = request.headers.get("X-Request-ID", "")
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)

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
    @app.get("/health", tags=["health"], include_in_schema=False)
    async def health() -> JSONResponse:
        """Basic liveness probe — returns 200 when the process is up."""
        return JSONResponse({"status": "ok", "version": "1.0.0"})

    # TODO(P2-9): import and register full routers here once built:
    # from app.routers import health, designer, autopilot, projects, templates, evaluation, deployment
    # app.include_router(health.router, prefix="/health")
    # app.include_router(designer.router, prefix="/api/designer")
    # ...

    return app


app = create_app()
