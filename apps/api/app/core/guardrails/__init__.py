"""Guardrails core infrastructure — P4.5-1.

Provides abstract :class:`Guardrail`, :class:`GuardrailManager` for ordered
per-stage execution, and :class:`GuardrailOrchestrator` for input / retrieval /
output entry points. Later phases add concrete detectors and pipeline wiring.
"""

from .base import Guardrail
from .manager import GuardrailManager
from .orchestrator import GuardrailOrchestrator, RetrievalGuardPayload
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
]
