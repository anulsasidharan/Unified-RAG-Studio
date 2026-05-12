"""Post-retrieval context compression helpers."""

from __future__ import annotations

from dataclasses import dataclass

from app.core.vectorstore.strategies import ScoredDoc


@dataclass
class ContextCompressionRuntimeConfig:
    enabled: bool = False
    mode: str = "none"
    min_score: float | None = None
    max_token_budget: int | None = None


def _word_jaccard(a: str, b: str) -> float:
    ta = set((a or "").lower().split()[:80])
    tb = set((b or "").lower().split()[:80])
    if not ta and not tb:
        return 1.0
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def apply_context_compression(
    scored: list[ScoredDoc],
    cfg: ContextCompressionRuntimeConfig | None,
) -> list[ScoredDoc]:
    if not scored or cfg is None or not cfg.enabled or cfg.mode == "none":
        return scored
    out = list(scored)
    if cfg.mode == "relevance_filter" and cfg.min_score is not None:
        thr = float(cfg.min_score)
        out = [s for s in out if float(s.score) >= thr] or scored[:1]
    if cfg.mode == "dedupe":
        kept: list[ScoredDoc] = []
        texts: list[str] = []
        max_sim = 0.88
        for s in out:
            t = (s.document.page_content or "")[:1500]
            if any(_word_jaccard(t, prev) >= max_sim for prev in texts):
                continue
            texts.append(t)
            kept.append(s)
        out = kept or out[:1]
    if cfg.mode == "summarize_stub":
        # Placeholder: trim to first k chunks as a stand-in for summarisation.
        k = 4
        out = out[:k]
    return out
