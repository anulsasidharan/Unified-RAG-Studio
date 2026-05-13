"""Resolve generation model from optional routing rules (MVP heuristics)."""

from __future__ import annotations

from app.schemas.pipeline import (
    GenerationConfigSchema,
    PipelineConfigurationSchema,
    RoutingRuleSchema,
)


def _query_lower(query: str) -> str:
    return query.strip().lower()


def _keyword_match(rule: RoutingRuleSchema, q: str) -> bool:
    kws = [k.strip().lower() for k in (rule.keywords or []) if k.strip()]
    return bool(kws and any(k in q for k in kws))


def rule_matches(
    rule: RoutingRuleSchema,
    query: str,
    *,
    retriever_max_score: float | None,
) -> bool:
    """Return True when *rule* should fire for *query* (ordered evaluation by caller)."""
    q = _query_lower(query)
    thr = float(rule.threshold) if rule.threshold is not None else None
    cond = rule.condition

    if cond == "keyword":
        return _keyword_match(rule, q)
    if cond == "tool-routing":
        return _keyword_match(rule, q)

    if cond == "query-length":
        limit = int(thr) if thr is not None else 200
        return len(query) >= limit

    if cond in ("semantic-complexity", "semantic-routing"):
        wc = len(q.split())
        limit = int(thr) if thr is not None else 18
        return wc >= limit

    if cond == "cost-aware":
        wc = len(q.split())
        limit = int(thr) if thr is not None else 25
        return wc < limit

    if cond == "latency-aware":
        limit = int(thr) if thr is not None else 160
        return len(query) < limit

    if cond == "confidence-routing":
        if retriever_max_score is None:
            return False
        lim = float(thr) if thr is not None else 0.55
        return float(retriever_max_score) < lim

    return False


def generation_with_routing(
    pipeline: PipelineConfigurationSchema,
    query: str,
    *,
    retriever_max_score: float | None = None,
) -> GenerationConfigSchema:
    """Pick generation config after applying the first matching routing rule."""
    base = pipeline.stages.generation
    routing = pipeline.stages.routing
    if routing is None or not routing.enabled:
        return base
    rules = routing.rules or []
    for rule in rules:
        if rule_matches(rule, query, retriever_max_score=retriever_max_score):
            return base.model_copy(update={"model": rule.target_model})
    dm = routing.default_model
    if isinstance(dm, str) and dm.strip():
        return base.model_copy(update={"model": dm.strip()})
    return base
