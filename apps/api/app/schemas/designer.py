"""Pydantic schemas for Designer Mode API endpoints.

These schemas handle the request/response shapes for:
  POST /api/designer/config   — save / create a pipeline configuration
  GET  /api/designer/config/{id}
  PUT /api/designer/config/{id}
  GET /api/designer/configs   — list by project
  DELETE /api/designer/config/{id}
  POST /api/designer/export   — generate code in a requested format
  POST /api/designer/cost     — calculate cost estimate
"""

from typing import Any, Literal
import uuid

from langchain_core.documents import Document
from pydantic import Field

from app.schemas.pipeline import (
    CostEstimateSchema,
    PipelineConfigurationSchema,
    RAGBaseModel,
)

# ─── Config Endpoints ─────────────────────────────────────────────────────────


class SaveConfigRequest(RAGBaseModel):
    """Body for POST /api/designer/config."""

    name: str = Field(min_length=1, max_length=255)
    project_id: uuid.UUID
    config: PipelineConfigurationSchema
    description: str | None = None


class SaveConfigResponse(RAGBaseModel):
    """Response from POST /api/designer/config and GET /api/designer/config/{id}."""

    id: str
    name: str
    project_id: str
    description: str | None = None
    config: PipelineConfigurationSchema
    created_at: str
    updated_at: str


class ConfigListItem(RAGBaseModel):
    """Lightweight summary used in list responses."""

    id: str
    name: str
    description: str | None = None
    cloud_provider: str
    source: str | None = None
    created_at: str
    updated_at: str


class ConfigListResponse(RAGBaseModel):
    """Response for GET /api/designer/configs?project_id=."""

    items: list[ConfigListItem]
    total: int
    page: int
    page_size: int


class UpdateDesignerConfigRequest(RAGBaseModel):
    """Body for PUT /api/designer/config/{id}. At least one field should be set."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    config: PipelineConfigurationSchema | None = None


# ─── Export Endpoint ──────────────────────────────────────────────────────────


ExportFormat = Literal["python", "yaml", "terraform", "docker-compose", "k8s"]

_FORMAT_CONTENT_TYPES: dict[str, str] = {
    "python": "text/x-python",
    "yaml": "application/yaml",
    "terraform": "application/hcl",
    "docker-compose": "application/yaml",
    "k8s": "application/yaml",
}

_FORMAT_EXTENSIONS: dict[str, str] = {
    "python": ".py",
    "yaml": ".yaml",
    "terraform": ".tf",
    "docker-compose": ".yml",
    "k8s": ".yaml",
}


class ExportRequest(RAGBaseModel):
    """Body for POST /api/designer/export."""

    config: PipelineConfigurationSchema
    format: ExportFormat


class ExportResponse(RAGBaseModel):
    """Response from POST /api/designer/export."""

    code: str
    filename: str
    format: ExportFormat
    content_type: str


# ─── Cost Endpoint ────────────────────────────────────────────────────────────


class CostRequest(RAGBaseModel):
    """Body for POST /api/designer/cost.

    Assumptions used when the caller does not supply them:
      - queries_per_month: 100 000
      - documents_count: 1 000 docs in the corpus
      - avg_document_tokens: 500 tokens per document
    """

    config: PipelineConfigurationSchema
    queries_per_month: int = Field(default=100_000, ge=1)
    documents_count: int = Field(default=1_000, ge=1)
    avg_document_tokens: int = Field(default=500, ge=1)


# CostResponse is just CostEstimateSchema — imported and re-exported for
# route type annotations without introducing a thin wrapper.
CostResponse = CostEstimateSchema


# ─── RAG preview (P4.5-5) ────────────────────────────────────────────────────


class ContextDocumentItem(RAGBaseModel):
    """One retrieved chunk supplied by the client for an in-process guarded RAG call."""

    page_content: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)

    def to_document(self) -> Document:
        return Document(page_content=self.page_content, metadata=dict(self.metadata))


class RagPreviewRequest(RAGBaseModel):
    """Body for POST /api/designer/rag-preview and POST /api/utilities/rag-preview."""

    query: str = Field(min_length=1)
    config: PipelineConfigurationSchema
    context_documents: list[ContextDocumentItem] = Field(default_factory=list)
    conversation: list[tuple[str, str]] | None = None


class GuardrailCheckSummary(RAGBaseModel):
    guardrail_name: str
    stage: str
    action: str
    message: str | None = None


class RagPreviewResponse(RAGBaseModel):
    allowed: bool
    blocked_stage: Literal["input", "retrieval", "output"] | None = None
    blocked_by: str | None = None
    query_used: str
    answer: str | None = None
    model: str | None = None
    provider: str | None = None
    input_checks: list[GuardrailCheckSummary]
    retrieval_checks: list[GuardrailCheckSummary]
    output_checks: list[GuardrailCheckSummary]
    had_warnings: bool = False
