"""Pydantic schemas for Evaluation API endpoints.

These schemas handle:
  POST /api/evaluation/run          — trigger a RAGAS evaluation run
  GET  /api/evaluation/run/{id}     — poll run status + metrics
  GET  /api/evaluation/runs         — list runs for a config
  POST /api/evaluation/compare      — A/B compare two config IDs
"""

from typing import Literal

from pydantic import Field

from app.schemas.pipeline import EvaluationMetricName, RAGBaseModel

# ─── Evaluation Run Request ───────────────────────────────────────────────────


class TestSetEntry(RAGBaseModel):
    """A single question-answer pair for evaluation."""

    question: str
    ground_truth: str
    # Optional context to skip retrieval and evaluate generation only
    context: list[str] | None = None


class EvaluationRunRequest(RAGBaseModel):
    """Body for POST /api/evaluation/run."""

    config_id: str
    # If not supplied, the EvaluationAgent generates a synthetic test set
    test_set: list[TestSetEntry] | None = None
    test_set_size: int = Field(default=50, ge=10, le=500)
    metrics: list[EvaluationMetricName] | None = None


# ─── Evaluation Metrics ───────────────────────────────────────────────────────


class EvaluationMetrics(RAGBaseModel):
    """RAGAS metric scores + latency/cost for a completed evaluation run."""

    faithfulness: float = Field(ge=0.0, le=1.0)
    answer_relevance: float = Field(ge=0.0, le=1.0)
    context_precision: float = Field(ge=0.0, le=1.0)
    context_recall: float = Field(ge=0.0, le=1.0)
    avg_latency_ms: float | None = Field(default=None, ge=0.0)
    cost_per_query: float | None = Field(default=None, ge=0.0)


# ─── Failure Analysis ─────────────────────────────────────────────────────────


FailureCategoryName = Literal[
    "hallucination",
    "retrieval_quality",
    "context_gap",
    "format_error",
]


class FailureCategory(RAGBaseModel):
    """A cluster of failure cases sharing the same root cause."""

    category: FailureCategoryName
    count: int = Field(ge=0)
    # Representative failing questions (for display in UI)
    examples: list[str]
    recommendation: str


class FailureAnalysisResult(RAGBaseModel):
    """Structured output of the FailureAnalyzer for a completed evaluation."""

    total_failures: int = Field(ge=0)
    failure_rate: float = Field(ge=0.0, le=1.0)
    categories: list[FailureCategory]
    summary: str


# ─── Evaluation Run Response ──────────────────────────────────────────────────


class EvaluationRunResponse(RAGBaseModel):
    """Response for GET /api/evaluation/run/{id}."""

    run_id: str
    config_id: str
    status: Literal["pending", "running", "complete", "failed"]
    metrics: EvaluationMetrics | None = None
    failure_analysis: FailureAnalysisResult | None = None
    test_set_size: int
    created_at: str
    completed_at: str | None = None
    error: str | None = None


class EvaluationRunListResponse(RAGBaseModel):
    """Response for GET /api/evaluation/runs?config_id=."""

    items: list[EvaluationRunResponse]
    total: int


# ─── A/B Comparison ──────────────────────────────────────────────────────────


class CompareConfigsRequest(RAGBaseModel):
    """Body for POST /api/evaluation/compare."""

    config_id_a: str
    config_id_b: str
    # Reuse existing run IDs to skip re-evaluation if available
    run_id_a: str | None = None
    run_id_b: str | None = None
    test_set_size: int = Field(default=50, ge=10, le=500)


class MetricDelta(RAGBaseModel):
    """Difference between two evaluation results for a single metric."""

    metric: str
    value_a: float
    value_b: float
    delta: float
    winner: Literal["a", "b", "tie"]


class CompareConfigsResponse(RAGBaseModel):
    """Side-by-side metric comparison for A/B evaluation."""

    config_id_a: str
    config_id_b: str
    metrics_a: EvaluationMetrics
    metrics_b: EvaluationMetrics
    deltas: list[MetricDelta]
    overall_winner: Literal["a", "b", "tie"]
    summary: str
