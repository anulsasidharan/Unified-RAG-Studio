"""Guardrails core infrastructure — P4.5-1 … P4.5-4.

Provides abstract :class:`Guardrail`, :class:`GuardrailManager` for ordered
per-stage execution, and :class:`GuardrailOrchestrator` for input / retrieval /
output entry points. Stage implementations live under ``guardrails.input``,
``guardrails.retrieval``, and ``guardrails.output``.
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
from .retrieval import (
    RetrievalBiasHeuristicGuardrail,
    RetrievedContentFilterGuardrail,
    SourceProvenanceGuardrail,
    clear_retrieval_guardrails,
    register_default_retrieval_guardrails,
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
    "RetrievedContentFilterGuardrail",
    "SourceProvenanceGuardrail",
    "RetrievalBiasHeuristicGuardrail",
    "register_default_retrieval_guardrails",
    "clear_retrieval_guardrails",
]
