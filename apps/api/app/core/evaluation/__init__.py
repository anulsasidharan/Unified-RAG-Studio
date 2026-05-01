"""Evaluation Engine — P2-7.

RAGAS metrics (faithfulness, answer relevance, context precision/recall), average
latency per query, heuristic failure clustering, A/B metric comparison, and
synthetic test-row helpers.

Typical usage::

    from app.core.evaluation import (
        EvaluationEngine,
        EvaluationExample,
        compare_metrics,
        metric_names_from_pipeline,
    )
    from app.schemas.pipeline import EvaluationConfigSchema

    engine = EvaluationEngine()
    rows = [
        EvaluationExample(
            question="What is RAG?",
            answer="Retrieval-augmented generation ...",
            contexts=["RAG combines retrieval with LLMs."],
            ground_truth="RAG is ...",
        ),
    ]
    result = engine.evaluate(
        rows,
        metric_names=["faithfulness", "answer_relevance"],
    )
    deltas, winner = compare_metrics(result.metrics, other.metrics)
"""

from .compare import compare_metrics
from .pipeline_bridge import metric_names_from_pipeline
from .service import EvaluationEngine
from .strategies import EvaluationEngineResult, EvaluationExample
from .synthetic import examples_from_documents, examples_from_text_snippets

__all__ = [
    "EvaluationEngine",
    "EvaluationEngineResult",
    "EvaluationExample",
    "compare_metrics",
    "examples_from_documents",
    "examples_from_text_snippets",
    "metric_names_from_pipeline",
]
