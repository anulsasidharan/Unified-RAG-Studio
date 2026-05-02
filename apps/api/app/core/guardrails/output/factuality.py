"""Numeric and date grounding vs reference passages — P4.5-3.

If specific numbers or calendar-like dates appear in the assistant answer but not
in the provided ``reference_texts``, we emit ``WARN``. This complements the broader
overlap check in ``HallucinationHeuristicGuardrail``.
"""

from __future__ import annotations

import re
from typing import Any

from app.core.guardrails.base import Guardrail
from app.core.guardrails.output.context_refs import reference_texts_from_context
from app.core.guardrails.types import (
    GuardrailAction,
    GuardrailContext,
    GuardrailResult,
    GuardrailStage,
)

# Skip tiny integers likely to appear in generic prose
_NUMERIC_RE = re.compile(r"\b\d+(?:\.\d+)?\b")
_DATEISH_RE = re.compile(
    r"\b(?:\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/](?:\d{2}|\d{4}))\b",
)


class FactualityCheckGuardrail(Guardrail):
    """Warns when verifiable literals in the answer are absent from references."""

    def __init__(
        self,
        *,
        min_integer_to_check: int = 100,
        name: str = "factuality-check",
    ) -> None:
        self._name = name
        self._min_integer_to_check = min_integer_to_check

    @property
    def name(self) -> str:
        return self._name

    @property
    def stage(self) -> GuardrailStage:
        return GuardrailStage.OUTPUT

    def check(self, payload: Any, *, context: GuardrailContext | None = None) -> GuardrailResult:
        text = payload if isinstance(payload, str) else ""
        refs = reference_texts_from_context(context)
        if not refs:
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.ALLOW,
                metadata={"skipped": "no_reference_texts"},
            )

        refs_joined_lower = "\n".join(refs).lower()

        flagged: list[str] = []

        for m in _DATEISH_RE.finditer(text):
            frag = m.group(0).lower()
            if frag not in refs_joined_lower:
                flagged.append(frag)

        for m in _NUMERIC_RE.finditer(text):
            frag = m.group(0)
            if "." in frag:
                if frag.lower() not in refs_joined_lower:
                    flagged.append(frag)
                continue
            try:
                iv = int(frag)
            except ValueError:
                continue
            if iv >= self._min_integer_to_check and frag not in refs_joined_lower:
                flagged.append(frag)

        dedup = list(dict.fromkeys(flagged))
        if dedup:
            preview = dedup[:5]
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.WARN,
                message="Answer contains numeric or date literals not found in reference passages",
                metadata={"missing_in_references": preview, "count": len(dedup)},
            )

        return GuardrailResult(
            guardrail_name=self.name,
            stage=self.stage,
            action=GuardrailAction.ALLOW,
            metadata={},
        )
