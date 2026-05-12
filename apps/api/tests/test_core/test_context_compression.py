"""Unit tests for context compression post-retrieval."""

from __future__ import annotations

from langchain_core.documents import Document

from app.core.context_compression import apply_context_compression
from app.core.context_compression.pipeline_bridge import context_compression_runtime_from_pipeline
from app.core.vectorstore.strategies import ScoredDoc
from app.schemas.pipeline import ContextCompressionConfigSchema


def test_apply_relevance_filter_drops_low_scores() -> None:
    cfg = ContextCompressionConfigSchema(
        enabled=True,
        mode="relevance_filter",
        min_score=0.5,
    )
    rtc = context_compression_runtime_from_pipeline(cfg)
    scored = [
        ScoredDoc(Document(page_content="x", metadata={"id": "a"}), 0.9),
        ScoredDoc(Document(page_content="y", metadata={"id": "b"}), 0.2),
        ScoredDoc(Document(page_content="z", metadata={"id": "c"}), 0.6),
    ]
    out = apply_context_compression(scored, rtc)
    assert [s.document.metadata["id"] for s in out] == ["a", "c"]


def test_apply_dedupe_removes_near_duplicates() -> None:
    cfg = ContextCompressionConfigSchema(enabled=True, mode="dedupe")
    rtc = context_compression_runtime_from_pipeline(cfg)
    t = "alpha beta gamma delta"
    scored = [
        ScoredDoc(Document(page_content=t, metadata={"id": "a"}), 0.9),
        ScoredDoc(Document(page_content=t, metadata={"id": "b"}), 0.8),
        ScoredDoc(Document(page_content="other content here", metadata={"id": "c"}), 0.7),
    ]
    out = apply_context_compression(scored, rtc)
    assert len(out) == 2
    assert out[0].document.metadata["id"] == "a"
    assert {s.document.metadata["id"] for s in out} == {"a", "c"}
