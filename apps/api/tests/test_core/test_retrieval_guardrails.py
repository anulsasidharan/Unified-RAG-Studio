"""Tests for P4.5-4 retrieval guardrails (content filter, provenance, bias)."""

from __future__ import annotations

from langchain_core.documents import Document
import pytest

from app.core.guardrails import (
    GuardrailManager,
    GuardrailOrchestrator,
    RetrievalBiasHeuristicGuardrail,
    RetrievalGuardPayload,
    RetrievedContentFilterGuardrail,
    SourceProvenanceGuardrail,
    clear_retrieval_guardrails,
    register_default_retrieval_guardrails,
)
from app.core.guardrails.types import GuardrailStage


@pytest.fixture
def manager() -> GuardrailManager:
    m = GuardrailManager()
    clear_retrieval_guardrails(m)
    return m


def test_content_filter_self_test_blocks_all() -> None:
    g = RetrievedContentFilterGuardrail()
    payload = RetrievalGuardPayload.from_lists(
        "q",
        [Document(page_content="___RAG_STUDIO_RETRIEVAL_FILTER_SELF_TEST___")],
    )
    r = g.check(payload)
    assert r.action.value == "block"


def test_content_filter_modifies_when_partial_match() -> None:
    g = RetrievedContentFilterGuardrail(
        blocked_terms=frozenset({"badchunk"}),
        extra_patterns=(),
    )
    payload = RetrievalGuardPayload.from_lists(
        "q",
        [
            Document(page_content="clean text"),
            Document(page_content="has badchunk inside"),
        ],
    )
    r = g.check(payload)
    assert r.action.value == "modify"
    assert r.payload_override is not None
    assert len(r.payload_override.documents) == 1
    assert r.payload_override.documents[0].page_content == "clean text"


def test_source_provenance_drops_missing_key() -> None:
    g = SourceProvenanceGuardrail(required_metadata_keys=frozenset({"doc_id"}))
    payload = RetrievalGuardPayload.from_lists(
        "q",
        [
            Document(page_content="a", metadata={"doc_id": "1"}),
            Document(page_content="b", metadata={}),
        ],
    )
    r = g.check(payload)
    assert r.action.value == "modify"
    assert r.payload_override is not None
    assert len(r.payload_override.documents) == 1


def test_source_provenance_https_invalid() -> None:
    g = SourceProvenanceGuardrail(
        required_metadata_keys=frozenset(),
        require_https_source_url=True,
    )
    payload = RetrievalGuardPayload.from_lists(
        "q",
        [Document(page_content="x", metadata={"source_url": "http://insecure.example"})],
    )
    r = g.check(payload)
    assert r.action.value == "block"


def test_bias_warns_on_query_match() -> None:
    g = RetrievalBiasHeuristicGuardrail()
    payload = RetrievalGuardPayload.from_lists(
        "___RAG_STUDIO_RETRIEVAL_BIAS_SELF_TEST___",
        [Document(page_content="ok")],
    )
    r = g.check(payload)
    assert r.action.value == "warn"
    assert r.metadata.get("where") == "query"


def test_register_default_order_content_and_bias_only_without_source_rules(
    manager: GuardrailManager,
) -> None:
    register_default_retrieval_guardrails(manager, source_validation=True)
    names = [g.name for g in manager.guardrails_for(GuardrailStage.RETRIEVAL)]
    assert names == ["retrieved-content-filter", "retrieval-bias-heuristic"]


def test_register_default_includes_provenance_when_keys(manager: GuardrailManager) -> None:
    register_default_retrieval_guardrails(
        manager,
        source_required_keys=frozenset({"doc_id"}),
    )
    names = [g.name for g in manager.guardrails_for(GuardrailStage.RETRIEVAL)]
    assert names == [
        "retrieved-content-filter",
        "source-provenance",
        "retrieval-bias-heuristic",
    ]


def test_orchestrator_retrieval_chain(manager: GuardrailManager) -> None:
    register_default_retrieval_guardrails(
        manager,
        content_blocked_terms=frozenset({"dropme"}),
        content_extra_patterns=(),
        source_required_keys=frozenset({"doc_id"}),
    )
    orch = GuardrailOrchestrator(manager)
    payload = RetrievalGuardPayload.from_lists(
        "question",
        [
            Document(page_content="keep me", metadata={"doc_id": "a"}),
            Document(page_content="dropme here", metadata={"doc_id": "b"}),
        ],
    )
    r = orch.check_retrieval(payload)
    assert r.allowed is True
    assert len(r.final_payload.documents) == 1
    assert r.final_payload.documents[0].page_content == "keep me"


def test_schema_retrieval_stage_has_flags() -> None:
    from app.schemas import GuardrailsConfigSchema

    cfg = GuardrailsConfigSchema()
    assert cfg.retrieval.content_filter_enabled is True
    assert cfg.retrieval.source_validation_enabled is True
    assert cfg.retrieval.bias_detection_enabled is True
