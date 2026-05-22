"""Document Analyst — corpus signals and catalog-aligned chunking hints (P6-2).

Callers may attach ``requirements["corpus_profiles"]`` (list of dicts) produced after
ingestion; otherwise profiles are inferred minimally from ``document_ids``.
Recommendations mirror strategy ids in ``data/chunking-strategies.json`` without a
runtime file dependency so unit tests stay hermetic.
"""

from __future__ import annotations

from typing import Any

import structlog

logger = structlog.get_logger(__name__)

# Catalog strategy ids (keep in sync with data/chunking-strategies.json)
_STRATEGY_RECURSIVE = "recursive-character"
_STRATEGY_FIXED = "fixed-size"
_STRATEGY_SEMANTIC = "semantic"
_STRATEGY_MARKDOWN = "markdown-header"
_STRATEGY_CODE = "code-aware"
_STRATEGY_PARAGRAPH = "paragraph-based"


def _norm_ext(ft: Any) -> str:
    s = str(ft or "").strip().lower().lstrip(".")
    return s if s else "unknown"


def corpus_profiles_from_state(
    *,
    document_ids: list[str],
    requirements: dict[str, Any],
) -> list[dict[str, Any]]:
    raw = requirements.get("corpus_profiles")
    if isinstance(raw, list) and raw:
        out: list[dict[str, Any]] = []
        for item in raw:
            if isinstance(item, dict):
                out.append(dict(item))
        if out:
            return out
    return [{"source_id": did, "file_type": "unknown"} for did in document_ids]


def build_corpus_summary(
    profiles: list[dict[str, Any]],
    *,
    requirements: dict[str, Any],
) -> dict[str, Any]:
    if not profiles:
        return {
            "document_count": 0,
            "file_type_counts": {},
            "total_chars": 0,
            "languages": [],
            "signals": {"markdown_structure": False, "code_heavy": False, "tabular": False},
            "notes": ["No documents or profiles supplied; using conservative defaults."],
        }

    type_counts: dict[str, int] = {}
    total_chars = 0
    langs: set[str] = set()
    max_code_ratio = 0.0
    max_table = 0.0
    markdown_hits = 0

    for p in profiles:
        ft = _norm_ext(p.get("file_type"))
        type_counts[ft] = type_counts.get(ft, 0) + 1
        try:
            total_chars += int(p.get("char_count") or 0)
        except (TypeError, ValueError):
            pass
        lang = p.get("language") or p.get("lang")
        if isinstance(lang, str) and lang.strip():
            langs.add(lang.strip().lower())
        try:
            max_code_ratio = max(max_code_ratio, float(p.get("code_line_ratio") or 0))
        except (TypeError, ValueError):
            pass
        try:
            max_table = max(max_table, float(p.get("approx_table_fraction") or 0))
        except (TypeError, ValueError):
            pass
        if p.get("has_markdown_headings") is True or ft in ("md", "markdown"):
            markdown_hits += 1

    dominant = max(type_counts, key=lambda k: type_counts[k]) if type_counts else "unknown"
    notes: list[str] = []
    if "unknown" in type_counts and len(type_counts) == 1:
        notes.append(
            "File types unknown — refine profiles post-ingestion for tighter recommendations."
        )

    return {
        "document_count": len(profiles),
        "file_type_counts": dict(sorted(type_counts.items(), key=lambda kv: (-kv[1], kv[0]))),
        "dominant_file_type": dominant,
        "total_chars": total_chars,
        "languages": sorted(langs),
        "signals": {
            "markdown_structure": markdown_hits > 0 or dominant in ("md", "markdown"),
            "code_heavy": max_code_ratio >= 0.2
            or dominant
            in (
                "py",
                "js",
                "ts",
                "tsx",
                "jsx",
                "go",
                "rs",
                "java",
                "cpp",
                "c",
                "cs",
            ),
            "tabular": max_table >= 0.15 or dominant == "csv",
        },
        "notes": notes,
    }


def recommend_chunking(
    summary: dict[str, Any],
    *,
    requirements: dict[str, Any],
) -> dict[str, Any]:
    optimize = str(requirements.get("optimize_for") or "balanced").lower()
    signals = summary.get("signals") or {}
    dominant = str(summary.get("dominant_file_type") or "unknown")
    doc_count = int(summary.get("document_count") or 0)

    primary = _STRATEGY_RECURSIVE
    rationale = "General mixed or unknown corpus — recursive-character respects natural boundaries without embedding calls."  # noqa: E501
    alternates = [_STRATEGY_FIXED, _STRATEGY_PARAGRAPH]
    params: dict[str, Any] = {"strategyId": primary, "chunkSize": 1024, "chunkOverlap": 120}

    if signals.get("code_heavy"):
        primary = _STRATEGY_CODE
        rationale = "Code-like extensions or high code_line_ratio — code-aware chunking keeps syntactic units intact."  # noqa: E501
        alternates = [_STRATEGY_RECURSIVE, _STRATEGY_SEMANTIC]
        params = {"strategyId": primary, "chunkSize": 512, "chunkOverlap": 80}
    elif signals.get("markdown_structure"):
        primary = _STRATEGY_MARKDOWN
        rationale = "Markdown headings detected — markdown-header preserves section boundaries for RAG citations."  # noqa: E501
        alternates = [_STRATEGY_RECURSIVE, _STRATEGY_SEMANTIC]
        params = {"strategyId": primary, "chunkSize": 1200, "chunkOverlap": 100}
    elif signals.get("tabular") or dominant == "csv":
        primary = _STRATEGY_FIXED
        rationale = (
            "Tabular / CSV-heavy corpora benefit from uniform chunk sizes aligned with rows."
        )
        alternates = [_STRATEGY_RECURSIVE, _STRATEGY_PARAGRAPH]
        params = {"strategyId": primary, "chunkSize": 512, "chunkOverlap": 0}
    elif optimize == "quality" and doc_count > 1 and dominant not in ("unknown", "txt", "csv"):
        primary = _STRATEGY_SEMANTIC
        rationale = "Quality-first goal with structured sources — semantic chunking clusters meaning (higher latency/cost)."  # noqa: E501
        alternates = [_STRATEGY_RECURSIVE, _STRATEGY_MARKDOWN]
        params = {"strategyId": primary, "chunkSize": 512, "chunkOverlap": 64}
    elif optimize == "latency":
        primary = _STRATEGY_FIXED
        rationale = "Latency target — fixed-size is fastest to chunk at scale."
        alternates = [_STRATEGY_RECURSIVE, _STRATEGY_PARAGRAPH]
        params = {"strategyId": primary, "chunkSize": 768, "chunkOverlap": 64}

    return {
        "primary_strategy": primary,
        "alternate_strategies": alternates,
        "rationale": rationale,
        "suggested_parameters": params,
        "optimize_for": optimize,
    }


def run_document_analyst(
    *,
    document_ids: list[str],
    requirements: dict[str, Any],
) -> dict[str, Any]:
    """Return machine-readable analyze payload for ``stage_outputs['analyze']``."""

    profiles = corpus_profiles_from_state(
        document_ids=list(document_ids), requirements=requirements
    )
    summary = build_corpus_summary(profiles, requirements=requirements)
    recommendation = recommend_chunking(summary, requirements=requirements)
    payload = {
        "status": "complete",
        "corpus_summary": summary,
        "chunking_recommendation": recommendation,
        "profile_count": len(profiles),
    }
    logger.info(
        "document_analyst_complete",
        documents=len(document_ids),
        profiles=len(profiles),
        primary=recommendation.get("primary_strategy"),
    )
    return payload


def human_readable_analyst_message(payload: dict[str, Any]) -> str:
    rec = payload.get("chunking_recommendation") or {}
    summ = payload.get("corpus_summary") or {}
    strat = rec.get("primary_strategy", "?")
    rationale = rec.get("rationale", "")
    types = summ.get("file_type_counts") or {}
    type_hint = ", ".join(f"{k}:{v}" for k, v in list(types.items())[:5]) or "n/a"
    return (
        f"Document analyst: {summ.get('document_count', 0)} profile(s). "
        f"Types: {type_hint}. "
        f"Recommended chunking: **{strat}**. {rationale}"
    )
