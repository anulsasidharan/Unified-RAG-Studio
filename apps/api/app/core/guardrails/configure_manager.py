"""Build a :class:`GuardrailManager` from saved pipeline policy — P4.5-5 / P4.5-7."""

from __future__ import annotations

from app.config import get_settings
from app.schemas.guardrails import GuardrailsConfigSchema

from .input import clear_input_guardrails, register_default_input_guardrails
from .input.toxicity import DEFAULT_TOXICITY_EXTRA_PATTERNS
from .manager import GuardrailManager
from .output import clear_output_guardrails, register_default_output_guardrails
from .policy_loader import (
    load_bias_operator_policy,
    load_content_filter_operator_policy,
    load_toxicity_operator_policy,
)
from .retrieval import clear_retrieval_guardrails, register_default_retrieval_guardrails
from .retrieval.bias import DEFAULT_BIAS_HEURISTIC_PATTERNS
from .retrieval.content_filter import DEFAULT_RETRIEVAL_FILTER_EXTRA_PATTERNS


def build_guardrail_manager(cfg: GuardrailsConfigSchema | None) -> GuardrailManager:
    """Return a fresh manager with INPUT / RETRIEVAL / OUTPUT rails per *cfg*.

    When *cfg* is ``None``, uses :class:`GuardrailsConfigSchema` defaults (all stages on).

    Optional JSON policy files (see :mod:`app.core.guardrails.policy_loader` and
    ``Settings.guardrails_*_policy_path``) extend toxicity, retrieval content filter,
    and bias heuristics without changing saved pipeline JSON.
    """
    policy = cfg or GuardrailsConfigSchema()
    m = GuardrailManager()

    settings = get_settings()
    tox = load_toxicity_operator_policy(
        settings.guardrails_toxicity_policy_path,
        default_extra=DEFAULT_TOXICITY_EXTRA_PATTERNS,
    )
    cf = load_content_filter_operator_policy(
        settings.guardrails_content_filter_policy_path,
        default_extra=DEFAULT_RETRIEVAL_FILTER_EXTRA_PATTERNS,
    )
    bias = load_bias_operator_policy(
        settings.guardrails_bias_patterns_policy_path,
        default_patterns=DEFAULT_BIAS_HEURISTIC_PATTERNS,
    )

    tox_kw: dict[str, object] = {}
    if tox is not None:
        tox_kw["toxicity_blocked_terms"] = tox.blocked_terms
        tox_kw["toxicity_extra_patterns"] = tox.extra_patterns

    clear_input_guardrails(m)
    if policy.input.enabled:
        register_default_input_guardrails(
            m,
            pii=policy.input.pii_redaction_enabled,
            prompt_injection=policy.input.prompt_injection_block_enabled,
            toxicity=policy.input.toxicity_block_enabled,
            **tox_kw,
        )

    ret_kw: dict[str, object] = {}
    if cf is not None:
        ret_kw["content_blocked_terms"] = cf.blocked_terms
        ret_kw["content_extra_patterns"] = cf.extra_patterns
    if bias is not None:
        ret_kw["bias_patterns"] = bias.patterns

    clear_retrieval_guardrails(m)
    if policy.retrieval.enabled:
        register_default_retrieval_guardrails(
            m,
            content_filter=policy.retrieval.content_filter_enabled,
            source_validation=policy.retrieval.source_validation_enabled,
            bias_heuristic=policy.retrieval.bias_detection_enabled,
            **ret_kw,
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
