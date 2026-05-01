"""Runtime types for P2-7 Evaluation Engine."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.schemas.evaluation import EvaluationMetrics, FailureAnalysisResult


@dataclass
class EvaluationExample:
    """One row for RAGAS: question, model answer, retrieved contexts, reference answer."""

    question: str
    answer: str
    contexts: list[str]
    ground_truth: str


@dataclass
class EvaluationEngineResult:
    """Aggregated metrics plus optional per-example scores and failure clustering."""

    metrics: EvaluationMetrics
    failure_analysis: FailureAnalysisResult | None = None
    per_row_scores: list[dict[str, object]] = field(default_factory=list)
