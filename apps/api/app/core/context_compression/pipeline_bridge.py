"""Map ``ContextCompressionConfigSchema`` to runtime dataclass."""

from __future__ import annotations

from app.schemas.pipeline import ContextCompressionConfigSchema

from .apply import ContextCompressionRuntimeConfig


def context_compression_runtime_from_pipeline(
    cfg: ContextCompressionConfigSchema | None,
) -> ContextCompressionRuntimeConfig | None:
    if cfg is None or not cfg.enabled:
        return None
    mode = cfg.mode if isinstance(cfg.mode, str) else str(cfg.mode)
    return ContextCompressionRuntimeConfig(
        enabled=True,
        mode=mode,
        min_score=cfg.min_score,
        max_token_budget=cfg.max_token_budget,
    )
