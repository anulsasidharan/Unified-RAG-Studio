"""Score normalisation, weighted fusion, and Reciprocal Rank Fusion (RRF)."""

from __future__ import annotations

from collections import defaultdict
import math


def min_max_norm(values: list[float]) -> list[float]:
    if not values:
        return []
    lo, hi = min(values), max(values)
    if hi - lo < 1e-12:
        return [1.0 for _ in values]
    return [(v - lo) / (hi - lo) for v in values]


def weighted_dense_sparse(
    dense_scores: dict[int, float],
    sparse_scores: dict[int, float],
    *,
    alpha: float,
) -> dict[int, float]:
    """Combine normalised dense and sparse scores: alpha*d + (1-alpha)*s."""
    all_idx = set(dense_scores) | set(sparse_scores)
    d_list = [dense_scores.get(i, 0.0) for i in sorted(all_idx)]
    s_list = [sparse_scores.get(i, 0.0) for i in sorted(all_idx)]
    idx_order = sorted(all_idx)
    d_n = min_max_norm(d_list)
    s_n = min_max_norm(s_list)
    out: dict[int, float] = {}
    for j, i in enumerate(idx_order):
        out[i] = alpha * d_n[j] + (1.0 - alpha) * s_n[j]
    return out


def reciprocal_rank_fusion_keys(
    rankings: list[list[str]],
    *,
    k: int = 60,
) -> list[tuple[str, float]]:
    """RRF where each ranking is an ordered list of string keys (e.g. page_content)."""
    scores: dict[str, float] = defaultdict(float)
    for ranks in rankings:
        for rank, key in enumerate(ranks):
            scores[key] += 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)


def mmr_order(
    query_vec: list[float],
    doc_vecs: list[list[float]],
    *,
    k: int,
    lambda_mult: float,
) -> list[int]:
    """Maximal Marginal Relevance ordering (1-based greedy on cosine).

    ``doc_vecs`` must align with candidate documents; returns indices into
    ``doc_vecs`` of length at most ``k``.
    """
    if not doc_vecs or k <= 0:
        return []
    n = len(doc_vecs)
    k = min(k, n)

    def cos(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b, strict=True))
        na = math.sqrt(sum(x * x for x in a))
        nb = math.sqrt(sum(x * x for x in b))
        if na < 1e-12 or nb < 1e-12:
            return 0.0
        return dot / (na * nb)

    sim_to_q = [cos(query_vec, dv) for dv in doc_vecs]
    selected: list[int] = []
    remaining = set(range(n))
    first = max(remaining, key=lambda i: sim_to_q[i])
    selected.append(first)
    remaining.remove(first)
    while len(selected) < k and remaining:
        best_i = -1
        best_score = -1e9
        for i in remaining:
            max_sim_s = max(cos(doc_vecs[i], doc_vecs[j]) for j in selected)
            mmr = lambda_mult * sim_to_q[i] - (1.0 - lambda_mult) * max_sim_s
            if mmr > best_score:
                best_score = mmr
                best_i = i
        if best_i < 0:
            break
        selected.append(best_i)
        remaining.remove(best_i)
    return selected
