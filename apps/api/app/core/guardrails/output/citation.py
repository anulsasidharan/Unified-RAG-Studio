"""Bracket-style citation sanity checks against a known source count — P4.5-3.

Parses citations like ``[1]``, ``[2]``. Valid range is ``1 .. citation_source_count``
(``GuardrailContext.extra['citation_source_count']``, or else ``len(reference_texts)``).

* Out-of-range indices → ``BLOCK``.
* Citations present when there are zero sources → ``WARN``.
* No citations in the answer → ``ALLOW``.
"""

from __future__ import annotations

import re
from typing import Any

from app.core.guardrails.base import Guardrail
from app.core.guardrails.output.context_refs import (
    citation_source_count,
    reference_texts_from_context,
)
from app.core.guardrails.types import (
    GuardrailAction,
    GuardrailContext,
    GuardrailResult,
    GuardrailStage,
)

_BRACKET_NUM_RE = re.compile(r"\[\s*(\d+)\s*\]")


class CitationVerificationGuardrail(Guardrail):
    """Ensures numbered bracket citations reference available sources."""

    def __init__(self, *, name: str = "citation-verification") -> None:
        self._name = name

    @property
    def name(self) -> str:
        return self._name

    @property
    def stage(self) -> GuardrailStage:
        return GuardrailStage.OUTPUT

    def check(self, payload: Any, *, context: GuardrailContext | None = None) -> GuardrailResult:
        text = payload if isinstance(payload, str) else ""
        refs = reference_texts_from_context(context)
        n_sources = citation_source_count(context, refs)

        indices = [int(x) for x in _BRACKET_NUM_RE.findall(text)]
        if not indices:
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.ALLOW,
                metadata={"citations_found": False},
            )

        if n_sources == 0:
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.WARN,
                message="Answer cites sources but citation_source_count is zero",
                metadata={"indices": indices},
            )

        bad = [i for i in indices if i < 1 or i > n_sources]
        if bad:
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.BLOCK,
                message=f"Invalid citation index (allowed 1-{n_sources}): {sorted(set(bad))}",
                metadata={"invalid_indices": sorted(set(bad)), "allowed_max": n_sources},
            )

        return GuardrailResult(
            guardrail_name=self.name,
            stage=self.stage,
            action=GuardrailAction.ALLOW,
            metadata={"citations_checked": True, "source_count": n_sources},
        )
