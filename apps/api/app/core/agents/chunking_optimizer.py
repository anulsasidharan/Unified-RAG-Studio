"""Chunking Optimizer — benchmarks analyst-backed candidates and picks a config (P6-3).

Runs the real ``ChunkingService`` on a **small synthetic corpus** derived from
``corpus_summary`` signals (plus optional ``requirements["chunking_sample_documents"]``
as JSON-serializable ``{"page_content": "...", "metadata": {}}`` entries for
integration tests). Scores chunks with ``ChunkQualityScorer`` and a lightweight
composite that respects ``optimize_for`` (quality / cost / latency / balanced).

``semantic`` candidates are attempted but **skipped on failure** (e.g. missing
``sentence-transformers``) so CI stays green without heavy model downloads.
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.documents import Document
import structlog

from app.core.chunking import ChunkingConfig, ChunkingService
from app.core.chunking.optimizers import ChunkQualityScorer

logger = structlog.get_logger(__name__)


def _synthetic_corpus_from_summary(
    summary: dict[str, Any],
    *,
    requirements: dict[str, Any],
) -> list[Document]:
    """Build 1–2 short LangChain documents that exercise prose, markdown, and/or code splits."""

    raw_docs = requirements.get("chunking_sample_documents")
    if isinstance(raw_docs, list) and raw_docs:
        out: list[Document] = []
        for item in raw_docs:
            if not isinstance(item, dict):
                continue
            text = item.get("page_content") or item.get("text") or ""
            meta = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
            if str(text).strip():
                out.append(Document(page_content=str(text), metadata=dict(meta)))
        if out:
            return out

    signals = summary.get("signals") or {}
    parts: list[str] = []

    if signals.get("markdown_structure"):
        parts.append(
            "# Executive summary\n"
            "This section introduces the main findings. "
            "It contains enough sentences to survive header-based splitting.\n\n"
            "## Methodology\n"
            "We evaluated several chunking strategies. "
            "Each strategy was scored for density and boundary quality.\n\n"
            "### Results\n"
            "Recursive splits preserve natural language boundaries better than fixed windows "
            "for mixed technical prose.\n",
        )
    else:
        parts.append(
            "Executive summary. "
            "This synthetic corpus approximates uploaded knowledge-base text without storing "
            "raw user files in the Autopilot graph state. "
            "Paragraph two continues with more detail so chunkers have material to work with. "
            "Paragraph three closes the narrative arc with conclusions and next steps.\n\n"
            "Second block: latency-sensitive deployments prefer fewer, larger chunks while "
            "quality-first workloads tolerate smaller windows and higher embedding cost.\n",
        )

    if signals.get("code_heavy"):
        parts.append(
            "```python\n"
            "def estimate_tokens(text: str) -> int:\n"
            "    return max(1, len(text) // 4)\n\n\n"
            "class ChunkJob:\n"
            "    def __init__(self, strategy: str) -> None:\n"
            "        self.strategy = strategy\n"
            "```\n",
        )

    if signals.get("tabular"):
        parts.append("sku,price,qty\nA1,9.99,3\nB2,14.50,1\nC3,2.00,10\n")

    body = "\n\n".join(parts)
    if len(body) < 400:
        body += "\n\n" + ("More reference text. " * 40)

    return [Document(page_content=body, metadata={"source": "autopilot_chunking_benchmark"})]


def _suggested_to_config(params: dict[str, Any]) -> ChunkingConfig:
    sid = params.get("strategyId") or params.get("strategy") or "recursive-character"
    return ChunkingConfig(
        strategy=str(sid),
        chunk_size=int(params.get("chunkSize") or params.get("chunk_size") or 512),
        chunk_overlap=int(params.get("chunkOverlap") or params.get("chunk_overlap") or 50),
    )


def build_optimizer_candidates(
    chunking_recommendation: dict[str, Any],
    *,
    requirements: dict[str, Any],
) -> list[ChunkingConfig]:
    """Expand analyst output into a small, deduped list of ``ChunkingConfig`` rows to benchmark."""

    suggested = chunking_recommendation.get("suggested_parameters") or {}
    base = _suggested_to_config(suggested if isinstance(suggested, dict) else {})
    max_n = int(requirements.get("chunking_max_benchmarks") or 6)
    max_n = max(2, min(max_n, 12))

    candidates: list[ChunkingConfig] = [base]
    seen: set[tuple[str, int, int]] = {(base.strategy, base.chunk_size, base.chunk_overlap)}

    alts = chunking_recommendation.get("alternate_strategies") or []
    if isinstance(alts, list):
        for alt in alts:
            if not isinstance(alt, str) or not alt.strip():
                continue
            cfg = ChunkingConfig(
                strategy=alt.strip(),
                chunk_size=base.chunk_size,
                chunk_overlap=base.chunk_overlap,
            )
            key = (cfg.strategy, cfg.chunk_size, cfg.chunk_overlap)
            if key in seen:
                continue
            seen.add(key)
            candidates.append(cfg)
            if len(candidates) >= max_n:
                break

    primary = chunking_recommendation.get("primary_strategy")
    if isinstance(primary, str) and primary.strip():
        p = primary.strip()
        if p != base.strategy:
            cfg = ChunkingConfig(
                strategy=p, chunk_size=base.chunk_size, chunk_overlap=base.chunk_overlap
            )
            key = (cfg.strategy, cfg.chunk_size, cfg.chunk_overlap)
            if key not in seen and len(candidates) < max_n:
                seen.add(key)
                candidates.append(cfg)

    optimize = str(requirements.get("optimize_for") or "balanced").lower()
    if optimize == "latency" and len(candidates) < max_n:
        larger_size = min(2048, int(base.chunk_size * 1.5))
        larger = ChunkingConfig(
            strategy=base.strategy,
            chunk_size=larger_size,
            chunk_overlap=min(base.chunk_overlap + 32, max(0, larger_size - 1)),
        )
        key = (larger.strategy, larger.chunk_size, larger.chunk_overlap)
        if key not in seen:
            candidates.append(larger)

    if optimize == "quality" and len(candidates) < max_n:
        smaller = ChunkingConfig(
            strategy=base.strategy,
            chunk_size=max(256, int(base.chunk_size * 0.75)),
            chunk_overlap=max(32, int(base.chunk_overlap * 0.75)),
        )
        key = (smaller.strategy, smaller.chunk_size, smaller.chunk_overlap)
        if key not in seen:
            candidates.append(smaller)

    return candidates[:max_n]


def _composite_score(
    chunks: list[Document],
    *,
    config: ChunkingConfig,
    optimize_for: str,
) -> float:
    if not chunks:
        return -1.0
    scorer = ChunkQualityScorer(target_size=max(config.chunk_size, 64))
    metrics = scorer.score_batch(chunks)
    mean_o = sum(m.overall for m in metrics) / len(metrics)
    n = len(chunks)
    if optimize_for == "latency":
        return mean_o - 0.018 * max(0, n - 12)
    if optimize_for == "cost":
        return mean_o - 0.012 * max(0, n - 10)
    if optimize_for == "quality":
        return mean_o + 0.003 * min(n, 30)
    return mean_o


def benchmark_chunking_configs(
    docs: list[Document],
    candidates: list[ChunkingConfig],
    *,
    requirements: dict[str, Any],
) -> tuple[list[dict[str, Any]], ChunkingConfig | None, float]:
    """Run chunk + score for each candidate; return rows, winner config, winning score."""

    service = ChunkingService()
    optimize_for = str(requirements.get("optimize_for") or "balanced").lower()
    rows: list[dict[str, Any]] = []
    best_cfg: ChunkingConfig | None = None
    best_score = -1e9

    for cfg in candidates:
        err: str | None = None
        chunks: list[Document] = []
        try:
            chunks = service.chunk(docs, cfg)
        except Exception as exc:  # noqa: BLE001 — benchmark must survive optional deps
            err = f"{type(exc).__name__}: {exc}"
            logger.warning("chunking_benchmark_failed", strategy=cfg.strategy, error=err)

        score = (
            _composite_score(chunks, config=cfg, optimize_for=optimize_for) if err is None else -1.0
        )
        row = {
            "strategy": cfg.strategy,
            "chunk_size": cfg.chunk_size,
            "chunk_overlap": cfg.chunk_overlap,
            "chunk_count": len(chunks),
            "composite_score": round(score, 5) if score > -0.99 else score,
            "error": err,
        }
        rows.append(row)
        if err is None and score > best_score:
            best_score = score
            best_cfg = cfg

    return rows, best_cfg, best_score


def run_chunking_optimizer(
    *,
    analyze_payload: dict[str, Any],
    requirements: dict[str, Any],
) -> dict[str, Any]:
    """Produce ``stage_outputs['chunking']`` payload from a completed analyze stage."""

    summary = analyze_payload.get("corpus_summary") or {}
    rec = analyze_payload.get("chunking_recommendation") or {}
    if not isinstance(rec, dict):
        rec = {}

    docs = _synthetic_corpus_from_summary(summary, requirements=requirements)
    candidates = build_optimizer_candidates(rec, requirements=requirements)
    rows, winner, best_score = benchmark_chunking_configs(
        docs, candidates, requirements=requirements
    )

    if winner is None:
        payload = {
            "status": "failed",
            "reason": "all_chunking_benchmarks_failed",
            "candidates_tried": rows,
            "selected": None,
        }
        logger.error("chunking_optimizer_failed", candidates=len(rows))
        return payload

    alts_tested = [
        r["strategy"] for r in rows if not r.get("error") and r["strategy"] != winner.strategy
    ]
    rationale = (
        f"Benchmarked {len(rows)} configuration(s) on a synthetic corpus aligned to corpus signals. "  # noqa: E501
        f"Selected **{winner.strategy}** (chunk_size={winner.chunk_size}, overlap={winner.chunk_overlap}) "  # noqa: E501
        f"with composite score {best_score:.4f} under optimize_for={requirements.get('optimize_for', 'balanced')!r}."  # noqa: E501
    )

    payload = {
        "status": "complete",
        "selected": {
            "strategy": winner.strategy,
            "chunk_size": winner.chunk_size,
            "chunk_overlap": winner.chunk_overlap,
            "composite_score": round(best_score, 5),
            "rationale": rationale,
        },
        "candidates_tried": rows,
        "alternatives_tested": alts_tested,
        "benchmark_document_count": len(docs),
    }
    logger.info(
        "chunking_optimizer_complete",
        winner=winner.strategy,
        chunk_size=winner.chunk_size,
        score=round(best_score, 4),
    )
    return payload


def human_readable_optimizer_message(payload: dict[str, Any]) -> str:
    if payload.get("status") != "complete":
        return f"Chunking optimizer: **failed** — {payload.get('reason', 'unknown')}."

    sel = payload.get("selected") or {}
    tried = payload.get("candidates_tried") or []
    ok = sum(1 for t in tried if not t.get("error"))
    return (
        f"Chunking optimizer: selected **{sel.get('strategy', '?')}** "
        f"(size={sel.get('chunk_size')}, overlap={sel.get('chunk_overlap')}, "
        f"score≈{sel.get('composite_score')}). "
        f"Evaluated {ok}/{len(tried)} candidate(s) successfully."
    )


def run_chunking_optimizer_from_json(analyze_json: str, requirements_json: str) -> str:
    """JSON in / JSON out for LangChain tools."""

    try:
        analyze = json.loads(analyze_json) if analyze_json.strip() else {}
    except json.JSONDecodeError as exc:
        return json.dumps({"error": "invalid analyze_json", "detail": str(exc)})
    if not isinstance(analyze, dict):
        return json.dumps({"error": "analyze_json must be a JSON object"})

    try:
        req = json.loads(requirements_json) if requirements_json.strip() else {}
    except json.JSONDecodeError as exc:
        return json.dumps({"error": "invalid requirements_json", "detail": str(exc)})
    if not isinstance(req, dict):
        return json.dumps({"error": "requirements_json must be a JSON object"})

    payload = run_chunking_optimizer(analyze_payload=analyze, requirements=req)
    return json.dumps(payload, ensure_ascii=False)
