"""Lightweight synthetic test-set helpers for evaluation (P2-7).

Full LLM-based QG belongs in the Autopilot Evaluation Agent; this module offers
deterministic baselines for integration tests and bootstrapping small eval sets.
"""

from __future__ import annotations

import random

from langchain_core.documents import Document

from app.core.evaluation.strategies import EvaluationExample


def examples_from_documents(
    documents: list[Document],
    *,
    max_items: int = 50,
    seed: int | None = None,
) -> list[EvaluationExample]:
    """Build trivial QA rows from chunk texts (placeholder answers for retrieval-only eval).

    Each row uses the document ``page_content`` as ``ground_truth`` and a generic
    question. **Callers should replace ``answer`` with a real model completion** after
    running retrieval + generation, or supply contexts from their pipeline.
    """
    if seed is not None:
        random.seed(seed)
    if not documents:
        return []
    picks = list(documents)
    random.shuffle(picks)
    out: list[EvaluationExample] = []
    for doc in picks[:max_items]:
        text = (doc.page_content or "").strip()
        if len(text) < 20:
            continue
        gt = text[:4000]
        q = (
            "Based on the retrieved knowledge, what are the main facts described "
            "in the supporting context?"
        )
        out.append(
            EvaluationExample(
                question=q,
                answer="",
                contexts=[],
                ground_truth=gt,
            )
        )
    return out


def examples_from_text_snippets(
    snippets: list[str], *, max_items: int = 50
) -> list[EvaluationExample]:
    """Create evaluation rows from raw strings (e.g. concatenated chunks)."""
    docs = [Document(page_content=s) for s in snippets if s.strip()]
    return examples_from_documents(docs, max_items=max_items)
