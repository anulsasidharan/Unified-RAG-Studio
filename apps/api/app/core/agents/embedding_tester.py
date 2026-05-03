"""Embedding Tester — benchmarks catalog-backed models on chunked text (P6-4).

Uses ``EmbeddingBenchmarker`` for live throughput/latency, enriches rows with
``data/models/embeddings.json`` metadata (MTEB proxy, list price), and selects a
winner via a composite score keyed off ``requirements["optimize_for"]``.

Benchmark texts come from ``ChunkingService`` applied to the same
signal-aware synthetic corpus as the chunking optimizer (or optional
``requirements["embedding_sample_texts"]`` for deterministic tests).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import structlog

from app.core.agents.chunking_optimizer import _synthetic_corpus_from_summary
from app.core.chunking import ChunkingConfig, ChunkingService
from app.core.embedding import EmbeddingBenchmarker, EmbeddingConfig
from app.core.embedding.benchmarker import BenchmarkResult

logger = structlog.get_logger(__name__)

_API_ROOT = Path(__file__).resolve().parents[3]


def _default_catalog_path() -> Path:
    return _API_ROOT.parent.parent / "data" / "models" / "embeddings.json"


def load_embedding_catalog(*, catalog_path: Path | None = None) -> list[dict[str, Any]]:
    """Load embedding model rows from JSON; returns ``[]`` if file missing."""

    path = catalog_path or _default_catalog_path()
    if not path.is_file():
        logger.warning("embedding_catalog_missing", path=str(path))
        return []
    with path.open(encoding="utf-8") as fh:
        raw = json.load(fh)
    models = raw.get("models")
    return [m for m in models if isinstance(m, dict)] if isinstance(models, list) else []


def _catalog_by_key(catalog: list[dict[str, Any]]) -> dict[tuple[str, str], dict[str, Any]]:
    out: dict[tuple[str, str], dict[str, Any]] = {}
    for row in catalog:
        pid = str(row.get("provider") or "").strip().lower()
        mid = str(row.get("id") or row.get("name") or "").strip()
        if pid and mid:
            out[(pid, mid)] = row
    return out


def _row_to_config(row: dict[str, Any]) -> EmbeddingConfig:
    return EmbeddingConfig(
        model=str(row.get("id") or row.get("name") or "text-embedding-3-small"),
        provider=str(row.get("provider") or "openai").lower(),
        dimensions=int(row.get("dimensions") or 1536),
    )


def _estimate_tokens(texts: list[str]) -> int:
    return max(1, sum(max(1, len(t) // 4) for t in texts))


def build_embedding_candidates(
    catalog: list[dict[str, Any]],
    *,
    requirements: dict[str, Any],
    pipeline_config: dict[str, Any] | None,
) -> list[EmbeddingConfig]:
    """Pick up to ``embedding_max_benchmarks`` non-deprecated models to try."""

    max_n = int(requirements.get("embedding_max_benchmarks") or 5)
    max_n = max(1, min(max_n, 8))

    rows = [m for m in catalog if not m.get("deprecated")]
    by_tier = {str(m.get("tier") or "balanced"): [] for m in rows}
    for m in rows:
        by_tier.setdefault(str(m.get("tier") or "balanced"), []).append(m)

    chosen: list[EmbeddingConfig] = []
    seen: set[tuple[str, str]] = set()

    def add_from_row(r: dict[str, Any]) -> None:
        cfg = _row_to_config(r)
        key = (cfg.provider, cfg.model)
        if key in seen:
            return
        seen.add(key)
        chosen.append(cfg)

    stages = (pipeline_config or {}).get("stages") if isinstance(pipeline_config, dict) else None
    emb = stages.get("embedding") if isinstance(stages, dict) else None
    if isinstance(emb, dict):
        mid = str(emb.get("model") or "").strip()
        prov = str(emb.get("provider") or "").strip().lower()
        if mid and prov:
            match = next(
                (
                    m
                    for m in rows
                    if str(m.get("id")) == mid and str(m.get("provider", "")).lower() == prov
                ),
                None,
            )
            if match:
                add_from_row(match)
            else:
                dims = int(emb.get("dimensions") or 1536)
                chosen.append(EmbeddingConfig(model=mid, provider=prov, dimensions=dims))
                seen.add((prov, mid))

    explicit = requirements.get("embedding_candidate_models")
    if isinstance(explicit, list):
        for item in explicit:
            if not isinstance(item, dict):
                continue
            mid = str(item.get("model") or item.get("id") or "").strip()
            prov = str(item.get("provider") or "").strip().lower()
            if not mid or not prov:
                continue
            match = next(
                (
                    m
                    for m in rows
                    if str(m.get("id")) == mid and str(m.get("provider", "")).lower() == prov
                ),
                None,
            )
            if match:
                add_from_row(match)
            else:
                key = (prov, mid)
                if key not in seen:
                    seen.add(key)
                    chosen.append(
                        EmbeddingConfig(
                            model=mid,
                            provider=prov,
                            dimensions=int(item.get("dimensions") or 1536),
                        )
                    )
            if len(chosen) >= max_n:
                return chosen[:max_n]

    optimize = str(requirements.get("optimize_for") or "balanced").lower()
    priority_tiers = (
        ("fast", "balanced", "advanced")
        if optimize == "latency"
        else ("advanced", "balanced", "fast")
        if optimize == "quality"
        else ("balanced", "fast", "advanced")
    )

    for tier in priority_tiers:
        bucket = by_tier.get(tier) or []
        bucket_sorted = sorted(
            bucket,
            key=lambda m: float(m.get("mtebScore") or 0.0),
            reverse=(optimize != "latency"),
        )
        for m in bucket_sorted:
            add_from_row(m)
            if len(chosen) >= max_n:
                return chosen[:max_n]

    for m in sorted(rows, key=lambda x: float(x.get("mtebScore") or 0.0), reverse=True):
        add_from_row(m)
        if len(chosen) >= max_n:
            break

    return chosen[:max_n]


def _normalize(vals: list[float], *, invert: bool = False) -> list[float]:
    if not vals:
        return []
    lo, hi = min(vals), max(vals)
    span = hi - lo
    if span < 1e-9:
        return [0.5 for _ in vals]
    out = [(v - lo) / span for v in vals]
    if invert:
        return [1.0 - x for x in out]
    return out


def _composite_for_optimize(
    *,
    optimize_for: str,
    mteb_n: float,
    tps_n: float,
    lat_n: float,
    cost_n: float,
) -> float:
    """Higher is better.

    ``cost_n`` and ``lat_n`` use lower-is-better costs already mapped to higher-is-better units.
    """

    if optimize_for == "quality":
        return 0.55 * mteb_n + 0.25 * tps_n + 0.12 * lat_n + 0.08 * cost_n
    if optimize_for == "latency":
        return 0.48 * tps_n + 0.28 * lat_n + 0.14 * mteb_n + 0.10 * cost_n
    if optimize_for == "cost":
        return 0.45 * cost_n + 0.28 * mteb_n + 0.17 * tps_n + 0.10 * lat_n
    return 0.28 * mteb_n + 0.28 * tps_n + 0.22 * lat_n + 0.22 * cost_n


def _build_benchmark_texts(
    *,
    analyze_payload: dict[str, Any],
    chunking_payload: dict[str, Any],
    requirements: dict[str, Any],
) -> list[str]:
    max_texts = int(requirements.get("embedding_max_texts") or 36)
    max_texts = max(2, min(max_texts, 96))

    sample = requirements.get("embedding_sample_texts")
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
            "Autopilot embedding benchmark line one.",
            "Autopilot embedding benchmark line two with more tokens for stability.",
        ]
    return texts[:max_texts]


def run_embedding_tester(
    *,
    chunking_payload: dict[str, Any],
    analyze_payload: dict[str, Any],
    requirements: dict[str, Any],
    pipeline_config: dict[str, Any] | None = None,
    benchmarker: EmbeddingBenchmarker | None = None,
) -> dict[str, Any]:
    """Produce ``stage_outputs['embedding']`` after a successful chunking stage."""

    if chunking_payload.get("status") != "complete":
        return {
            "status": "failed",
            "reason": "chunking_not_complete",
            "selected": None,
            "candidates_tried": [],
        }

    catalog = load_embedding_catalog()
    if not catalog:
        return {
            "status": "failed",
            "reason": "embedding_catalog_unavailable",
            "selected": None,
            "candidates_tried": [],
        }

    candidates = build_embedding_candidates(
        catalog,
        requirements=requirements,
        pipeline_config=pipeline_config,
    )
    if not candidates:
        return {
            "status": "failed",
            "reason": "no_embedding_candidates",
            "selected": None,
            "candidates_tried": [],
        }

    texts = _build_benchmark_texts(
        analyze_payload=analyze_payload,
        chunking_payload=chunking_payload,
        requirements=requirements,
    )
    est_tokens = _estimate_tokens(texts)
    catalog_index = _catalog_by_key(catalog)

    bench = benchmarker or EmbeddingBenchmarker()
    results = bench.benchmark(texts, candidates)
    success_keys = {(r.provider.lower(), r.model) for r in results}

    optimize_for = str(requirements.get("optimize_for") or "balanced").lower()

    mteb_raw: list[float] = []
    tps_raw: list[float] = []
    lat_raw: list[float] = []
    cost_raw: list[float] = []

    for r in results:
        row = catalog_index.get((r.provider.lower(), r.model), {})
        mteb = float(row.get("mtebScore") or 60.0)
        mteb_raw.append(max(0.0, min(1.0, (mteb - 52.0) / 14.0)))
        tps_raw.append(r.texts_per_second)
        lat_raw.append(r.avg_latency_ms)
        cpm = float(row.get("costPer1MTokens") or 0.0)
        cost_raw.append(cpm * (est_tokens / 1_000_000.0))

    mteb_n = _normalize(mteb_raw) if mteb_raw else []
    tps_n = _normalize(tps_raw) if tps_raw else []
    lat_n = _normalize(lat_raw, invert=True) if lat_raw else []
    cost_n = _normalize(cost_raw, invert=True) if cost_raw else []

    scored_rows: list[dict[str, Any]] = []
    best: tuple[float, BenchmarkResult | None] = (-1e9, None)

    for i, r in enumerate(results):
        comp = _composite_for_optimize(
            optimize_for=optimize_for,
            mteb_n=mteb_n[i] if i < len(mteb_n) else 0.5,
            tps_n=tps_n[i] if i < len(tps_n) else 0.5,
            lat_n=lat_n[i] if i < len(lat_n) else 0.5,
            cost_n=cost_n[i] if i < len(cost_n) else 0.5,
        )
        row_meta = catalog_index.get((r.provider.lower(), r.model), {})
        scored_rows.append(
            {
                "provider": r.provider,
                "model": r.model,
                "dimensions": r.dimensions,
                "texts_per_second": r.texts_per_second,
                "avg_latency_ms": r.avg_latency_ms,
                "total_time_s": r.total_time_s,
                "mteb_score_catalog": row_meta.get("mtebScore"),
                "estimated_tokens": est_tokens,
                "composite_score": round(comp, 5),
            },
        )
        if comp > best[0]:
            best = (comp, r)

    for cfg in candidates:
        key = (cfg.provider.lower(), cfg.model)
        if key not in success_keys:
            scored_rows.append(
                {
                    "provider": cfg.provider,
                    "model": cfg.model,
                    "error": "benchmark_failed_or_skipped",
                },
            )

    if best[1] is None:
        logger.error("embedding_tester_failed", candidates=len(candidates), successes=0)
        return {
            "status": "failed",
            "reason": "all_embedding_benchmarks_failed",
            "candidates_tried": scored_rows,
            "selected": None,
        }

    winner = best[1]
    wmeta = catalog_index.get((winner.provider.lower(), winner.model), {})
    strat = (chunking_payload.get("selected") or {}).get("strategy", "?")
    rationale = (
        f"Benchmarked {len(candidates)} embedding candidate(s) on {len(texts)} text(s) "
        f"(~{est_tokens} est. tokens) using chunking output **{strat}**. "
        f"Selected **{winner.provider}/{winner.model}** (dims={winner.dimensions}, "
        f"~{winner.texts_per_second} texts/s, latency≈{winner.avg_latency_ms} ms/text) "
        f"under optimize_for={optimize_for!r} with catalog MTEB {wmeta.get('mtebScore', 'n/a')}."
    )

    payload: dict[str, Any] = {
        "status": "complete",
        "selected": {
            "provider": winner.provider,
            "model": winner.model,
            "dimensions": winner.dimensions,
            "texts_per_second": winner.texts_per_second,
            "avg_latency_ms": winner.avg_latency_ms,
            "composite_score": round(best[0], 5),
            "rationale": rationale,
        },
        "candidates_tried": scored_rows,
        "benchmark_text_count": len(texts),
    }
    logger.info(
        "embedding_tester_complete",
        model=winner.model,
        provider=winner.provider,
        score=round(best[0], 4),
    )
    return payload


def human_readable_embedding_message(payload: dict[str, Any]) -> str:
    if payload.get("status") != "complete":
        return f"Embedding tester: **failed** — {payload.get('reason', 'unknown')}."

    sel = payload.get("selected") or {}
    tried = [t for t in (payload.get("candidates_tried") or []) if not t.get("error")]
    return (
        f"Embedding tester: selected **{sel.get('provider', '?')}/{sel.get('model', '?')}** "
        f"(dims={sel.get('dimensions')}, ~{sel.get('texts_per_second')} texts/s, "
        f"score≈{sel.get('composite_score')}). "
        f"Successful runs: {len(tried)}."
    )


def run_embedding_tester_from_json(
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

    chunking = _loads("chunking_json", chunking_json)
    if "__error__" in chunking:
        return json.dumps(chunking, ensure_ascii=False)

    analyze = _loads("analyze_json", analyze_json)
    if "__error__" in analyze:
        return json.dumps(analyze, ensure_ascii=False)

    req = _loads("requirements_json", requirements_json)
    if "__error__" in req:
        return json.dumps(req, ensure_ascii=False)
    requirements = req

    pipe_raw = pipeline_config_json.strip()
    pipeline_config: dict[str, Any] | None = None
    if pipe_raw:
        try:
            p = json.loads(pipe_raw)
        except json.JSONDecodeError as exc:
            return json.dumps({"error": "invalid pipeline_config_json", "detail": str(exc)})
        pipeline_config = p if isinstance(p, dict) else None

    payload = run_embedding_tester(
        chunking_payload=dict(chunking or {}),
        analyze_payload=dict(analyze or {}),
        requirements=dict(requirements),
        pipeline_config=pipeline_config,
    )
    return json.dumps(payload, ensure_ascii=False)
