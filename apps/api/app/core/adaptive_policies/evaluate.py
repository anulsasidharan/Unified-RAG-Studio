"""Evaluate simple predicate strings from the Designer adaptive policy list."""

from __future__ import annotations

from app.schemas.pipeline import AdaptivePolicyRuleSchema


def evaluate_adaptive_policies(
    rules: list[AdaptivePolicyRuleSchema] | None,
    *,
    query: str,
) -> list[str]:
    """Return actions for rules whose predicates match *query* (stable order)."""
    if not rules:
        return []
    wc = len(query.strip().split())
    out: list[str] = []
    for r in rules:
        pred = (r.predicate or "").strip()
        if pred.startswith("query_word_count_gt:"):
            try:
                lim = int(pred.split(":", 1)[1])
            except (ValueError, IndexError):
                continue
            if wc > lim:
                out.append(r.action)
        elif pred == "always":
            out.append(r.action)
    return out
