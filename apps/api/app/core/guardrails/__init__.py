"""Guardrails core infrastructure — P4.5-1 / P4.5-2 / P4.5-3.

Provides abstract :class:`Guardrail`, :class:`GuardrailManager` for ordered
per-stage execution, and :class:`GuardrailOrchestrator` for input / retrieval /
output entry points. Input/output implementations live under ``guardrails.input``
and ``guardrails.output``.
"""

from .base import Guardrail
from .input import (
    PiiRedactionGuardrail,
    PromptInjectionGuardrail,
    ToxicityFilterGuardrail,
    clear_input_guardrails,
    register_default_input_guardrails,
)
from .manager import GuardrailManager
from .orchestrator import GuardrailOrchestrator, RetrievalGuardPayload
from .output import (
    CitationVerificationGuardrail,
    FactualityCheckGuardrail,
    HallucinationHeuristicGuardrail,
    clear_output_guardrails,
    register_default_output_guardrails,
)
from .stubs import AlwaysAllowGuardrail, BlockIfSubstringGuardrail
from .types import (
    GuardrailAction,
    GuardrailContext,
    GuardrailPipelineResult,
    GuardrailResult,
    GuardrailStage,
)

__all__ = [
    "Guardrail",
    "GuardrailAction",
    "GuardrailContext",
    "GuardrailManager",
    "GuardrailOrchestrator",
    "GuardrailPipelineResult",
    "GuardrailResult",
    "GuardrailStage",
    "RetrievalGuardPayload",
    "AlwaysAllowGuardrail",
    "BlockIfSubstringGuardrail",
    "PiiRedactionGuardrail",
    "PromptInjectionGuardrail",
    "ToxicityFilterGuardrail",
    "register_default_input_guardrails",
    "clear_input_guardrails",
    "HallucinationHeuristicGuardrail",
    "FactualityCheckGuardrail",
    "CitationVerificationGuardrail",
    "register_default_output_guardrails",
    "clear_output_guardrails",
]
