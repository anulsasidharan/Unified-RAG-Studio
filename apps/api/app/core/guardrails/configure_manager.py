"""Build a :class:`GuardrailManager` from saved pipeline policy — P4.5-5."""

from __future__ import annotations

from app.schemas.guardrails import GuardrailsConfigSchema

from .input import clear_input_guardrails, register_default_input_guardrails
from .manager import GuardrailManager
from .output import clear_output_guardrails, register_default_output_guardrails
from .retrieval import clear_retrieval_guardrails, register_default_retrieval_guardrails


def build_guardrail_manager(cfg: GuardrailsConfigSchema | None) -> GuardrailManager:
    """Return a fresh manager with INPUT / RETRIEVAL / OUTPUT rails per *cfg*.

    When *cfg* is ``None``, uses :class:`GuardrailsConfigSchema` defaults (all stages on).
    """
    policy = cfg or GuardrailsConfigSchema()
    m = GuardrailManager()

    clear_input_guardrails(m)
    if policy.input.enabled:
        register_default_input_guardrails(
            m,
            pii=policy.input.pii_redaction_enabled,
            prompt_injection=policy.input.prompt_injection_block_enabled,
            toxicity=policy.input.toxicity_block_enabled,
        )

    clear_retrieval_guardrails(m)
    if policy.retrieval.enabled:
        register_default_retrieval_guardrails(
            m,
            content_filter=policy.retrieval.content_filter_enabled,
            source_validation=policy.retrieval.source_validation_enabled,
            bias_heuristic=policy.retrieval.bias_detection_enabled,
        )

    clear_output_guardrails(m)
    if policy.output.enabled:
        register_default_output_guardrails(
            m,
            hallucination=policy.output.hallucination_heuristic_enabled,
            factuality=policy.output.factuality_check_enabled,
            citation=policy.output.citation_verification_enabled,
        )

    return m
