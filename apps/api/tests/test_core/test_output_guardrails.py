"""Tests for P4.5-3 output guardrails (hallucination heuristic, factuality, citations)."""

from __future__ import annotations

import pytest

from app.core.guardrails import (
    CitationVerificationGuardrail,
    FactualityCheckGuardrail,
    GuardrailContext,
    GuardrailManager,
    GuardrailOrchestrator,
    HallucinationHeuristicGuardrail,
    GuardrailStage,
    clear_output_guardrails,
    register_default_output_guardrails,
)


@pytest.fixture
def manager() -> GuardrailManager:
    m = GuardrailManager()
    clear_output_guardrails(m)
    return m


def ctx_with_refs(*passages: str) -> GuardrailContext:
    return GuardrailContext(extra={"reference_texts": list(passages)})


def test_hallucination_skips_without_refs() -> None:
    g = HallucinationHeuristicGuardrail()
    r = g.check("anything here", context=None)
    assert r.action.value == "allow"
    assert r.metadata.get("skipped") == "no_reference_texts"


def test_hallucination_warns_when_ungrounded() -> None:
    g = HallucinationHeuristicGuardrail()
    ctx = ctx_with_refs("The meadow has alpha spiral patterns and beta grasses.")
    answer = (
        "voltmeter holograph zebrawood junkyard frigate quadrant "
        "pixelship monorail cobalt9 zebra42"
    )
    r = g.check(answer, context=ctx)
    assert r.action.value == "warn"
    assert "grounding_ratio" in r.metadata


def test_hallucination_allows_when_grounded() -> None:
    g = HallucinationHeuristicGuardrail()
    ctx = ctx_with_refs(
        "Paris is the capital of France. France is in Western Europe.",
    )
    answer = (
        "Paris is widely known as the capital of France "
        "in Western Europe metropolitan region geography"
    )
    r = g.check(answer, context=ctx)
    assert r.action.value == "allow"


def test_factuality_warns_numeric_not_in_refs() -> None:
    g = FactualityCheckGuardrail()
    ctx = ctx_with_refs("Revenue grew modestly in the third quarter narrative.")
    r = g.check(
        "The subsidiary reported EBITDA of approximately 982341 euros last year.",
        context=ctx,
    )
    assert r.action.value == "warn"
    assert r.metadata.get("count", 0) >= 1


def test_factuality_allows_when_number_in_refs() -> None:
    g = FactualityCheckGuardrail()
    ctx = ctx_with_refs(
        "Headcount reached 982341 applicants by December during the rollout.",
    )
    r = g.check(
        "As stated in the documents, applicant volume was 982341 by December.",
        context=ctx,
    )
    assert r.action.value == "allow"


def test_citation_blocks_out_of_range() -> None:
    g = CitationVerificationGuardrail()
    ctx = GuardrailContext(extra={"reference_texts": ["a", "b", "c"]})
    r = g.check("See detail in source [42] please.", context=ctx)
    assert r.action.value == "block"


def test_citation_allows_in_range() -> None:
    g = CitationVerificationGuardrail()
    ctx = GuardrailContext(extra={"reference_texts": ["a", "b", "c"]})
    r = g.check("Per [2] we conclude.", context=ctx)
    assert r.action.value == "allow"


def test_citation_warns_when_zero_sources_but_citations_present() -> None:
    g = CitationVerificationGuardrail()
    ctx = GuardrailContext(extra={"citation_source_count": 0})
    r = g.check("Evidence from [1] supports this.", context=ctx)
    assert r.action.value == "warn"


def test_register_default_order(manager: GuardrailManager) -> None:
    register_default_output_guardrails(manager)
    names = [g.name for g in manager.guardrails_for(GuardrailStage.OUTPUT)]
    assert names == ["hallucination-heuristic", "factuality-check", "citation-verification"]


def test_orchestrator_output_chain_blocks_on_citation(manager: GuardrailManager) -> None:
    register_default_output_guardrails(manager)
    orch = GuardrailOrchestrator(manager)
    ctx = GuardrailContext(
        extra={
            "reference_texts": [
                "Only one grounding sentence about cobalt.",
            ],
            "citation_source_count": 2,
        },
    )
    r = orch.check_output("Detail [99] cobalt zebrawood holograph quadrant.", context=ctx)
    assert r.allowed is False
    assert r.blocked_by == "citation-verification"


def test_schema_output_stage_has_flags() -> None:
    from app.schemas import GuardrailsConfigSchema

    cfg = GuardrailsConfigSchema()
    assert cfg.output.hallucination_heuristic_enabled is True
    assert cfg.output.factuality_check_enabled is True
    assert cfg.output.citation_verification_enabled is True
