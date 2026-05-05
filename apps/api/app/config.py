import uuid
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    All fields have defaults so the app can start without a .env file
    (useful for tests). Override via environment or .env file.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Silently ignore unknown env vars
    )

    # ── Application ───────────────────────────────────────────
    app_env: Literal["development", "production", "test"] = "development"
    secret_key: str = "change-me-in-production"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # ── Database ──────────────────────────────────────────────
    # Default: SQLite in cwd so `npm run dev:api` works without Docker Postgres.
    # Docker Compose sets DATABASE_URL to postgresql+asyncpg://raguser:ragpass@db:5432/ragstudio.
    # For local Postgres instead of SQLite: export DATABASE_URL=postgresql+asyncpg://raguser:ragpass@localhost:5432/ragstudio
    database_url: str = "sqlite+aiosqlite:///./ragstudio.db"

    # ── Redis ─────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Celery (async jobs; P2-8) ───────────────────────────────
    # When true, tasks run synchronously in-process (pytest / local smoke).
    celery_task_always_eager: bool = False
    # Optional separate broker/back-end (defaults mirror redis_url in celery_app)
    celery_broker_url: str = ""
    celery_result_backend: str = ""

    # Optional extra queue routing (comma-separated queue names bound by worker `-Q`)
    celery_task_default_queue: str = "default"

    # ── Vector database ───────────────────────────────────────
    qdrant_url: str = "http://localhost:6333"

    # ── LLM providers ─────────────────────────────────────────
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    cohere_api_key: str = ""
    google_api_key: str = ""
    mistral_api_key: str = ""
    # Together / vLLM / local Llama — OpenAI-compatible chat completions
    openai_compatible_base_url: str = ""
    openai_compatible_api_key: str = ""

    # RAGAS evaluation (P2-7) — uses OpenAI-compatible LangChain models
    evaluation_llm_model: str = "gpt-4o-mini"
    evaluation_embedding_model: str = "text-embedding-3-small"

    # ── Experiment tracking (P9-1) ────────────────────────────
    mlflow_tracking_uri: str = "http://localhost:5000"
    mlflow_enabled: bool = True
    mlflow_experiment_name: str = "rag-studio-autopilot"

    # ── Object storage ────────────────────────────────────────
    minio_endpoint: str = "http://localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "rag-studio-documents"
    # Autopilot multipart upload limits (P7-1)
    autopilot_upload_max_files: int = 25
    autopilot_upload_max_bytes_per_file: int = 52_428_800  # 50 MiB

    # ── CORS ──────────────────────────────────────────────────
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:80",
        "http://127.0.0.1:80",
    ]

    # ── Pagination ────────────────────────────────────────────
    default_page_size: int = 20
    max_page_size: int = 100

    # ── User scope (P4-1; replaced by JWT in P12) ─────────────
    default_user_id: uuid.UUID = uuid.UUID("00000000-0000-4000-8000-000000000001")
    # For multi-tenant SaaS, requests must be authenticated.
    auth_required: bool = True
    auth_access_token_ttl_minutes: int = 60

    # ── Email verification / password reset (P0-Auth) ─────────
    auth_email_verification_ttl_minutes: int = 60 * 24  # 24 hours
    auth_password_reset_ttl_minutes: int = 60  # 1 hour
    # Development convenience: return verification/reset tokens in API responses.
    auth_dev_return_tokens: bool = True
    # CSV list: email:password:role:user_uuid
    auth_bootstrap_users: str = (
        "admin@ragstudio.local:admin123:admin:00000000-0000-4000-8000-000000000001,"
        "user@ragstudio.local:user123:user:00000000-0000-4000-8000-000000000002"
    )
    auth_rate_limit_per_minute: int = 120

    # ── Pricing catalog (P2-9 cost estimator) ────────────────
    pricing_catalog_path: str = ""

    # ── Templates catalog (P4-5) ──────────────────────────────
    templates_catalog_path: str = ""

    # ── Prometheus / guardrail metrics (P4.5-6) ───────────────
    # When false, ``/metrics`` and ``/monitoring/guardrails`` return 404.
    prometheus_metrics_enabled: bool = True

    # ── Guardrails operator policy files (P4.5-7) ───────────────
    # JSON files: ``blocked_terms`` (string array), ``regex_patterns`` (Python regex).
    # Empty string = use code defaults (self-test markers only until configured).
    guardrails_toxicity_policy_path: str = ""
    guardrails_content_filter_policy_path: str = ""
    guardrails_bias_patterns_policy_path: str = ""

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_test(self) -> bool:
        return self.app_env == "test"

    @property
    def database_url_sync(self) -> str:
        """SQLAlchemy sync URL for Celery workers (async drivers are FastAPI-only)."""
        url = self.database_url
        if url.startswith("postgresql+asyncpg://"):
            return url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
        if "sqlite+aiosqlite://" in url:
            return "sqlite://" + url.split("sqlite+aiosqlite://", 1)[1]
        return url


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance.

    The lru_cache ensures settings are only loaded once per process.
    In tests, call get_settings.cache_clear() to force a reload.
    """
    return Settings()
