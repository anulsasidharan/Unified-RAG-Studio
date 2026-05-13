"""P6-2 document analyst heuristics."""

from __future__ import annotations

import json

import pytest

from app.core.agents.document_analyst import (
    corpus_profiles_from_state,
    recommend_chunking,
)
from app.core.agents.tools import (
    document_corpus_analyze,
    recommend_chunking_from_summary_json,
    summarize_corpus_profiles_json,
)


def test_corpus_profiles_from_explicit_list():
    req = {"corpus_profiles": [{"file_type": "md", "char_count": 100}]}
    p = corpus_profiles_from_state(document_ids=["x"], requirements=req)
    assert len(p) == 1 and p[0]["file_type"] == "md"


def test_corpus_profiles_fallback_to_document_ids():
    p = corpus_profiles_from_state(document_ids=["a", "b"], requirements={})
    assert len(p) == 2
    assert all(x["file_type"] == "unknown" for x in p)


def test_recommend_markdown():
    summ = {
        "document_count": 2,
        "dominant_file_type": "md",
        "file_type_counts": {"md": 2},
        "signals": {"markdown_structure": True, "code_heavy": False, "tabular": False},
    }
    rec = recommend_chunking(summ, requirements={})
    assert rec["primary_strategy"] == "markdown-header"


def test_recommend_code():
    summ = {
        "document_count": 1,
        "dominant_file_type": "py",
        "file_type_counts": {"py": 1},
        "signals": {"markdown_structure": False, "code_heavy": True, "tabular": False},
    }
    rec = recommend_chunking(summ, requirements={})
    assert rec["primary_strategy"] == "code-aware"


def test_run_document_analyst_tool_roundtrip():
    out = document_corpus_analyze.invoke(
        {
            "document_ids_json": json.dumps(["d1"]),
            "requirements_json": json.dumps(
                {
                    "corpus_profiles": [{"file_type": "csv", "char_count": 4000}],
                    "optimize_for": "latency",
                },
            ),
        },
    )
    data = json.loads(out)
    assert data["status"] == "complete"
    assert data["chunking_recommendation"]["primary_strategy"] == "fixed-size"


def test_summarize_and_recommend_tools_chain():
    profiles = [
        {"file_type": "pdf", "char_count": 9000, "code_line_ratio": 0.01},
        {"file_type": "pdf", "char_count": 8000, "code_line_ratio": 0.0},
    ]
    s = json.loads(
        summarize_corpus_profiles_json.invoke(
            {
                "profiles_json": json.dumps(profiles),
                "requirements_json": json.dumps({"optimize_for": "quality"}),
            },
        ),
    )
    r = json.loads(
        recommend_chunking_from_summary_json.invoke(
            {
                "summary_json": json.dumps(s),
                "requirements_json": json.dumps({"optimize_for": "quality"}),
            },
        ),
    )
    assert r["primary_strategy"] == "semantic"


@pytest.mark.parametrize(
    "bad",
    [
        {"document_ids_json": "{", "requirements_json": "{}"},
        {"document_ids_json": "[]", "requirements_json": "["},
    ],
)
def test_document_corpus_analyze_invalid_json(bad: dict[str, str]):
    out = document_corpus_analyze.invoke(bad)
    assert "error" in json.loads(out)
