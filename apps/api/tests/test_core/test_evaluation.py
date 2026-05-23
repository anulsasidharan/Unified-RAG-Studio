"""Unit tests for P2-7 Evaluation Engine (mocked RAGAS, pure logic tests)."""

from __future__ import annotations

from unittest.mock import patch

from langchain_core.documents import Document
import pandas as pd
import pytest

from app.core.evaluation import (
    EvaluationEngine,
    EvaluationExample,
    compare_metrics,
    metric_names_from_pipeline,
)
from app.core.evaluation.failure_analysis import analyze_failures
from app.core.evaluation.ragas_bridge import (
    build_dataset,
    ragas_dict_to_evaluation_metrics,
    resolve_ragas_metric_names,
)
from app.core.evaluation.synthetic import examples_from_documents
from app.schemas.evaluation import EvaluationMetrics
from app.schemas.pipeline import EvaluationConfigSchema


class _MockRagasResult(dict):
    """Minimal stand-in for ``ragas.Result`` (aggregate means + ``to_pandas``)."""

    def to_pandas(self) -> pd.DataFrame:
        return pd.DataFrame(
            [
                {
                    "question": "q1",
                    "answer": "a1",
                    "faithfulness": 0.25,
                    "answer_relevancy": 0.8,
                    "context_precision": 0.3,
                    "context_recall": 0.5,
                }
            ]
        )


@pytest.mark.unit
def test_resolve_ragas_defaults_and_latency_skip():
    assert resolve_ragas_metric_names(None) == [
        "faithfulness",
        "answer_relevance",
        "context_precision",
        "context_recall",
    ]
    assert resolve_ragas_metric_names(["latency"]) == [
        "faithfulness",
        "answer_relevance",
        "context_precision",
        "context_recall",
    ]


@pytest.mark.unit
def test_resolve_ragas_unknown_raises():
    with pytest.raises(ValueError, match="Unknown"):
        resolve_ragas_metric_names(["not_a_metric"])


@pytest.mark.unit
def test_build_dataset_empty_context_placeholder():
    pytest.importorskip("datasets")
    ds = build_dataset(
        questions=["q"],
        answers=["a"],
        contexts=[[]],
        ground_truths=["gt"],
    )
    row = ds[0]
    assert "(no context retrieved)" in row["contexts"][0]


@pytest.mark.unit
def test_ragas_dict_to_metrics():
    m = ragas_dict_to_evaluation_metrics(
        {
            "faithfulness": 0.9,
            "answer_relevancy": 0.8,
            "context_precision": 0.7,
            "context_recall": 0.6,
        },
        avg_latency_ms=100.0,
    )
    assert m.faithfulness == 0.9
    assert m.answer_relevance == 0.8
    assert m.avg_latency_ms == 100.0


@pytest.mark.unit
def test_compare_metrics_winner():
    a = EvaluationMetrics(
        faithfulness=0.9,
        answer_relevance=0.8,
        context_precision=0.7,
        context_recall=0.6,
        avg_latency_ms=100.0,
    )
    b = EvaluationMetrics(
        faithfulness=0.5,
        answer_relevance=0.9,
        context_precision=0.8,
        context_recall=0.7,
        avg_latency_ms=200.0,
    )
    deltas, overall = compare_metrics(a, b)
    assert len(deltas) >= 4
    assert overall in ("a", "b", "tie")


@pytest.mark.unit
def test_failure_analysis_categories():
    rows = [
        {
            "question": "q1",
            "answer": "",
            "faithfulness": 0.9,
            "answer_relevancy": 0.9,
            "context_precision": 0.9,
            "context_recall": 0.9,
        },
        {
            "question": "q2",
            "answer": "long answer",
            "faithfulness": 0.1,
            "answer_relevancy": 0.9,
            "context_precision": 0.9,
            "context_recall": 0.9,
        },
    ]
    out = analyze_failures(rows)
    assert out.total_failures >= 1


@pytest.mark.unit
def test_metric_names_from_pipeline_disabled():
    assert metric_names_from_pipeline(None) is None
    cfg = EvaluationConfigSchema(enabled=False)
    assert metric_names_from_pipeline(cfg) is None


@pytest.mark.unit
def test_examples_from_documents():
    docs = [Document(page_content="x" * 50)]
    ex = examples_from_documents(docs, max_items=5)
    assert len(ex) == 1
    assert ex[0].ground_truth.startswith("xxx")


@pytest.mark.unit
def test_evaluate_empty_batch():
    eng = EvaluationEngine()
    out = eng.evaluate([])
    assert out.metrics.faithfulness == 0.0
    assert out.per_row_scores == []


@pytest.mark.unit
def test_evaluate_mocked_ragas():
    pytest.importorskip("ragas")
    mock = _MockRagasResult(
        faithfulness=0.85,
        answer_relevancy=0.75,
        context_precision=0.65,
        context_recall=0.55,
    )
    ex = [
        EvaluationExample(
            question="q",
            answer="a",
            contexts=["ctx"],
            ground_truth="gt",
        )
    ]
    with patch("ragas.evaluate", return_value=mock):
        eng = EvaluationEngine(llm=object(), embeddings=object())
        out = eng.evaluate(ex, with_failure_analysis=True)
    assert out.metrics.faithfulness == 0.85
    assert out.failure_analysis is not None
