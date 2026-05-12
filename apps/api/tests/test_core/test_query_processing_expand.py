"""Tests for deterministic query expansion."""

from __future__ import annotations

import pytest

from app.core.query_processing import expand_retrieval_queries


@pytest.mark.unit
def test_expand_disabled_returns_single():
    assert expand_retrieval_queries("hello", None) == ["hello"]
    assert expand_retrieval_queries("hello", {"enabled": False, "hyde": True}) == ["hello"]


@pytest.mark.unit
def test_expand_hyde_and_rewrite():
    qp = {
        "enabled": True,
        "queryRewrite": True,
        "hyde": True,
        "multiQueryExpansion": False,
    }
    out = expand_retrieval_queries("What is RAG?", qp)
    assert out[0] == "What is RAG?"
    assert any("rephrased" in x for x in out)
    assert any("Hypothetical passage" in x for x in out)


@pytest.mark.unit
def test_build_eval_queries_applies_processing():
    from app.core.agents.retrieval_optimizer import _build_eval_queries

    pipeline = {
        "stages": {
            "queryProcessing": {
                "enabled": True,
                "hyde": True,
                "queryRewrite": False,
            }
        }
    }
    q = _build_eval_queries(
        {"corpus_summary": {}},
        {"retrieval_eval_queries": ["alpha", "beta"]},
        pipeline,
    )
    assert len(q) >= 2
    assert "Hypothetical passage" in " ".join(q)
