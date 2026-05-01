"""Instantiate LangChain chat models per catalog provider (P2-6)."""

from __future__ import annotations

import importlib

from langchain_core.language_models.chat_models import BaseChatModel
import structlog

from app.config import Settings

from .strategies import GenerationRuntimeConfig

logger = structlog.get_logger(__name__)

_MISTRAL_BASE_URL = "https://api.mistral.ai/v1"


def create_chat_model(cfg: GenerationRuntimeConfig, settings: Settings) -> BaseChatModel:
    """Build a ``BaseChatModel`` for ``cfg.provider`` using env credentials.

    * **openai** — ``ChatOpenAI`` + ``OPENAI_API_KEY``
    * **anthropic** — ``ChatAnthropic`` + ``ANTHROPIC_API_KEY``
    * **google** — ``ChatGoogleGenerativeAI`` + ``GOOGLE_API_KEY``
    * **cohere** — ``ChatCohere`` + ``COHERE_API_KEY`` (langchain-community)
    * **mistral** — OpenAI-compatible client pointed at Mistral API + ``MISTRAL_API_KEY``
    * **meta** / **custom** — OpenAI-compatible base URL + ``OPENAI_COMPATIBLE_*`` keys
    """
    prov = (cfg.provider if isinstance(cfg.provider, str) else str(cfg.provider)).lower()

    if prov == "openai":
        return _openai_chat(cfg, settings)
    if prov == "anthropic":
        return _anthropic_chat(cfg, settings)
    if prov == "google":
        return _google_chat(cfg, settings)
    if prov == "cohere":
        return _cohere_chat(cfg, settings)
    if prov == "mistral":
        return _mistral_chat(cfg, settings)
    if prov in ("meta", "custom"):
        return _openai_compatible_chat(cfg, settings)
    raise ValueError(f"Unsupported generation provider: {cfg.provider!r}")


def _common_kwargs(cfg: GenerationRuntimeConfig) -> dict:
    kw: dict = {
        "model": cfg.model,
        "temperature": cfg.temperature,
        "max_tokens": cfg.max_tokens,
    }
    if cfg.top_p is not None:
        kw["top_p"] = cfg.top_p
    return kw


def _openai_chat(cfg: GenerationRuntimeConfig, settings: Settings) -> BaseChatModel:
    openai_mod = importlib.import_module("langchain_openai")
    ChatOpenAI = getattr(openai_mod, "ChatOpenAI")

    kw = _common_kwargs(cfg)
    kw["api_key"] = settings.openai_api_key or None
    if cfg.output_format == "json":
        kw["model_kwargs"] = {"response_format": {"type": "json_object"}}
    logger.debug("generation_chat_model", provider="openai", model=cfg.model)
    return ChatOpenAI(**kw)


def _anthropic_chat(cfg: GenerationRuntimeConfig, settings: Settings) -> BaseChatModel:
    anthropic_mod = importlib.import_module("langchain_anthropic")
    ChatAnthropic = getattr(anthropic_mod, "ChatAnthropic")

    kw = _common_kwargs(cfg)
    kw["api_key"] = settings.anthropic_api_key or None
    logger.debug("generation_chat_model", provider="anthropic", model=cfg.model)
    return ChatAnthropic(**kw)


def _google_chat(cfg: GenerationRuntimeConfig, settings: Settings) -> BaseChatModel:
    genai_mod = importlib.import_module("langchain_google_genai")
    ChatGoogleGenerativeAI = getattr(genai_mod, "ChatGoogleGenerativeAI")

    kw: dict = {
        "model": cfg.model,
        "temperature": cfg.temperature,
        "google_api_key": settings.google_api_key or None,
        "max_output_tokens": cfg.max_tokens,
    }
    if cfg.top_p is not None:
        kw["top_p"] = cfg.top_p
    logger.debug("generation_chat_model", provider="google", model=cfg.model)
    return ChatGoogleGenerativeAI(**kw)


def _cohere_chat(cfg: GenerationRuntimeConfig, settings: Settings) -> BaseChatModel:
    try:
        lcm = importlib.import_module("langchain_community.chat_models")
        ChatCohere = getattr(lcm, "ChatCohere")
    except (ImportError, AttributeError) as exc:  # pragma: no cover — env guard
        raise ValueError(
            "Cohere chat requires langchain-community. Install apps/api requirements."
        ) from exc

    kw = _common_kwargs(cfg)
    kw["cohere_api_key"] = settings.cohere_api_key or None
    logger.debug("generation_chat_model", provider="cohere", model=cfg.model)
    return ChatCohere(**kw)


def _mistral_chat(cfg: GenerationRuntimeConfig, settings: Settings) -> BaseChatModel:
    openai_mod = importlib.import_module("langchain_openai")
    ChatOpenAI = getattr(openai_mod, "ChatOpenAI")

    if not settings.mistral_api_key:
        logger.warning("mistral_api_key_missing", model=cfg.model)
    kw = _common_kwargs(cfg)
    kw["api_key"] = settings.mistral_api_key or None
    kw["base_url"] = _MISTRAL_BASE_URL
    logger.debug("generation_chat_model", provider="mistral", model=cfg.model)
    return ChatOpenAI(**kw)


def _openai_compatible_chat(cfg: GenerationRuntimeConfig, settings: Settings) -> BaseChatModel:
    openai_mod = importlib.import_module("langchain_openai")
    ChatOpenAI = getattr(openai_mod, "ChatOpenAI")

    if not settings.openai_compatible_base_url or not settings.openai_compatible_api_key:
        raise ValueError(
            "Providers 'meta' and 'custom' require openai_compatible_base_url and "
            "openai_compatible_api_key (Together, vLLM, local Llama, etc.)."
        )
    kw = _common_kwargs(cfg)
    kw["api_key"] = settings.openai_compatible_api_key
    kw["base_url"] = settings.openai_compatible_base_url.rstrip("/")
    logger.debug("generation_chat_model", provider="openai-compatible", model=cfg.model)
    return ChatOpenAI(**kw)
