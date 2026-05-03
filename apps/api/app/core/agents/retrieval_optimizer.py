"""Retrieval Optimizer — benchmarks retrieval settings on chunk text (P6-5).

Uses the same **chunk strings** as the embedding tester (synthetic corpus +
winning ``ChunkingConfig``) and scores candidates **without** a live vector index:
deterministic **hashing-vector** dense similarity plus **BM25**, with **hybrid**
fusion (RRF or weighted), **MMR** re-ordering, **multi-query** RRF on two query
variants, **ensemble** RRF (dense vs MMR), and a lightweight **rerank** proxy
(bigram overlap). The oracle for ranking quality is the **argmax BM25** chunk per
query; we maximise **mean reciprocal rank (MRR)** of that chunk, blended with a
rough **latency proxy** keyed off ``requirements["optimize_for"]``.
"""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any

import structlog

from app.core.agents.chunking_optimizer import _synthetic_corpus_from_summary
from app.core.chunking import ChunkingConfig, ChunkingService
from app.core.retrieval.bm25 import BM25Index, tokenize
from app.core.retrieval.fusion import mmr_order, reciprocal_rank_fusion_keys, weighted_dense_sparse

logger = structlog.get_logger(__name__)

_HASH_DIM = 96


def _stable_u64(label: str) -> int:
    """Process-stable digest (unlike ``hash(str)`` under randomized hashing)."""

    return int.from_bytes(hashlib.blake2b(label.encode("utf-8"), digest_size=8).digest(), "big")


def _hashing_vector(text: str, *, dim: int = _HASH_DIM) -> list[float]:
    """Deterministic signed feature counts from tokens (embedding-free dense proxy)."""

    vec = [0.0] * dim
    for tok in tokenize(text):
        h = _stable_u64(f"{tok}:{dim}") % dim
        vec[h] += 1.0 if (_stable_u64(tok) & 1) == 0 else -1.0
    return vec


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na < 1e-12 or nb < 1e-12:
        return 0.0
    return dot / (na * nb)


def _dense_scores(query: str, chunks: list[str]) -> list[float]:
    qv = _hashing_vector(query)
    return [_cosine(qv, _hashing_vector(c)) for c in chunks]


def _bigram_overlap(query: str, text: str) -> float:
    def bigrams(s: str) -> set[str]:
        s = s.lower()
        return {s[i : i + 2] for i in range(max(0, len(s) - 1))}

    qb = bigrams(query)
    tb = bigrams(text)
    if not qb or not tb:
        return 0.0
    return float(len(qb & tb))


def _chunk_texts(
    *,
    analyze_payload: dict[str, Any],
    chunking_payload: dict[str, Any],
    requirements: dict[str, Any],
) -> list[str]:
    """Align with embedding tester: optional sample texts, else synthetic corpus + chunker."""

    max_texts = int(requirements.get("retrieval_max_texts") or 48)
    max_texts = max(4, min(max_texts, 128))

    sample = requirements.get("retrieval_sample_texts")
    if isinstance(sample, list) and sample:
        texts = [str(x) for x in sample if isinstance(x, str) and str(x).strip()]
        if texts:
            return texts[:max_texts]

    summary = analyze_payload.get("corpus_summary") or {}
    if not isinstance(summary, dict):
        summary = {}
    docs = _synthetic_corpus_from_summary(summary, requirements=requirements)

    sel = chunking_payload.get("selected") or {}
    cfg = ChunkingConfig(
        strategy=str(sel.get("strategy") or "recursive-character"),
        chunk_size=int(sel.get("chunk_size") or 512),
        chunk_overlap=int(sel.get("chunk_overlap") or 50),
    )
    chunks = ChunkingService().chunk(docs, cfg)
    texts = [c.page_content for c in chunks if c.page_content.strip()]
    if not texts:
        texts = [
            "Retrieval benchmark chunk one about methodology and results.",
            "Retrieval benchmark chunk two with implementation notes and tables.",
            "Retrieval benchmark chunk three closing conclusions and next steps.",
        ]
    return texts[:max_texts]


def _build_eval_queries(
    analyze_payload: dict[str, Any],
    requirements: dict[str, Any],
) -> list[str]:
    raw = requirements.get("retrieval_eval_queries")
    if isinstance(raw, list) and raw:
        out = [str(q).strip() for q in raw if str(q).strip()]
        if out:
            return out[:16]

    summary = analyze_payload.get("corpus_summary") or {}
    if not isinstance(summary, dict):
        summary = {}
    langs = summary.get("languages") or []
    lang_hint = langs[0] if isinstance(langs, list) and langs else "en"

    return [
        "What methodology was used and what are the main findings?",
        "Summarize implementation details and technical trade-offs.",
        "Which results or metrics are highlighted in the document?",
        f"What is the primary language or audience context ({lang_hint})?",
    ]


def _fingerprint(c: dict[str, Any]) -> tuple[Any, ...]:
    strat = str(c.get("strategy") or "similarity")
    tk = int(c.get("top_k") or 5)
    if strat == "hybrid":
        ha = round(float(c.get("hybrid_alpha") or 0.5), 3)
        hf = str(c.get("hybrid_fusion") or "rrf")
    else:
        ha = None
        hf = None
    if strat in ("mmr", "ensemble"):
        ml = round(float(c.get("mmr_lambda") or 0.5), 3)
    else:
        ml = None
    return (strat, tk, ha, hf, ml, bool(c.get("reranking_enabled")))


def build_retrieval_candidates(
    *,
    requirements: dict[str, Any],
    pipeline_config: dict[str, Any] | None,
    analyze_payload: dict[str, Any],
) -> list[dict[str, Any]]:
    """Expand a bounded list of retrieval configs to benchmark."""

    max_n = int(requirements.get("retrieval_max_benchmarks") or 8)
    max_n = max(2, min(max_n, 14))

    stages = (pipeline_config or {}).get("stages") if isinstance(pipeline_config, dict) else None
    ret = stages.get("retrieval") if isinstance(stages, dict) else None
    rer = stages.get("reranking") if isinstance(stages, dict) else None

    def from_pipeline() -> dict[str, Any] | None:
        if not isinstance(ret, dict):
            return None
        strat = str(ret.get("strategy") or "similarity").lower()
        hs = ret.get("hybrid_search") if isinstance(ret.get("hybrid_search"), dict) else {}
        alpha = float(hs.get("alpha") or 0.5) if hs else 0.5
        rer_on = bool(rer and isinstance(rer, dict) and rer.get("enabled"))
        return {
            "strategy": strat,
            "top_k": int(ret.get("top_k") or 5),
            "hybrid_alpha": alpha,
            "hybrid_fusion": "rrf",
            "mmr_lambda": 0.5,
            "mmr_fetch_k": None,
            "reranking_enabled": rer_on,
            "rerank_top_n": int(rer.get("top_n") or ret.get("top_k") or 5)
            if rer_on and isinstance(rer, dict)
            else None,
        }

    summary = analyze_payload.get("corpus_summary") or {}
    if not isinstance(summary, dict):
        summary = {}
    signals = summary.get("signals") or {}
    if not isinstance(signals, dict):
        signals = {}

    optimize = str(requirements.get("optimize_for") or "balanced").lower()
    if optimize == "latency":
        top_ks = (3, 5, 8)
    elif optimize == "quality":
        top_ks = (8, 12, 16)
    else:
        top_ks = (5, 8, 12)

    pool: list[dict[str, Any]] = []

    base = from_pipeline()
    if base:
        pool.append(base)

    # Core strategies
    for tk in top_ks:
        pool.append(
            {
                "strategy": "similarity",
                "top_k": tk,
                "hybrid_alpha": None,
                "hybrid_fusion": None,
                "mmr_lambda": None,
                "mmr_fetch_k": None,
                "reranking_enabled": False,
                "rerank_top_n": None,
            },
        )
        pool.append(
            {
                "strategy": "mmr",
                "top_k": tk,
                "hybrid_alpha": None,
                "hybrid_fusion": None,
                "mmr_lambda": 0.45 if signals.get("code_heavy") else 0.55,
                "mmr_fetch_k": max(tk * 4, tk),
                "reranking_enabled": False,
                "rerank_top_n": None,
            },
        )
        for alpha in (0.35, 0.55, 0.72):
            for fusion in ("rrf", "weighted"):
                pool.append(
                    {
                        "strategy": "hybrid",
                        "top_k": tk,
                        "hybrid_alpha": alpha,
                        "hybrid_fusion": fusion,
                        "mmr_lambda": None,
                        "mmr_fetch_k": None,
                        "reranking_enabled": False,
                        "rerank_top_n": None,
                    },
                )

    if signals.get("markdown_structure") or optimize == "quality":
        pool.append(
            {
                "strategy": "multi-query",
                "top_k": min(10, top_ks[-1]),
                "hybrid_alpha": None,
                "hybrid_fusion": None,
                "mmr_lambda": None,
                "mmr_fetch_k": None,
                "reranking_enabled": False,
                "rerank_top_n": None,
            },
        )

    if signals.get("code_heavy") or optimize == "quality":
        pool.append(
            {
                "strategy": "ensemble",
                "top_k": min(10, top_ks[-1]),
                "hybrid_alpha": None,
                "hybrid_fusion": None,
                "mmr_lambda": 0.5,
                "mmr_fetch_k": max(min(10, top_ks[-1]) * 4, 10),
                "reranking_enabled": False,
                "rerank_top_n": None,
            },
        )

    # Reranking variants on a strong hybrid default
    pool.append(
        {
            "strategy": "hybrid",
            "top_k": 8,
            "hybrid_alpha": 0.55,
            "hybrid_fusion": "rrf",
            "mmr_lambda": None,
            "mmr_fetch_k": None,
            "reranking_enabled": True,
            "rerank_top_n": 5,
        },
    )

    seen: set[tuple[Any, ...]] = set()
    out: list[dict[str, Any]] = []
    for c in pool:
        fp = _fingerprint(c)
        if fp in seen:
            continue
        seen.add(fp)
        out.append(c)
        if len(out) >= max_n:
            break

    return out[:max_n]


def _latency_proxy(c: dict[str, Any]) -> float:
    """Higher = slower / more expensive (for inversion in composite)."""

    tk = int(c.get("top_k") or 5)
    base = 1.0 + 0.04 * max(0, tk - 5)
    strat = str(c.get("strategy") or "similarity").lower()
    if strat == "hybrid":
        base += 0.28
    elif strat == "mmr":
        base += 0.18
    elif strat == "multi-query":
        base += 0.42
    elif strat == "ensemble":
        base += 0.38
    elif strat == "parent-child":
        base += 0.12
    if c.get("reranking_enabled"):
        base += 0.32
    return base


def _rank_indices_for_candidate(
    query: str,
    chunks: list[str],
    tokenized: list[list[str]],
    c: dict[str, Any],
) -> list[int]:
    """Return chunk indices best-first for this candidate (full ranking before top_k cut)."""

    n = len(chunks)
    if n == 0:
        return []
    keys = [f"idx:{i}" for i in range(n)]
    dense = _dense_scores(query, chunks)
    bm25 = BM25Index(tokenized)

    strat = str(c.get("strategy") or "similarity").lower()
    top_k = min(int(c.get("top_k") or 5), n)

    if strat == "similarity":
        order = sorted(range(n), key=lambda i: dense[i], reverse=True)
        return _maybe_rerank(query, chunks, order, c)

    if strat == "hybrid":
        alpha = float(c.get("hybrid_alpha") or 0.5)
        fusion = str(c.get("hybrid_fusion") or "rrf").lower()
        dense_by = {i: float(dense[i]) for i in range(n)}
        sparse_scores = bm25.scores(query)
        sparse_by = {i: float(sparse_scores[i]) for i in range(n)}
        if fusion == "weighted":
            combined = weighted_dense_sparse(dense_by, sparse_by, alpha=alpha)
            order = sorted(combined.keys(), key=lambda i: combined[i], reverse=True)
        else:
            dense_order = sorted(range(n), key=lambda i: dense[i], reverse=True)
            bm25_order = bm25.top_indices(query, k=n)
            fused = reciprocal_rank_fusion_keys(
                [[keys[i] for i in dense_order], [keys[i] for i in bm25_order]],
            )
            rank_map = {int(k.split(":")[1]): r for r, (k, _) in enumerate(fused)}
            order = sorted(range(n), key=lambda i: rank_map.get(i, 9999))
        return _maybe_rerank(query, chunks, order, c)

    if strat == "mmr":
        qv = _hashing_vector(query)
        doc_vecs = [_hashing_vector(chunks[i]) for i in range(n)]
        lam = float(c.get("mmr_lambda") or 0.5)
        fetch = c.get("mmr_fetch_k")
        fetch_n = int(fetch) if fetch is not None else max(top_k * 4, top_k)
        fetch_n = min(max(fetch_n, top_k), n)
        pre = sorted(range(n), key=lambda i: dense[i], reverse=True)[:fetch_n]
        sub_vecs = [_hashing_vector(chunks[i]) for i in pre]
        order_pre = mmr_order(qv, sub_vecs, k=fetch_n, lambda_mult=lam)
        order = [pre[i] for i in order_pre]
        # append any missing
        rest = [i for i in range(n) if i not in order]
        order.extend(rest)
        return _maybe_rerank(query, chunks, order, c)

    if strat == "multi-query":
        q2 = query + " explain technical details"
        d1 = sorted(range(n), key=lambda i: dense[i], reverse=True)
        d2 = sorted(range(n), key=lambda i: _dense_scores(q2, chunks)[i], reverse=True)
        fused = reciprocal_rank_fusion_keys([[keys[i] for i in d1], [keys[i] for i in d2]])
        rank_map = {int(k.split(":")[1]): r for r, (k, _) in enumerate(fused)}
        order = sorted(range(n), key=lambda i: rank_map.get(i, 9999))
        return _maybe_rerank(query, chunks, order, c)

    if strat == "ensemble":
        qv = _hashing_vector(query)
        doc_vecs = [_hashing_vector(chunks[i]) for i in range(n)]
        d_order = sorted(range(n), key=lambda i: dense[i], reverse=True)
        mmr_idx = mmr_order(qv, doc_vecs, k=min(n, max(top_k * 4, top_k)), lambda_mult=float(c.get("mmr_lambda") or 0.5))
        fused = reciprocal_rank_fusion_keys([[keys[i] for i in d_order], [keys[i] for i in mmr_idx]])
        rank_map = {int(k.split(":")[1]): r for r, (k, _) in enumerate(fused)}
        order = sorted(range(n), key=lambda i: rank_map.get(i, 9999))
        return _maybe_rerank(query, chunks, order, c)

    # parent-child and unknown fall back to similarity
    order = sorted(range(n), key=lambda i: dense[i], reverse=True)
    return _maybe_rerank(query, chunks, order, c)


def _maybe_rerank(query: str, chunks: list[str], order: list[int], c: dict[str, Any]) -> list[int]:
    if not c.get("reranking_enabled"):
        return order
    top_n = int(c.get("rerank_top_n") or c.get("top_k") or 5)
    fetch = min(len(order), max(top_n * 4, top_n, 8))
    head = order[:fetch]
    scored = sorted(head, key=lambda i: _bigram_overlap(query, chunks[i]), reverse=True)
    tail = [i for i in order if i not in scored]
    return scored + tail


def _mrr_for_queries(
    chunks: list[str],
    tokenized: list[list[str]],
    queries: list[str],
    c: dict[str, Any],
) -> float:
    bm25 = BM25Index(tokenized)
    recip: list[float] = []
    for q in queries:
        sparse = bm25.scores(q)
        oracle = max(range(len(chunks)), key=lambda i: sparse[i]) if chunks else 0
        ranking = _rank_indices_for_candidate(q, chunks, tokenized, c)
        try:
            rank = ranking.index(oracle) + 1
        except ValueError:
            rank = len(chunks) + 5
        recip.append(1.0 / float(rank))
    return sum(recip) / max(len(recip), 1)


def _normalize(vals: list[float], *, invert: bool = False) -> list[float]:
    if not vals:
        return []
    lo, hi = min(vals), max(vals)
    span = hi - lo
    if span < 1e-12:
        return [0.5 for _ in vals]
    out = [(v - lo) / span for v in vals]
    if invert:
        return [1.0 - x for x in out]
    return out


def _composite(
    *,
    optimize_for: str,
    mrr_n: float,
    lat_n: float,
) -> float:
    if optimize_for == "quality":
        return 0.72 * mrr_n + 0.28 * lat_n
    if optimize_for == "latency":
        return 0.55 * lat_n + 0.45 * mrr_n
    if optimize_for == "cost":
        return 0.50 * lat_n + 0.50 * mrr_n
    return 0.52 * mrr_n + 0.48 * lat_n


def run_retrieval_optimizer(
    *,
    embedding_payload: dict[str, Any],
    chunking_payload: dict[str, Any],
    analyze_payload: dict[str, Any],
    requirements: dict[str, Any],
    pipeline_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Produce ``stage_outputs['retrieval']`` after a successful embedding stage."""

    if embedding_payload.get("status") != "complete":
        return {
            "status": "failed",
            "reason": "embedding_not_complete",
            "selected": None,
            "candidates_tried": [],
        }
    if chunking_payload.get("status") != "complete":
        return {
            "status": "failed",
            "reason": "chunking_not_complete",
            "selected": None,
            "candidates_tried": [],
        }

    chunks = _chunk_texts(
        analyze_payload=analyze_payload,
        chunking_payload=chunking_payload,
        requirements=requirements,
    )
    if not chunks:
        return {
            "status": "failed",
            "reason": "insufficient_chunks",
            "selected": None,
            "candidates_tried": [],
        }
    if len(chunks) == 1:
        # Single-chunk corpus still supports relative latency / strategy comparisons.
        chunks = [chunks[0], chunks[0] + "\n\n(autopilot retrieval bench duplicate for rank stability.)"]

    queries = _build_eval_queries(analyze_payload, requirements)
    tokenized = [tokenize(t) for t in chunks]

    candidates = build_retrieval_candidates(
        requirements=requirements,
        pipeline_config=pipeline_config,
        analyze_payload=analyze_payload,
    )
    if not candidates:
        return {
            "status": "failed",
            "reason": "no_retrieval_candidates",
            "selected": None,
            "candidates_tried": [],
        }

    optimize_for = str(requirements.get("optimize_for") or "balanced").lower()
    mrr_scores: list[float] = []
    latencies: list[float] = []
    rows: list[dict[str, Any]] = []

    for c in candidates:
        mrr = _mrr_for_queries(chunks, tokenized, queries, c)
        lat = _latency_proxy(c)
        mrr_scores.append(mrr)
        latencies.append(lat)
        rows.append({**c, "mrr": round(mrr, 5), "latency_proxy": round(lat, 4)})

    mrr_n = _normalize(mrr_scores)
    lat_n = _normalize(latencies, invert=True)

    best_i = -1
    best_score = -1e9
    for i, row in enumerate(rows):
        comp = _composite(
            optimize_for=optimize_for,
            mrr_n=mrr_n[i] if i < len(mrr_n) else 0.5,
            lat_n=lat_n[i] if i < len(lat_n) else 0.5,
        )
        row["composite_score"] = round(comp, 5)
        if comp > best_score:
            best_score = comp
            best_i = i

    if best_i < 0:
        return {
            "status": "failed",
            "reason": "no_retrieval_candidates",
            "selected": None,
            "candidates_tried": rows,
        }
    winner = candidates[best_i]
    sel_emb = (embedding_payload.get("selected") or {}).get("model", "?")

    rationale = (
        f"Benchmarked {len(candidates)} retrieval setting(s) on {len(chunks)} chunk(s) with "
        f"{len(queries)} offline quer(ies); oracle = BM25 argmax per query, score blends MRR vs "
        f"latency proxy for optimize_for={optimize_for!r}. "
        f"Winner: **{winner['strategy']}** top_k={winner['top_k']}"
        + (
            f", hybrid α={winner.get('hybrid_alpha')}, fusion={winner.get('hybrid_fusion')}"
            if winner.get("strategy") == "hybrid"
            else ""
        )
        + (
            f", MMR λ={winner.get('mmr_lambda')}"
            if winner.get("strategy") in ("mmr", "ensemble")
            else ""
        )
        + (", reranking **on** (overlap proxy)" if winner.get("reranking_enabled") else "")
        + f". Embedding context: model `{sel_emb}`."
    )

    payload: dict[str, Any] = {
        "status": "complete",
        "selected": {
            "strategy": winner["strategy"],
            "top_k": winner["top_k"],
            "hybrid_alpha": winner.get("hybrid_alpha"),
            "hybrid_fusion": winner.get("hybrid_fusion"),
            "mmr_lambda": winner.get("mmr_lambda"),
            "mmr_fetch_k": winner.get("mmr_fetch_k"),
            "reranking_enabled": bool(winner.get("reranking_enabled")),
            "rerank_top_n": winner.get("rerank_top_n"),
            "composite_score": round(best_score, 5),
            "mrr": rows[best_i].get("mrr"),
            "rationale": rationale,
        },
        "candidates_tried": rows,
        "eval_query_count": len(queries),
        "chunk_count": len(chunks),
    }
    logger.info(
        "retrieval_optimizer_complete",
        strategy=winner["strategy"],
        top_k=winner["top_k"],
        score=round(best_score, 4),
    )
    return payload


def human_readable_retrieval_message(payload: dict[str, Any]) -> str:
    if payload.get("status") != "complete":
        return f"Retrieval optimizer: **failed** — {payload.get('reason', 'unknown')}."

    sel = payload.get("selected") or {}
    return (
        f"Retrieval optimizer: selected **{sel.get('strategy', '?')}** "
        f"(top_k={sel.get('top_k')}, rerank={'on' if sel.get('reranking_enabled') else 'off'}, "
        f"score≈{sel.get('composite_score')}, MRR≈{sel.get('mrr')})."
    )


def run_retrieval_optimizer_from_json(
    embedding_json: str,
    chunking_json: str,
    analyze_json: str,
    requirements_json: str,
    pipeline_config_json: str = "",
) -> str:
    """JSON in / JSON out for LangChain tools."""

    def _loads(label: str, raw: str) -> dict[str, Any]:
        try:
            obj = json.loads(raw) if raw.strip() else {}
        except json.JSONDecodeError as exc:
            return {"__error__": f"invalid {label}", "detail": str(exc)}
        if not isinstance(obj, dict):
            return {"__error__": f"{label} must be a JSON object"}
        return obj

    embedding = _loads("embedding_json", embedding_json)
    if "__error__" in embedding:
        return json.dumps(embedding, ensure_ascii=False)

    chunking = _loads("chunking_json", chunking_json)
    if "__error__" in chunking:
        return json.dumps(chunking, ensure_ascii=False)

    analyze = _loads("analyze_json", analyze_json)
    if "__error__" in analyze:
        return json.dumps(analyze, ensure_ascii=False)

    req = _loads("requirements_json", requirements_json)
    if "__error__" in req:
        return json.dumps(req, ensure_ascii=False)

    pipe_raw = pipeline_config_json.strip()
    pipeline_config: dict[str, Any] | None = None
    if pipe_raw:
        try:
            p = json.loads(pipe_raw)
        except json.JSONDecodeError as exc:
            return json.dumps({"error": "invalid pipeline_config_json", "detail": str(exc)})
        pipeline_config = p if isinstance(p, dict) else None

    payload = run_retrieval_optimizer(
        embedding_payload=dict(embedding),
        chunking_payload=dict(chunking),
        analyze_payload=dict(analyze),
        requirements=dict(req),
        pipeline_config=pipeline_config,
    )
    return json.dumps(payload, ensure_ascii=False)
