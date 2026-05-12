"""Unit tests for offline retrieval ranking helpers."""

from __future__ import annotations

import pytest

from app.core.evaluation.retrieval_metrics import mean_reciprocal_rank, ndcg_at_k, recall_at_k


@pytest.mark.unit
def test_recall_at_k_binary():
    rel = [0.0, 1.0, 0.0, 1.0]
    assert recall_at_k(rel, k=2) == pytest.approx(0.5)
    assert recall_at_k(rel, k=4) == pytest.approx(1.0)


@pytest.mark.unit
def test_mrr_first_rank():
    assert mean_reciprocal_rank([1.0, 0.0, 0.0]) == pytest.approx(1.0)
    assert mean_reciprocal_rank([0.0, 1.0, 0.0]) == pytest.approx(0.5)


@pytest.mark.unit
def test_ndcg_perfect_order():
    rel = [3.0, 2.0, 1.0]
    assert ndcg_at_k(rel, k=3) == pytest.approx(1.0)
