"""Heuristic prompt-injection detection for user input — P4.5-2."""

from __future__ import annotations

import re
from typing import Any

from app.core.guardrails.base import Guardrail
from app.core.guardrails.types import (
    GuardrailAction,
    GuardrailContext,
    GuardrailResult,
    GuardrailStage,
)

# High-signal patterns only; extend via PromptInjectionGuardrail(extra_patterns=...)
_DEFAULT_INJECTION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"ignore\s+(?:all\s+)?(?:(?:previous|prior|above)\s+)?instructions?",
        re.IGNORECASE,
    ),
    re.compile(r"disregard\s+(?:all\s+)?(?:previous|prior|above)", re.IGNORECASE),
    re.compile(r"override\s+(?:the\s+)?(?:system|safety)\s+", re.IGNORECASE),
    re.compile(r"new\s+instructions?\s*:", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(?:a|an)\s+", re.IGNORECASE),
    re.compile(r"developer\s+message\s*:", re.IGNORECASE),
    re.compile(r"<\s*\|?\s*(?:system|assistant)\s*\|?\s*>", re.IGNORECASE),
    re.compile(r"\[\s*INST\s*\]", re.IGNORECASE),
    re.compile(r"jailbreak", re.IGNORECASE),
    re.compile(r"\bDAN\b\s+mode", re.IGNORECASE),
    re.compile(r"reveal\s+(?:the\s+)?(?:hidden\s+)?(?:system\s+)?prompt", re.IGNORECASE),
)


class PromptInjectionGuardrail(Guardrail):
    """Blocks likely prompt-injection or instruction-override attempts."""

    def __init__(
        self,
        *,
        patterns: tuple[re.Pattern[str], ...] = _DEFAULT_INJECTION_PATTERNS,
        name: str = "prompt-injection",
    ) -> None:
        self._name = name
        self._patterns = patterns

    @property
    def name(self) -> str:
        return self._name

    @property
    def stage(self) -> GuardrailStage:
        return GuardrailStage.INPUT

    def check(self, payload: Any, *, context: GuardrailContext | None = None) -> GuardrailResult:
        text = payload if isinstance(payload, str) else ""
        for i, pat in enumerate(self._patterns):
            if pat.search(text):
                return GuardrailResult(
                    guardrail_name=self.name,
                    stage=self.stage,
                    action=GuardrailAction.BLOCK,
                    message="Input blocked: possible prompt-injection pattern detected",
                    metadata={"pattern_index": i},
                    payload_override=None,
                )
        return GuardrailResult(
            guardrail_name=self.name,
            stage=self.stage,
            action=GuardrailAction.ALLOW,
            metadata={},
        )
