"""Unit tests for P9-1 MLflow Autopilot tracking."""

from __future__ import annotations

import sys
from unittest.mock import MagicMock

import pytest

from app.services import mlflow_tracking


def test_log_autopilot_skips_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MLFLOW_ENABLED", "false")
    from app.config import get_settings

    get_settings.cache_clear()
    try:
        mlflow_tracking.log_autopilot_build_to_mlflow(
            build_id="00000000-0000-4000-8000-000000000099",
            project_id="00000000-0000-4000-8000-000000000088",
            requirements={"optimize_for": "quality"},
            stage_outputs={"evaluation": {"status": "complete", "metrics": {"faithfulness": 0.9}}},
            iteration=2,
            build_status="complete",
        )
    finally:
        get_settings.cache_clear()


def test_log_autopilot_swallows_tracking_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MLFLOW_ENABLED", "true")
    from app.config import get_settings

    get_settings.cache_clear()
    mock_ml = MagicMock()
    mock_ml.set_tracking_uri = MagicMock()
    mock_ml.set_experiment.side_effect = OSError("no server")
    old = sys.modules.get("mlflow")
    sys.modules["mlflow"] = mock_ml
    try:
        mlflow_tracking.log_autopilot_build_to_mlflow(
            build_id="00000000-0000-4000-8000-000000000099",
            project_id="00000000-0000-4000-8000-000000000088",
            requirements={},
            stage_outputs={},
            iteration=1,
            build_status="failed",
            error_message="graph boom",
        )
    finally:
        if old is None:
            del sys.modules["mlflow"]
        else:
            sys.modules["mlflow"] = old
        get_settings.cache_clear()


def test_collect_metrics_from_stage_outputs() -> None:
    so = {
        "evaluation": {
            "metrics": {
                "faithfulness": 0.8,
                "answer_relevance": 0.7,
                "context_precision": 0.6,
                "avg_latency_ms": 120.0,
            },
            "meets_targets": True,
        },
        "deployment": {"status": "complete"},
        "embedding": {
            "candidates_tried": [
                {"composite_score": 0.5, "avg_latency_ms": 10.0, "error": None},
                {"error": "skip"},
            ],
        },
    }
    m = mlflow_tracking._collect_metrics(so)
    assert m["eval.faithfulness"] == 0.8
    assert m["eval.meets_targets"] == 1.0
    assert m["deployment.complete"] == 1.0
    assert m["embedding.cand_0.composite_score"] == 0.5
