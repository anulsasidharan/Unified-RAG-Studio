"""P6-3 chunking optimizer — candidate expansion and benchmark scoring."""

from __future__ import annotations

import json

from langchain_core.documents import Document

from app.core.agents.chunking_optimizer import (
    build_optimizer_candidates,
    run_chunking_optimizer,
    run_chunking_optimizer_from_json,
)
from app.core.agents.document_analyst import run_document_analyst


def test_build_optimizer_candidates_dedupes():
    rec = {
        "primary_strategy": "recursive-character",
        "alternate_strategies": ["fixed-size", "paragraph-based"],
        "suggested_parameters": {
            "strategyId": "recursive-character",
            "chunkSize": 512,
            "chunkOverlap": 50,
        },
    }
    cands = build_optimizer_candidates(rec, requirements={"chunking_max_benchmarks": 8})
    keys = {(c.strategy, c.chunk_size, c.chunk_overlap) for c in cands}
    assert len(keys) == len(cands)
    assert any(c.strategy == "recursive-character" for c in cands)


def test_run_chunking_optimizer_end_to_end():
    analyze = run_document_analyst(
        document_ids=["a", "b"], requirements={"optimize_for": "balanced"}
    )
    payload = run_chunking_optimizer(
        analyze_payload=analyze, requirements={"optimize_for": "balanced"}
    )
    assert payload["status"] == "complete"
    sel = payload["selected"]
    assert sel["strategy"]
    assert sel["chunk_size"] > 0
    assert isinstance(payload["candidates_tried"], list)
    assert len(payload["candidates_tried"]) >= 1


def test_run_chunking_optimizer_custom_sample_docs():
    analyze = run_document_analyst(document_ids=["x"], requirements={})
    req = {
        "optimize_for": "latency",
        "chunking_sample_documents": [
            {"page_content": "Hello world. " * 80, "metadata": {"doc": "1"}},
        ],
    }
    payload = run_chunking_optimizer(analyze_payload=analyze, requirements=req)
    assert payload["status"] == "complete"
    assert payload.get("benchmark_document_count") == 1


def test_run_chunking_optimizer_from_json_errors():
    bad = run_chunking_optimizer_from_json("not-json", "{}")
    assert "error" in json.loads(bad)


def test_benchmark_with_minimal_docs():
    """Single short doc still yields a winner among non-semantic strategies."""

    analyze = {
        "status": "complete",
        "corpus_summary": {"document_count": 1, "signals": {}},
        "chunking_recommendation": {
            "primary_strategy": "fixed-size",
            "alternate_strategies": ["recursive-character"],
            "suggested_parameters": {
                "strategyId": "fixed-size",
                "chunkSize": 256,
                "chunkOverlap": 0,
            },
        },
    }
    docs = [Document(page_content="alpha beta gamma. " * 30, metadata={})]
    payload = run_chunking_optimizer(
        analyze_payload=analyze,
        requirements={
            "chunking_sample_documents": [
                {"page_content": d.page_content, "metadata": {}} for d in docs
            ]
        },
    )
    assert payload["status"] == "complete"
