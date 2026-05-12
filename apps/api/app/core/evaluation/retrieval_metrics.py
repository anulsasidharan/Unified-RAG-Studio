"""Offline retrieval ranking metrics (Recall@k, MRR, NDCG@k).

Used for evaluation harnesses and export documentation — inputs are ordered
relevance labels or binary relevance per retrieved document position.
"""

from __future__ import annotations


def recall_at_k(relevance: list[float], k: int, *, threshold: float = 1e-6) -> float:
    """Fraction of known-relevant items (``relevance[i] > threshold``) found in the top-``k`` slots.

    ``relevance`` is one score per retrieved rank position; total relevant count
    is derived from the full list length (binary relevance above ``threshold``).
    """
    if k <= 0 or not relevance:
        return 0.0
    total_rel = sum(1.0 for r in relevance if float(r) > threshold)
    if total_rel <= 0.0:
        return 0.0
    found = sum(1.0 for r in relevance[:k] if float(r) > threshold)
    return min(1.0, found / total_rel)


def mean_reciprocal_rank(relevance: list[float], *, threshold: float = 1e-6) -> float:
    """MRR: reciprocal rank of the first relevant document (1-based), or 0 if none."""
    for i, r in enumerate(relevance):
        if float(r) > threshold:
            return 1.0 / float(i + 1)
    return 0.0


def dcg_at_k(gains: list[float], k: int) -> float:
    """Discounted cumulative gain at ``k`` (0-based positions), linear gain."""
    import math

    acc = 0.0
    for i in range(min(k, len(gains))):
        acc += max(0.0, float(gains[i])) / math.log2(float(i + 2))
    return acc


def ndcg_at_k(relevance: list[float], k: int) -> float:
    """NDCG@k with non-negative relevance scores as gains."""
    if k <= 0 or not relevance:
        return 0.0
    gains = [max(0.0, float(x)) for x in relevance[:k]]
    ideal = sorted(gains, reverse=True)
    num = dcg_at_k(gains, k)
    den = dcg_at_k(ideal, k)
    return 0.0 if den <= 0.0 else min(1.0, num / den)
