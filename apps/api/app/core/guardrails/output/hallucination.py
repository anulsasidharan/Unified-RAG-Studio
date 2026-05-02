"""Lexical grounding heuristic for model output vs retrieved passages — P4.5-3.

Without reference text in ``GuardrailContext.extra['reference_texts']``, checks are
skipped (``ALLOW``). This is intentional: hallucination scoring needs grounding
documents; P4.5-5 can populate ``extra`` from retrieval results.

Uses word-boundary matching of substantive tokens against joined reference text.
Produces ``WARN`` (not ``BLOCK``) to flag possibly ungrounded answers for logging
and downstream UX without hard-failing the response by default.
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

_TOKEN_RE = re.compile(r"[A-Za-z0-9]{4,}")
_STOPWORDS = frozenset(
    """a about after also an and are as at back been being both but by come could
    did does each else for from gotten had has have having here if in into is it
    its just like made make many may might more most much must no nor not of off
    on only or ought our out over same shall should some such than that the thee
    their them then there these they this those though through to too unto
    up very was we were what when where which while who whom whose why will with
    within without would you your""".split(),
)


class HallucinationHeuristicGuardrail(Guardrail):
    """Flags answers whose content overlaps weakly with provided reference passages."""

    def __init__(
        self,
        *,
        warn_if_grounding_below: float = 0.12,
        min_significant_tokens: int = 8,
        name: str = "hallucination-heuristic",
    ) -> None:
        self._name = name
        self._warn_if_grounding_below = warn_if_grounding_below
        self._min_significant_tokens = min_significant_tokens

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
                message=None,
                metadata={"skipped": "no_reference_texts"},
            )

        refs_blob = " ".join(refs).lower()
        tokens: list[str] = []
        for m in _TOKEN_RE.finditer(text.lower()):
            t = m.group(0)
            if t not in _STOPWORDS:
                tokens.append(t)

        if len(tokens) < self._min_significant_tokens:
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.ALLOW,
                metadata={"skipped": "short_answer_tokens", "token_count": len(tokens)},
            )

        anchored = sum(1 for t in tokens if re.search(rf"\b{re.escape(t)}\b", refs_blob))
        grounding_ratio = anchored / len(tokens)

        if grounding_ratio < self._warn_if_grounding_below:
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.WARN,
                message=(
                    "Output may be insufficiently grounded in retrieved passages "
                    f"(overlap ratio={grounding_ratio:.2f})"
                ),
                metadata={
                    "grounding_ratio": round(grounding_ratio, 4),
                    "token_count": len(tokens),
                    "anchored_tokens": anchored,
                },
            )

        return GuardrailResult(
            guardrail_name=self.name,
            stage=self.stage,
            action=GuardrailAction.ALLOW,
            metadata={"grounding_ratio": round(grounding_ratio, 4)},
        )
