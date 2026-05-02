"""Lightweight bias / stereotype heuristics on retrieved text — P4.5-4.

Scans the user query plus each chunk's ``page_content`` for configurable regex
patterns. A match yields **WARN** (does not drop chunks by default). Operators
extend patterns for their locale and policy; defaults include only a self-test
marker so production traffic is unaffected until configured (see P4.5-7).
"""

from __future__ import annotations

import re
from typing import Any

from app.core.guardrails.base import Guardrail
from app.core.guardrails.orchestrator import RetrievalGuardPayload
from app.core.guardrails.types import (
    GuardrailAction,
    GuardrailContext,
    GuardrailResult,
    GuardrailStage,
)

_SELF_TEST_PATTERN = re.compile(r"___RAG_STUDIO_RETRIEVAL_BIAS_SELF_TEST___")

_DEFAULT_PATTERNS: tuple[re.Pattern[str], ...] = (_SELF_TEST_PATTERN,)


class RetrievalBiasHeuristicGuardrail(Guardrail):
    """Emits WARN when bias-related patterns appear in query or retrieved chunks."""

    def __init__(
        self,
        *,
        patterns: tuple[re.Pattern[str], ...] | None = None,
        name: str = "retrieval-bias-heuristic",
    ) -> None:
        self._name = name
        self._patterns = patterns if patterns is not None else _DEFAULT_PATTERNS

    @property
    def name(self) -> str:
        return self._name

    @property
    def stage(self) -> GuardrailStage:
        return GuardrailStage.RETRIEVAL

    def check(self, payload: Any, *, context: GuardrailContext | None = None) -> GuardrailResult:
        if not isinstance(payload, RetrievalGuardPayload):
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.ALLOW,
                metadata={"skipped": "wrong_payload_type"},
            )

        haystacks: list[tuple[str, str]] = [("query", payload.query)]
        for i, doc in enumerate(payload.documents):
            haystacks.append((f"document[{i}]", doc.page_content or ""))

        for label, text in haystacks:
            for j, pat in enumerate(self._patterns):
                if pat.search(text):
                    return GuardrailResult(
                        guardrail_name=self.name,
                        stage=self.stage,
                        action=GuardrailAction.WARN,
                        message="Retrieval flagged: bias-heuristic pattern matched",
                        metadata={"where": label, "pattern_index": j},
                    )

        return GuardrailResult(
            guardrail_name=self.name,
            stage=self.stage,
            action=GuardrailAction.ALLOW,
            metadata={},
        )
