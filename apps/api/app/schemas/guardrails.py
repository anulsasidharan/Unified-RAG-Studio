"""Guardrails configuration contracts — P4.5-1 … P4.5-4.

Optional per-stage toggles for when pipeline integration (P4.5-5) wires guardrails
into saved configurations.
"""

from __future__ import annotations

from pydantic import Field

from app.schemas.pipeline import RAGBaseModel


class GuardrailStageSettingsSchema(RAGBaseModel):
    """Enable or disable all guardrails for one pipeline stage."""

    enabled: bool = True


class InputStageGuardrailsSchema(GuardrailStageSettingsSchema):
    """Input-stage policy flags (P4.5-2)."""

    pii_redaction_enabled: bool = True
    prompt_injection_block_enabled: bool = True
    toxicity_block_enabled: bool = True


class OutputStageGuardrailsSchema(GuardrailStageSettingsSchema):
    """OUTPUT-stage policy flags (P4.5-3)."""

    hallucination_heuristic_enabled: bool = True
    factuality_check_enabled: bool = True
    citation_verification_enabled: bool = True


class RetrievalStageGuardrailsSchema(GuardrailStageSettingsSchema):
    """RETRIEVAL-stage policy flags (P4.5-4)."""

    content_filter_enabled: bool = True
    source_validation_enabled: bool = True
    bias_detection_enabled: bool = True


class GuardrailsConfigSchema(RAGBaseModel):
    """Top-level guardrails policy (stages default to enabled)."""

    input: InputStageGuardrailsSchema = Field(default_factory=InputStageGuardrailsSchema)
    retrieval: RetrievalStageGuardrailsSchema = Field(
        default_factory=RetrievalStageGuardrailsSchema
    )
    output: OutputStageGuardrailsSchema = Field(default_factory=OutputStageGuardrailsSchema)
