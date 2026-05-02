"""OUTPUT-stage guardrails — P4.5-3 (hallucination heuristic, factuality, citations)."""

from __future__ import annotations

from app.core.guardrails.manager import GuardrailManager
from app.core.guardrails.types import GuardrailStage

from .citation import CitationVerificationGuardrail
from .factuality import FactualityCheckGuardrail
from .hallucination import HallucinationHeuristicGuardrail


def register_default_output_guardrails(
    manager: GuardrailManager,
    *,
    hallucination: bool = True,
    factuality: bool = True,
    citation: bool = True,
) -> None:
    """Register built-in OUTPUT guardrails on *manager*.

    Order:

    #. **`HallucinationHeuristicGuardrail`** — lexical overlap vs ``reference_texts``.
    #. **`FactualityCheckGuardrail`** — literals (large integers, dates) in references.
    #. **`CitationVerificationGuardrail`** — ``[n]`` in range ``1 .. citation_source_count``.

    Use ``*_enabled`` fields from ``OutputStageGuardrailsSchema`` in P4.5-5 wiring.
    """
    if hallucination:
        manager.register(HallucinationHeuristicGuardrail())
    if factuality:
        manager.register(FactualityCheckGuardrail())
    if citation:
        manager.register(CitationVerificationGuardrail())


def clear_output_guardrails(manager: GuardrailManager) -> None:
    manager.clear_stage(GuardrailStage.OUTPUT)


__all__ = [
    "CitationVerificationGuardrail",
    "FactualityCheckGuardrail",
    "HallucinationHeuristicGuardrail",
    "register_default_output_guardrails",
    "clear_output_guardrails",
]
