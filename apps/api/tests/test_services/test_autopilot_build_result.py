"""Unit tests for ``compose_build_result_payload`` (P7-6)."""

from __future__ import annotations

import pytest

from app.schemas.autopilot import BuildResultSchema
from app.services.autopilot_build_result import compose_build_result_payload


def _happy_stage_outputs() -> dict:
    return {
        "chunking": {
            "status": "complete",
            "selected": {
                "strategy": "recursive-character",
                "chunk_size": 768,
                "chunk_overlap": 64,
                "rationale": "Winner rationale.",
            },
            "alternatives_tested": ["semantic", "fixed-size"],
        },
        "embedding": {
            "status": "complete",
            "selected": {
                "provider": "openai",
                "model": "text-embedding-3-small",
                "dimensions": 1536,
                "rationale": "Embedding rationale.",
                "composite_score": 0.82,
                "avg_latency_ms": 12.5,
            },
            "candidates_tried": [
                {
                    "provider": "openai",
                    "model": "text-embedding-3-small",
                    "composite_score": 0.82,
                    "avg_latency_ms": 12.5,
                    "cost_per_1m_tokens": 0.02,
                },
                {
                    "provider": "openai",
                    "model": "text-embedding-3-large",
                    "composite_score": 0.71,
                    "avg_latency_ms": 40.0,
                },
            ],
        },
        "retrieval": {
            "status": "complete",
            "selected": {
                "strategy": "hybrid",
                "top_k": 8,
                "hybrid_alpha": 0.6,
                "reranking_enabled": False,
                "mrr": 0.41,
                "composite_score": 0.77,
                "rationale": "Retrieval rationale.",
            },
        },
        "evaluation": {
            "status": "complete",
            "metrics": {
                "faithfulness": 0.88,
                "answer_relevance": 0.84,
                "context_precision": 0.79,
                "context_recall": 0.73,
                "avg_latency_ms": 120.0,
            },
        },
        "deployment": {"status": "complete", "synthesized_from": "stage_outputs_fallback"},
    }


@pytest.mark.unit
def test_compose_build_result_payload_round_trip():
    out = compose_build_result_payload(
        build_id="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        stage_outputs=_happy_stage_outputs(),
        base_pipeline_config=None,
        requirements={"cloud_provider": "aws"},
        total_iterations=2,
    )
    assert out is not None
    parsed = BuildResultSchema.model_validate(out)
    assert parsed.total_iterations == 2
    assert parsed.decisions.chunking is not None
    assert parsed.decisions.chunking.chunk_size == 768
    assert parsed.decisions.embedding is not None
    assert parsed.decisions.embedding.model == "text-embedding-3-small"
    assert len(parsed.decisions.embedding.benchmark_results) >= 1
    assert parsed.decisions.retrieval is not None
    assert parsed.decisions.retrieval.strategy == "hybrid"
    assert parsed.metrics.faithfulness == pytest.approx(0.88)
    assert parsed.deployment is not None
    assert parsed.deployment.status == "deployed"


@pytest.mark.unit
def test_compose_omits_chunking_decision_when_chunking_failed():
    so = _happy_stage_outputs()
    so["chunking"] = {"status": "failed", "reason": "all_chunking_benchmarks_failed"}
    out = compose_build_result_payload(
        build_id="bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
        stage_outputs=so,
        base_pipeline_config=None,
        requirements={},
        total_iterations=1,
    )
    assert out is not None
    parsed = BuildResultSchema.model_validate(out)
    assert parsed.decisions.chunking is None
    assert str(parsed.config.stages.chunking.strategy) == "recursive-character"
