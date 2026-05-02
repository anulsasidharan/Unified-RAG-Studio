"""RETRIEVAL-stage guardrails — P4.5-4 (content filter, source validation, bias)."""

from __future__ import annotations

import re

from app.core.guardrails.manager import GuardrailManager
from app.core.guardrails.types import GuardrailStage

from .bias import RetrievalBiasHeuristicGuardrail
from .content_filter import RetrievedContentFilterGuardrail
from .source_validation import SourceProvenanceGuardrail


def register_default_retrieval_guardrails(
    manager: GuardrailManager,
    *,
    content_filter: bool = True,
    source_validation: bool = True,
    bias_heuristic: bool = True,
    content_blocked_terms: frozenset[str] | None = None,
    content_extra_patterns: tuple[re.Pattern[str], ...] | None = None,
    source_required_keys: frozenset[str] | None = None,
    source_require_https_url: bool = False,
    bias_patterns: tuple[re.Pattern[str], ...] | None = None,
) -> None:
    """Register built-in RETRIEVAL guardrails on *manager*.

    Order:

    #. **`RetrievedContentFilterGuardrail`** — drop chunks matching policy; **BLOCK** if none left.
    #. **`SourceProvenanceGuardrail`** — drop chunks missing metadata / bad ``source_url``.
    #. **`RetrievalBiasHeuristicGuardrail`** — **WARN** on heuristic pattern hits.

    Pass ``source_required_keys=frozenset({...})`` to enforce provenance once
    ingestion metadata is reliable. Empty keys skip provenance filtering.
    """
    if content_filter:
        cf_kw: dict[str, object] = {}
        if content_blocked_terms is not None:
            cf_kw["blocked_terms"] = content_blocked_terms
        if content_extra_patterns is not None:
            cf_kw["extra_patterns"] = content_extra_patterns
        manager.register(RetrievedContentFilterGuardrail(**cf_kw))

    if source_validation:
        sk = source_required_keys if source_required_keys is not None else frozenset()
        if sk or source_require_https_url:
            manager.register(
                SourceProvenanceGuardrail(
                    required_metadata_keys=sk,
                    require_https_source_url=source_require_https_url,
                ),
            )

    if bias_heuristic:
        if bias_patterns is not None:
            manager.register(RetrievalBiasHeuristicGuardrail(patterns=bias_patterns))
        else:
            manager.register(RetrievalBiasHeuristicGuardrail())


def clear_retrieval_guardrails(manager: GuardrailManager) -> None:
    manager.clear_stage(GuardrailStage.RETRIEVAL)


__all__ = [
    "RetrievedContentFilterGuardrail",
    "SourceProvenanceGuardrail",
    "RetrievalBiasHeuristicGuardrail",
    "register_default_retrieval_guardrails",
    "clear_retrieval_guardrails",
]
