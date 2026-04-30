"""Pydantic schemas for Autopilot Mode API endpoints.

These schemas handle the full build lifecycle:
  POST /api/autopilot/build          — start a new build
  GET  /api/autopilot/build/{id}     — poll build status
  GET  /api/autopilot/build/{id}/stream — SSE progress events
  POST /api/autopilot/build/{id}/cancel
  GET  /api/autopilot/build/{id}/result
"""

from typing import Literal

from pydantic import Field

from app.schemas.pipeline import CloudProvider, PipelineConfigurationSchema, RAGBaseModel


# ─── Build Requirements ───────────────────────────────────────────────────────


class TargetMetricsSchema(RAGBaseModel):
    """RAGAS metric targets the Autopilot must reach before deploying."""

    faithfulness: float | None = Field(default=None, ge=0.0, le=1.0)
    answer_relevance: float | None = Field(default=None, ge=0.0, le=1.0)
    context_precision: float | None = Field(default=None, ge=0.0, le=1.0)
    context_recall: float | None = Field(default=None, ge=0.0, le=1.0)


class BuildRequirementsSchema(RAGBaseModel):
    """User-supplied constraints that guide the Autopilot optimisation loop."""

    target_metrics: TargetMetricsSchema = Field(
        default_factory=TargetMetricsSchema
    )
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
    # MinIO object IDs returned by POST /api/autopilot/upload
    document_ids: list[str] = Field(min_length=1)
    # Optional starting config from the Designer "Optimize This" flow
    base_config: PipelineConfigurationSchema | None = None


class StartBuildResponse(RAGBaseModel):
    """Response from POST /api/autopilot/build."""

    build_id: str
    status: Literal["pending", "running", "complete", "failed"]
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


class DeploymentInfoSchema(RAGBaseModel):
    """Information about the deployed RAG endpoint."""

    provider: str
    endpoint: str
    status: Literal["deploying", "deployed", "failed"]
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


# ─── Build Status ─────────────────────────────────────────────────────────────


class BuildStatusResponse(RAGBaseModel):
    """Response for GET /api/autopilot/build/{id}.

    Also the shape of SSE payloads from the /stream endpoint.
    """

    build_id: str
    status: Literal["pending", "running", "complete", "failed"]
    # Overall progress 0–100 (derived from completed-stage count)
    progress: int = Field(ge=0, le=100)
    current_stage: str
    iteration: int = Field(ge=0)
    # Key is the AutopilotStageId string (e.g. "analyze", "chunking", ...)
    stages: dict[str, StageStatusSchema]
    messages: list[BuildMessageSchema]
    result: BuildResultSchema | None = None
    error: str | None = None
    created_at: str
    updated_at: str
    completed_at: str | None = None
