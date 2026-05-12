"""Deterministic query expansion for retrieval benchmarks (no live LLM).

Mirrors designer ``queryProcessing`` flags with template-style variants so
Autopilot retrieval/evaluation agents can honor the stage without network calls.
"""

from __future__ import annotations

from typing import Any


def expand_retrieval_queries(user_query: str, qp: dict[str, Any] | None) -> list[str]:
    """Return one or more query strings to score against the corpus.

    When ``queryProcessing`` is disabled or missing, returns ``[user_query]``.
    """
    q = (user_query or "").strip()
    if not q:
        return []
    if not isinstance(qp, dict) or not qp.get("enabled"):
        return [q]

    def on(key_snake: str, key_camel: str) -> bool:
        return bool(qp.get(key_snake) or qp.get(key_camel))

    out: list[str] = [q]

    if on("query_rewrite", "queryRewrite"):
        out.append(f"{q}\n\n(rephrased for semantic search: core concepts and definitions)")

    if on("hyde", "hyde"):
        out.append(
            f"Hypothetical passage that would answer the question:\n"
            f"The documentation discusses {q[:120]} including methodology, results, and implications."
        )

    if on("multi_query_expansion", "multiQueryExpansion"):
        parts = [p.strip() for p in q.replace("?", ".").split(".") if p.strip()]
        for p in parts[:3]:
            if p.lower() != q.lower():
                out.append(p)

    if on("decomposition", "decomposition") and " and " in q.lower():
        for frag in [s.strip() for s in q.split(" and ") if s.strip()][:3]:
            if frag.lower() != q.lower():
                out.append(frag)

    if on("step_back", "stepBack"):
        out.append(f"High-level themes and abstractions related to: {q}")

    if on("intent_classification", "intentClassification"):
        out.append(f"User intent: information-seeking. Subject: {q}")

    if on("entity_extraction", "entityExtraction"):
        out.append(f"Key entities and terms: {q}")

    if on("keyword_augmentation", "keywordAugmentation"):
        toks = q.split()[:8]
        if toks:
            out.append(q + " " + " ".join(toks))

    # Dedupe preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for item in out:
        key = item.casefold()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped[:12]
