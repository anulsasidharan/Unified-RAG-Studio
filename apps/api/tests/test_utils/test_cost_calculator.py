"""Unit tests for ``app.utils.cost_calculator`` (P4-3) with deterministic pricing fixtures."""

from __future__ import annotations

import pytest

from app.schemas.designer import CostRequest
from app.schemas.pipeline import PipelineConfigurationSchema, RerankingConfigSchema
from app.utils.cost_calculator import CostEstimator, calculate_cost


def _minimal_cfg() -> PipelineConfigurationSchema:
    raw = {
        "id": "c1",
        "name": "T",
        "cloud_provider": "aws",
        "stages": {
            "chunking": {
                "strategy": "recursive-character",
                "chunk_size": 512,
                "chunk_overlap": 50,
            },
            "embedding": {
                "model": "text-embedding-3-small",
                "provider": "openai",
                "dimensions": 1536,
            },
            "vector_store": {
                "provider": "qdrant",
                "index_name": "idx",
            },
            "retrieval": {
                "strategy": "similarity",
                "top_k": 5,
            },
            "generation": {
                "model": "gpt-4o-mini",
                "provider": "openai",
                "temperature": 0.7,
                "max_tokens": 1024,
            },
        },
        "metadata": {
            "created_at": "2026-01-01T00:00:00+00:00",
            "version": "1.0.0",
            "source": "designer",
        },
    }
    return PipelineConfigurationSchema.model_validate(raw)


@pytest.mark.unit
def test_calculate_cost_known_fixture():
    """Fixed mini pricing dict → predictable per-query and monthly totals."""
    pricing = {
        "assumptions": {
            "avgInputTokensPerQuery": 500.0,
            "avgOutputTokensPerQuery": 300.0,
        },
        "embedding": {
            "models": {
                "text-embedding-3-small": {"costPer1MTokens": 1.0, "provider": "openai"},
            }
        },
        "generation": {
            "models": {
                "gpt-4o-mini": {
                    "inputCostPer1MTokens": 1.0,
                    "outputCostPer1MTokens": 2.0,
                    "provider": "openai",
                },
            }
        },
        "reranking": {"models": {}},
        "vectorStorage": {
            "providers": {
                "qdrant": {
                    "selfHosted": {"costPerGBPerMonth": 0.0},
                },
            }
        },
    }
    body = CostRequest(
        config=_minimal_cfg(),
        queries_per_month=1_000,
        documents_count=100,
        avg_document_tokens=500,
    )
    out = calculate_cost(body, pricing)
    # embedding_per_q = (5*512/1e6)*1 = 0.00256
    # context = 5*512+500 = 3060; gen = 3060/1e6*1 + 300/1e6*2 = 0.00306 + 0.0006 = 0.00366
    assert out.per_query == pytest.approx(0.00256 + 0.00366, rel=1e-5)
    assert out.per_month == pytest.approx(out.per_query * 1000, rel=1e-5)
    assert out.currency == "USD"
    assert len(out.breakdown) == 5
    labels = {b.component for b in out.breakdown}
    assert labels == {"embedding", "vector_storage", "retrieval_ops", "reranking", "generation"}


@pytest.mark.unit
def test_rerank_cohere_pricing():
    pricing = {
        "assumptions": {
            "avgInputTokensPerQuery": 100.0,
            "avgOutputTokensPerQuery": 50.0,
        },
        "embedding": {
            "models": {
                "text-embedding-3-small": {"costPer1MTokens": 0.0, "provider": "openai"},
            }
        },
        "generation": {
            "models": {
                "gpt-4o-mini": {
                    "inputCostPer1MTokens": 0.0,
                    "outputCostPer1MTokens": 0.0,
                    "provider": "openai",
                },
            }
        },
        "reranking": {
            "models": {
                "cohere-rerank-v3": {"costPer1KQueries": 10.0, "provider": "cohere"},
            }
        },
        "vectorStorage": {"providers": {}},
    }
    cfg = _minimal_cfg()
    cfg.stages.reranking = RerankingConfigSchema(
        enabled=True,
        model="cohere-rerank-v3",
        top_n=5,
        provider="cohere",
    )
    body = CostRequest(config=cfg, queries_per_month=1000, documents_count=1, avg_document_tokens=100)
    out = CostEstimator(pricing).estimate(body)
    assert out.reranking == pytest.approx(10.0, rel=1e-6)  # 1000 * (10/1000)
