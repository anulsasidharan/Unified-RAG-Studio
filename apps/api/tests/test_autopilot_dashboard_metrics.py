"""P7-5 — dashboard metrics extraction from orchestrator ``result`` JSON."""

from app.schemas.autopilot import AutopilotDashboardMetricsSchema
from app.services.autopilot_dashboard_metrics import extract_dashboard_metrics


def test_extract_dashboard_metrics_full_shape():
    raw = {
        "autopilot_graph": True,
        "stage_outputs": {
            "evaluation": {
                "status": "complete",
                "metrics": {
                    "faithfulness": 0.91,
                    "answer_relevance": 0.88,
                    "context_precision": 0.77,
                    "context_recall": 0.82,
                    "avg_latency_ms": 120.5,
                },
                "meets_targets": True,
            },
            "embedding": {
                "status": "complete",
                "selected": {"provider": "openai", "model": "text-embedding-3-small"},
                "candidates_tried": [
                    {
                        "provider": "openai",
                        "model": "text-embedding-3-small",
                        "avg_latency_ms": 45.0,
                        "composite_score": 0.812,
                        "texts_per_second": 22.0,
                    },
                    {
                        "provider": "huggingface",
                        "model": "all-minilm-l6-v2",
                        "avg_latency_ms": 30.0,
                        "composite_score": 0.75,
                        "texts_per_second": 40.0,
                    },
                ],
            },
            "retrieval": {
                "status": "complete",
                "selected": {"strategy": "similarity", "top_k": 5},
                "performance": {"ndcg": 0.66, "mrr": 0.71},
            },
        },
    }
    extracted = extract_dashboard_metrics(raw)
    assert extracted is not None
    model = AutopilotDashboardMetricsSchema.model_validate(extracted)
    assert model.quality is not None
    assert model.quality.faithfulness == 0.91
    assert model.quality.meets_targets is True
    assert len(model.embedding_benchmarks) == 2
    assert model.selected_embedding_label == "openai/text-embedding-3-small"
    assert model.retrieval is not None
    assert model.retrieval.strategy == "similarity"
    assert model.retrieval.top_k == 5
    assert model.retrieval.performance == {"ndcg": 0.66, "mrr": 0.71}


def test_extract_returns_none_without_stage_outputs():
    assert extract_dashboard_metrics(None) is None
    assert extract_dashboard_metrics({}) is None
    assert extract_dashboard_metrics({"stage_outputs": "bad"}) is None
