"""Unit tests for evaluation service helpers (P10-1)."""

from __future__ import annotations

import uuid

import pytest

from app.schemas.evaluation import EvaluationRunRequest, TestSetEntry
from app.services.evaluation_service import _resolve_test_entries, _synthetic_test_entries


@pytest.mark.unit
def test_resolve_test_entries_rejects_empty_explicit_list() -> None:
    body = EvaluationRunRequest(
        config_id=str(uuid.uuid4()),
        test_set=[],
    )
    with pytest.raises(ValueError, match="non-empty"):
        _resolve_test_entries(body)


@pytest.mark.unit
def test_resolve_test_entries_uses_provided_test_set() -> None:
    body = EvaluationRunRequest(
        config_id=str(uuid.uuid4()),
        test_set=[
            TestSetEntry(question="Q1", ground_truth="A1"),
            TestSetEntry(question="Q2", ground_truth="A2"),
        ],
    )
    out = _resolve_test_entries(body)
    assert len(out) == 2
    assert out[0].question == "Q1"


@pytest.mark.unit
def test_synthetic_test_entries_respects_bounds() -> None:
    small = _synthetic_test_entries(10)
    assert len(small) == 10
    large = _synthetic_test_entries(500)
    assert len(large) == 500
