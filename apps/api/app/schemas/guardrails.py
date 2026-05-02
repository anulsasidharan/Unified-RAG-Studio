"""Guardrails configuration contracts — P4.5-1.

Optional per-stage toggles for when pipeline integration (P4.5-5) wires guardrails
into saved configurations.
"""

from __future__ import annotations

from pydantic import Field

from app.schemas.pipeline import RAGBaseModel


class GuardrailStageSettingsSchema(RAGBaseModel):
    """Enable or disable all guardrails for one pipeline stage."""

    enabled: bool = True


class GuardrailsConfigSchema(RAGBaseModel):
    """Top-level guardrails policy placeholder (stages default to enabled)."""

    input: GuardrailStageSettingsSchema = Field(default_factory=GuardrailStageSettingsSchema)
    retrieval: GuardrailStageSettingsSchema = Field(default_factory=GuardrailStageSettingsSchema)
    output: GuardrailStageSettingsSchema = Field(default_factory=GuardrailStageSettingsSchema)
