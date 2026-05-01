"""Heuristic failure clustering from per-row RAGAS scores (P2-7)."""

from __future__ import annotations

from math import isnan

import structlog

from app.schemas.evaluation import FailureAnalysisResult, FailureCategory, FailureCategoryName

logger = structlog.get_logger(__name__)


def _safe_float(v: object) -> float | None:
    if v is None:
        return None
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if isnan(x):
        return None
    return x


def analyze_failures(
    rows: list[dict[str, object]],
    *,
    faithfulness_threshold: float = 0.35,
    context_threshold: float = 0.35,
    answer_relevance_threshold: float = 0.35,
) -> FailureAnalysisResult:
    """Group low-scoring examples into categories with example questions.

    ``rows`` should include ``question`` plus optional RAGAS score keys per row.
    """
    categories: dict[FailureCategoryName, list[str]] = {
        "hallucination": [],
        "retrieval_quality": [],
        "context_gap": [],
        "format_error": [],
    }
    total = len(rows)
    if total == 0:
        return FailureAnalysisResult(
            total_failures=0,
            failure_rate=0.0,
            categories=[],
            summary="No evaluation rows to analyze.",
        )

    for row in rows:
        q = str(row.get("question", "")).strip()
        faith = _safe_float(row.get("faithfulness"))
        cp = _safe_float(row.get("context_precision"))
        cr = _safe_float(row.get("context_recall"))
        ar = _safe_float(row.get("answer_relevancy"))
        ans = str(row.get("answer", "")).strip()

        if not ans:
            categories["format_error"].append(q or "(empty question)")
            continue

        if faith is not None and faith < faithfulness_threshold:
            categories["hallucination"].append(q)
            continue

        if (cp is not None and cp < context_threshold) or (
            cr is not None and cr < context_threshold
        ):
            categories["retrieval_quality"].append(q)
            continue

        if (
            faith is not None
            and faith >= faithfulness_threshold
            and ar is not None
            and ar < answer_relevance_threshold
        ):
            categories["context_gap"].append(q)
            continue

    failure_rows = sum(len(v) for v in categories.values())
    rate = failure_rows / total if total else 0.0

    rec: dict[FailureCategoryName, str] = {
        "hallucination": "Review generation temperature and tighten prompts; verify contexts cover claims.",
        "retrieval_quality": "Improve chunking, hybrid retrieval, or reranking; expand corpus coverage.",
        "context_gap": "Context may be faithful but insufficient — add retrieval breadth or query expansion.",
        "format_error": "Ensure the generator returns non-empty answers and handle tool/JSON modes.",
    }

    out_cats: list[FailureCategory] = []
    for name, examples in categories.items():
        if not examples:
            continue
        out_cats.append(
            FailureCategory(
                category=name,
                count=len(examples),
                examples=examples[:5],
                recommendation=rec[name],
            )
        )

    summary = (
        f"Flagged {failure_rows} of {total} examples ({rate:.0%}) across "
        f"{len(out_cats)} failure categories."
    )
    logger.info("failure_analysis_complete", total=total, failure_rows=failure_rows)

    return FailureAnalysisResult(
        total_failures=failure_rows,
        failure_rate=rate,
        categories=out_cats,
        summary=summary,
    )
