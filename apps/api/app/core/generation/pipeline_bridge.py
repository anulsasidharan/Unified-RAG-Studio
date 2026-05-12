"""Map validated P1-3 ``GenerationConfigSchema`` to runtime dataclasses."""

from __future__ import annotations

from app.schemas.pipeline import GenerationConfigSchema

from .strategies import GenerationRuntimeConfig


def generation_runtime_from_pipeline(cfg: GenerationConfigSchema) -> GenerationRuntimeConfig:
    """Convert ``GenerationConfigSchema`` to ``GenerationRuntimeConfig``."""
    prov = cfg.provider if isinstance(cfg.provider, str) else str(cfg.provider.value)
    out_fmt = cfg.output_format
    out_s: str | None
    if out_fmt is None:
        out_s = None
    elif isinstance(out_fmt, str):
        out_s = out_fmt
    else:
        out_s = str(out_fmt.value)
    few: tuple[tuple[str, str], ...] = ()
    if cfg.few_shot_messages:
        few = tuple((str(m.role), m.content) for m in cfg.few_shot_messages)

    return GenerationRuntimeConfig(
        model=cfg.model,
        provider=prov,
        temperature=cfg.temperature,
        max_tokens=cfg.max_tokens,
        top_p=cfg.top_p,
        system_prompt=cfg.system_prompt,
        output_format=out_s,
        few_shots=few,
        persona=cfg.persona,
        citation_grounding=bool(cfg.citation_grounding),
    )
