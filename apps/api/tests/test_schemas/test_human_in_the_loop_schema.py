"""Human-in-the-loop pipeline schema accepts designer JSON (camelCase aliases)."""

from __future__ import annotations

from app.schemas.pipeline import HumanInTheLoopConfigSchema


def test_hitl_defaults_and_aliases() -> None:
    payload = {
        "enabled": True,
        "tier": "medium",
        "roles": ["reviewer", "approver"],
        "placement": {
            "preIngestionValidation": True,
            "retrievalTime": True,
            "generationTime": True,
            "postResponseFeedback": False,
        },
        "confidence": {
            "retrieverScoreThreshold": 0.72,
            "rerankerScoreThreshold": None,
            "llmUncertaintySignals": True,
            "escalationMode": "deferred_queue",
        },
        "workflow": {
            "synchronousReview": False,
            "allowHumanEdit": True,
            "sequentialApprovalRoles": ["reviewer", "approver"],
        },
        "advanced": {
            "orchestrationHint": "langgraph",
            "agenticToolApproval": True,
            "multiReviewerConsensus": False,
            "auditLoggingRequired": True,
            "humanGuidedRetrieval": False,
            "activeLearningFeedback": True,
        },
    }
    h = HumanInTheLoopConfigSchema.model_validate(payload)
    assert h.enabled is True
    assert h.placement.pre_ingestion_validation is True
    assert h.confidence.retriever_score_threshold == 0.72
    assert h.workflow.sequential_approval_roles == ["reviewer", "approver"]
    assert h.advanced.orchestration_hint == "langgraph"
