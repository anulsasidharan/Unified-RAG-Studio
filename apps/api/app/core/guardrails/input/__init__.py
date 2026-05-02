"""Input-stage guardrails — P4.5-2 (PII, prompt injection, toxicity)."""

from __future__ import annotations

import re

from app.core.guardrails.manager import GuardrailManager
from app.core.guardrails.types import GuardrailStage

from .injection import PromptInjectionGuardrail
from .pii import PiiRedactionGuardrail
from .toxicity import ToxicityFilterGuardrail


def register_default_input_guardrails(
    manager: GuardrailManager,
    *,
    pii: bool = True,
    prompt_injection: bool = True,
    toxicity: bool = True,
    toxicity_blocked_terms: frozenset[str] | None = None,
    toxicity_extra_patterns: tuple[re.Pattern[str], ...] | None = None,
) -> None:
    """Register built-in INPUT guardrails on *manager* (idempotent per call).

    Order: PII redaction → prompt-injection block → toxicity block.

    Pass ``toxicity_blocked_terms`` to enable term-based blocking; the default
    only includes patterns that match the self-test marker (see
    :class:`ToxicityFilterGuardrail`).
    """
    if pii:
        manager.register(PiiRedactionGuardrail(), first=True)

    if prompt_injection:
        manager.register(PromptInjectionGuardrail())

    if toxicity:
        kwargs: dict[str, frozenset[str] | tuple[re.Pattern[str], ...]] = {}
        if toxicity_blocked_terms is not None:
            kwargs["blocked_terms"] = toxicity_blocked_terms
        if toxicity_extra_patterns is not None:
            kwargs["extra_patterns"] = toxicity_extra_patterns
        manager.register(ToxicityFilterGuardrail(**kwargs))


def clear_input_guardrails(manager: GuardrailManager) -> None:
    """Remove all guardrails registered for the INPUT stage."""
    manager.clear_stage(GuardrailStage.INPUT)


__all__ = [
    "PiiRedactionGuardrail",
    "PromptInjectionGuardrail",
    "ToxicityFilterGuardrail",
    "register_default_input_guardrails",
    "clear_input_guardrails",
]
