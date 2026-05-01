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
    database_url: str = "postgresql+asyncpg://raguser:ragpass@localhost:5432/ragstudio"

    # ── Redis ─────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

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

    # ── Experiment tracking ───────────────────────────────────
    mlflow_tracking_uri: str = "http://localhost:5000"

    # ── Object storage ────────────────────────────────────────
    minio_endpoint: str = "http://localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "rag-studio-documents"

    # ── CORS ──────────────────────────────────────────────────
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:80"]

    # ── Pagination ────────────────────────────────────────────
    default_page_size: int = 20
    max_page_size: int = 100

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_test(self) -> bool:
        return self.app_env == "test"


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance.

    The lru_cache ensures settings are only loaded once per process.
    In tests, call get_settings.cache_clear() to force a reload.
    """
    return Settings()
