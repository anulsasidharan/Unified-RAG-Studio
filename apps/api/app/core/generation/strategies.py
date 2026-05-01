"""Runtime types for P2-6 Generation Service (dataclasses — not Pydantic)."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class GenerationRuntimeConfig:
    """Settings for one LLM call, mapped from ``GenerationConfigSchema`` at the router."""

    model: str
    provider: str
    temperature: float = 0.7
    max_tokens: int = 1024
    top_p: float | None = None
    system_prompt: str | None = None
    output_format: str | None = None  # text | json | markdown (matches OutputFormat)


@dataclass
class GenerationResult:
    """LLM output plus light metadata for logging and cost tooling."""

    text: str
    model: str
    provider: str
    finish_reason: str | None = None
    usage: dict[str, int] = field(default_factory=dict)
