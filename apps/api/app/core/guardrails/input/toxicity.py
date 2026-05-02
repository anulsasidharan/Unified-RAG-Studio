"""Configurable toxicity / abuse filtering — P4.5-2.

Uses word-boundary term matching plus optional regex patterns. No external ML
models; operators should extend ``blocked_terms`` and ``extra_patterns`` for
their policy (see P4.5-7 for file-based lists).
"""

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

# Matches only a dedicated self-test marker so normal traffic is unaffected
# until terms/patterns are configured.
_SELF_TEST_PATTERN = re.compile(r"___RAG_STUDIO_TOXICITY_SELF_TEST___")

_DEFAULT_EXTRA_PATTERNS: tuple[re.Pattern[str], ...] = (_SELF_TEST_PATTERN,)

# Merged with file-based regex lists (P4.5-7); keeps the self-test marker available.
DEFAULT_TOXICITY_EXTRA_PATTERNS: tuple[re.Pattern[str], ...] = _DEFAULT_EXTRA_PATTERNS


def _compile_terms(terms: frozenset[str]) -> tuple[re.Pattern[str], ...]:
    out: list[re.Pattern[str]] = []
    for t in sorted(terms, key=len, reverse=True):
        if not t.strip():
            continue
        escaped = re.escape(t.strip())
        out.append(re.compile(rf"\b{escaped}\b", re.IGNORECASE))
    return tuple(out)


class ToxicityFilterGuardrail(Guardrail):
    """Blocks when a blocked term or toxicity pattern matches."""

    def __init__(
        self,
        *,
        blocked_terms: frozenset[str] | None = None,
        extra_patterns: tuple[re.Pattern[str], ...] | None = None,
        name: str = "toxicity-filter",
    ) -> None:
        self._name = name
        terms = blocked_terms if blocked_terms is not None else frozenset()
        self._term_patterns = _compile_terms(terms)
        self._extra = extra_patterns if extra_patterns is not None else _DEFAULT_EXTRA_PATTERNS

    @property
    def name(self) -> str:
        return self._name

    @property
    def stage(self) -> GuardrailStage:
        return GuardrailStage.INPUT

    def check(self, payload: Any, *, context: GuardrailContext | None = None) -> GuardrailResult:
        text = payload if isinstance(payload, str) else ""

        for i, pat in enumerate(self._extra):
            if pat.search(text):
                return GuardrailResult(
                    guardrail_name=self.name,
                    stage=self.stage,
                    action=GuardrailAction.BLOCK,
                    message="Input blocked: toxicity / abuse policy",
                    metadata={"match": "pattern", "pattern_index": i},
                    payload_override=None,
                )

        for i, pat in enumerate(self._term_patterns):
            if pat.search(text):
                return GuardrailResult(
                    guardrail_name=self.name,
                    stage=self.stage,
                    action=GuardrailAction.BLOCK,
                    message="Input blocked: toxicity / abuse policy",
                    metadata={"match": "term", "term_index": i},
                    payload_override=None,
                )

        return GuardrailResult(
            guardrail_name=self.name,
            stage=self.stage,
            action=GuardrailAction.ALLOW,
            metadata={},
        )
