"""Pydantic schemas for Autopilot Mode API endpoints.

These schemas handle the full build lifecycle:
  POST /api/autopilot/upload         — multipart document upload → MinIO object ids
  POST /api/autopilot/build          — start a new build
  GET  /api/autopilot/build/{id}     — poll build status
  GET  /api/autopilot/build/{id}/stream — SSE stream (``dashboard_metrics`` — P7-5)
  POST /api/autopilot/build/{id}/cancel
  GET  /api/autopilot/build/{id}/result — orchestrator JSON artifact (opaque until normalised)
  GET  /api/autopilot/builds — paginated build history for the user (P7-7)
"""

from __future__ import annotations

import math
from typing import Any, Literal

from pydantic import Field, RootModel

from app.schemas.pipeline import CloudProvider, PipelineConfigurationSchema, RAGBaseModel

BuildStatusLiteral = Literal["pending", "running", "complete", "failed", "cancelled"]


# ─── Document upload (P7-1) ───────────────────────────────────────────────────


class UploadedDocumentItem(RAGBaseModel):
    """Stored corpus object; ``object_id`` is the MinIO key for ``StartBuildRequest``."""

    object_id: str
    original_filename: str
    size_bytes: int = Field(ge=0)
    content_type: str | None = None


class AutopilotUploadResponse(RAGBaseModel):
    """Response from ``POST /api/autopilot/upload``."""

    documents: list[UploadedDocumentItem]


# ─── Build Requirements ───────────────────────────────────────────────────────


class TargetMetricsSchema(RAGBaseModel):
    """RAGAS metric targets the Autopilot must reach before deploying."""

    faithfulness: float | None = Field(default=None, ge=0.0, le=1.0)
    answer_relevance: float | None = Field(default=None, ge=0.0, le=1.0)
    context_precision: float | None = Field(default=None, ge=0.0, le=1.0)
    context_recall: float | None = Field(default=None, ge=0.0, le=1.0)


class BuildRequirementsSchema(RAGBaseModel):
    """User-supplied constraints that guide the Autopilot optimisation loop."""

    target_metrics: TargetMetricsSchema = Field(default_factory=TargetMetricsSchema)
    cloud_provider: CloudProvider | None = None
    # Maximum acceptable cost per 1K queries in USD
    budget_constraint: float | None = Field(default=None, ge=0.0)
    # Maximum acceptable end-to-end latency in milliseconds
    latency_requirement: float | None = Field(default=None, ge=0.0)
    optimize_for: Literal["quality", "cost", "latency", "balanced"] = "balanced"
    max_iterations: int = Field(default=5, ge=1, le=10)


# ─── Start Build ─────────────────────────────────────────────────────────────


class StartBuildRequest(RAGBaseModel):
    """Body for POST /api/autopilot/build."""

    project_id: str
    requirements: BuildRequirementsSchema
    # Keys from POST /api/autopilot/upload (JSON ``objectId`` on each uploaded row).
    document_ids: list[str] = Field(min_length=1)
    # Optional starting config from the Designer "Optimize This" flow
    base_config: PipelineConfigurationSchema | None = None


class StartBuildResponse(RAGBaseModel):
    """Response from POST /api/autopilot/build."""

    build_id: str
    status: BuildStatusLiteral
    message: str


# ─── Stage & Message ─────────────────────────────────────────────────────────


class StageStatusSchema(RAGBaseModel):
    """Status of a single agent stage within a build."""

    status: Literal["pending", "running", "complete", "failed"]
    started_at: str | None = None
    completed_at: str | None = None
    message: str | None = None


class BuildMessageSchema(RAGBaseModel):
    """A single log entry from an agent during the build process."""

    timestamp: str
    text: str
    type: Literal["info", "success", "warning", "error"]
    agent: str | None = None


# ─── Agent Decisions ─────────────────────────────────────────────────────────


class EmbeddingBenchmarkResultSchema(RAGBaseModel):
    """Benchmark scores for a single candidate embedding model."""

    model: str
    score: float = Field(ge=0.0, le=1.0)
    cost_per_1m_tokens: float = Field(ge=0.0)
    latency_ms: float = Field(ge=0.0)


class ChunkingDecisionSchema(RAGBaseModel):
    strategy: str
    chunk_size: int
    reasoning: str
    alternatives_tested: list[str]


class EmbeddingDecisionSchema(RAGBaseModel):
    model: str
    reasoning: str
    benchmark_results: list[EmbeddingBenchmarkResultSchema]


class RetrievalDecisionSchema(RAGBaseModel):
    strategy: str
    top_k: int
    reasoning: str
    performance: dict[str, float]
    reranking_enabled: bool


class GenerationDecisionSchema(RAGBaseModel):
    model: str
    reasoning: str


class AgentDecisionSchema(RAGBaseModel):
    """Structured explanation of every agent's selection decision.

    Used by the DecisionExplainer component in Autopilot results and
    the Designer "Explain in Designer" flow.
    """

    chunking: ChunkingDecisionSchema | None = None
    embedding: EmbeddingDecisionSchema | None = None
    retrieval: RetrievalDecisionSchema | None = None
    generation: GenerationDecisionSchema | None = None


# ─── Build Result ────────────────────────────────────────────────────────────


class FinalMetricsSchema(RAGBaseModel):
    """RAGAS evaluation scores achieved by the final pipeline configuration."""

    faithfulness: float = Field(ge=0.0, le=1.0)
    answer_relevance: float = Field(ge=0.0, le=1.0)
    context_precision: float = Field(ge=0.0, le=1.0)
    context_recall: float = Field(ge=0.0, le=1.0)
    avg_latency_ms: float | None = Field(default=None, ge=0.0)
    cost_per_query: float | None = Field(default=None, ge=0.0)


class DeploymentArtefactsSchema(RAGBaseModel):
    """Generated IaC files from the deployment agent (stub/preview only)."""

    docker_compose: str | None = None
    kubernetes_manifest: str | None = None
    terraform_stub: str | None = None


class DeploymentInfoSchema(RAGBaseModel):
    """Deployment result from the Autopilot build.

    status='preview' means IaC config was generated but no cloud resources
    were provisioned. status='deployed' is reserved for future real deployments.
    """

    provider: str
    status: Literal["deploying", "deployed", "failed", "preview"]
    artefacts: DeploymentArtefactsSchema | None = None
    synthesized_from: str | None = None
    operator_notes: str | None = None
    warnings: list[str] = Field(default_factory=list)
    endpoint: str | None = None
    deployed_at: str | None = None
    health_check_url: str | None = None
    docker_image_tag: str | None = None


class BuildResultSchema(RAGBaseModel):
    """Full result returned once a build reaches status='complete'."""

    config: PipelineConfigurationSchema
    metrics: FinalMetricsSchema
    decisions: AgentDecisionSchema
    deployment: DeploymentInfoSchema | None = None
    total_iterations: int = Field(ge=1)


# ─── Dashboard metrics (P7-5) ─────────────────────────────────────────────────


class DashboardQualitySnapshotSchema(RAGBaseModel):
    """RAGAS-style proxies from ``stage_outputs['evaluation']``."""

    faithfulness: float | None = None
    answer_relevance: float | None = None
    context_precision: float | None = None
    context_recall: float | None = None
    avg_latency_ms: float | None = None
    meets_targets: bool | None = None


class DashboardEmbeddingBenchRowSchema(RAGBaseModel):
    label: str
    latency_ms: float | None = None
    composite_score: float | None = None
    texts_per_second: float | None = None


class DashboardRetrievalSummarySchema(RAGBaseModel):
    strategy: str | None = None
    top_k: int | None = None
    performance: dict[str, float] | None = None


class AutopilotDashboardMetricsSchema(RAGBaseModel):
    """Structured slice of orchestrator ``stage_outputs`` for the Autopilot metrics UI."""

    quality: DashboardQualitySnapshotSchema | None = None
    embedding_benchmarks: list[DashboardEmbeddingBenchRowSchema] = Field(default_factory=list)
    selected_embedding_label: str | None = None
    retrieval: DashboardRetrievalSummarySchema | None = None


# ─── Build Status ─────────────────────────────────────────────────────────────


class BuildArtifactResultResponse(RootModel[dict[str, Any]]):
    """Opaque JSON from ``AutopilotBuild.result`` (orchestrator output; shape evolves)."""


class CancelBuildResponse(RAGBaseModel):
    """Response from POST /api/autopilot/build/{id}/cancel."""

    build_id: str
    status: Literal["cancelled"] = "cancelled"
    message: str = "Build cancellation requested."


class AutopilotBuildListItemSchema(RAGBaseModel):
    """One row in GET /api/autopilot/builds — server-backed build history (P7-7)."""

    build_id: str
    project_id: str
    project_name: str
    status: BuildStatusLiteral
    progress: int = Field(ge=0, le=100)
    current_stage: str
    iteration: int = Field(ge=0)
    created_at: str
    updated_at: str
    completed_at: str | None = None
    error: str | None = None


class AutopilotBuildListResponse(RAGBaseModel):
    """Paginated list of Autopilot builds for the authenticated user."""

    items: list[AutopilotBuildListItemSchema]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    pages: int = Field(ge=0)

    @classmethod
    def from_rows(
        cls,
        *,
        items: list[AutopilotBuildListItemSchema],
        total: int,
        page: int,
        page_size: int,
    ) -> AutopilotBuildListResponse:
        if total == 0:
            pages = 0
        elif page_size <= 0:
            pages = 1
        else:
            pages = max(1, math.ceil(total / page_size))
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )


class BuildStatusResponse(RAGBaseModel):
    """Response for GET /api/autopilot/build/{id}.

    Also the shape of SSE payloads from the /stream endpoint.
    """

    build_id: str
    status: BuildStatusLiteral
    # Overall progress 0–100 (derived from completed-stage count)
    progress: int = Field(ge=0, le=100)
    current_stage: str
    iteration: int = Field(ge=0)
    # Key is the AutopilotStageId string (e.g. "analyze", "chunking", ...)
    stages: dict[str, StageStatusSchema]
    messages: list[BuildMessageSchema]
    result: BuildResultSchema | None = None
    dashboard_metrics: AutopilotDashboardMetricsSchema | None = None
    error: str | None = None
    created_at: str
    updated_at: str
    completed_at: str | None = None
