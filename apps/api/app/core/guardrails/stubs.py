"""Reference and test guardrails — P4.5-1.

Concrete policy guardrails (PII, toxicity, etc.) land in P4.5-2 through P4.5-4.
"""

from __future__ import annotations

from typing import Any

from .base import Guardrail
from .types import (
    GuardrailAction,
    GuardrailContext,
    GuardrailResult,
    GuardrailStage,
)


class AlwaysAllowGuardrail(Guardrail):
    """No-op guardrail; useful as a placeholder or default."""

    def __init__(self, stage: GuardrailStage, *, name: str = "always-allow") -> None:
        self._stage = stage
        self._name = name

    @property
    def name(self) -> str:
        return self._name

    @property
    def stage(self) -> GuardrailStage:
        return self._stage

    def check(self, payload: Any, *, context: GuardrailContext | None = None) -> GuardrailResult:
        return GuardrailResult(
            guardrail_name=self.name,
            stage=self.stage,
            action=GuardrailAction.ALLOW,
            message=None,
            metadata={},
            payload_override=None,
        )


class BlockIfSubstringGuardrail(Guardrail):
    """Blocks when *needle* appears in a string *payload* (tests / demos only)."""

    def __init__(
        self,
        stage: GuardrailStage,
        needle: str,
        *,
        name: str = "block-substring",
    ) -> None:
        self._stage = stage
        self._needle = needle
        self._name = name

    @property
    def name(self) -> str:
        return self._name

    @property
    def stage(self) -> GuardrailStage:
        return self._stage

    def check(self, payload: Any, *, context: GuardrailContext | None = None) -> GuardrailResult:
        text = payload if isinstance(payload, str) else ""
        if self._needle in text:
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.BLOCK,
                message=f"Blocked: forbidden substring {self._needle!r}",
                metadata={"needle": self._needle},
                payload_override=None,
            )
        return GuardrailResult(
            guardrail_name=self.name,
            stage=self.stage,
            action=GuardrailAction.ALLOW,
            message=None,
            metadata={},
            payload_override=None,
        )
