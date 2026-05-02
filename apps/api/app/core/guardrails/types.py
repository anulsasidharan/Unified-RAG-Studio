"""Shared types for the guardrails layer (P4.5-1)."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class GuardrailStage(StrEnum):
    """Where in the RAG pipeline a guardrail executes."""

    INPUT = "input"
    RETRIEVAL = "retrieval"
    OUTPUT = "output"


class GuardrailAction(StrEnum):
    """Per-check outcome. Downstream code maps these to HTTP status, metrics, etc."""

    ALLOW = "allow"
    WARN = "warn"
    BLOCK = "block"
    MODIFY = "modify"


@dataclass(frozen=True)
class GuardrailContext:
    """Correlation and tenancy metadata passed through a guardrail run."""

    request_id: str | None = None
    user_id: str | None = None
    pipeline_config_id: str | None = None
    project_id: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class GuardrailResult:
    """Result of a single guardrail check."""

    guardrail_name: str
    stage: GuardrailStage
    action: GuardrailAction
    message: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    payload_override: Any | None = None

    @property
    def is_blocking(self) -> bool:
        return self.action == GuardrailAction.BLOCK


@dataclass(frozen=True)
class GuardrailPipelineResult:
    """Aggregated outcome after running all guardrails for one stage."""

    allowed: bool
    final_payload: Any
    results: tuple[GuardrailResult, ...]
    blocked_by: str | None = None

    @property
    def had_warnings(self) -> bool:
        return any(r.action == GuardrailAction.WARN for r in self.results)
