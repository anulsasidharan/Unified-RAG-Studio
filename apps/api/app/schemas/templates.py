"""Schemas for pipeline templates loaded from ``data/templates.json`` (P4-5)."""

from __future__ import annotations

import uuid

from pydantic import Field

from app.schemas.designer import SaveConfigResponse
from app.schemas.pipeline import PipelineConfigurationSchema, RAGBaseModel


class PipelineTemplate(RAGBaseModel):
    """One catalog entry: metadata + full ``PipelineConfiguration``."""

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str
    use_case: str
    complexity: str
    estimated_monthly_cost: str
    tags: list[str]
    provider_logos: list[str]
    config: PipelineConfigurationSchema


class TemplatesCatalogResponse(RAGBaseModel):
    """Wrapper matching the root object in ``templates.json``."""

    version: str
    description: str | None = None
    templates: list[PipelineTemplate]


class ApplyTemplateRequest(RAGBaseModel):
    """Body for ``POST /api/templates/{id}/apply``."""

    project_id: uuid.UUID
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class ApplyTemplateResponse(SaveConfigResponse):
    """Same as creating a config via Designer; includes ``template_id`` for clients."""

    template_id: str
