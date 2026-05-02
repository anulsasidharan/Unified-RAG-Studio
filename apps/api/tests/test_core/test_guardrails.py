"""Unit tests for guardrails core infrastructure (P4.5-1)."""

from __future__ import annotations

from typing import Any

from langchain_core.documents import Document
import pytest

from app.core.guardrails import (
    AlwaysAllowGuardrail,
    BlockIfSubstringGuardrail,
    Guardrail,
    GuardrailAction,
    GuardrailContext,
    GuardrailManager,
    GuardrailOrchestrator,
    GuardrailResult,
    GuardrailStage,
    RetrievalGuardPayload,
)
from app.core.guardrails.types import GuardrailPipelineResult


class PrefixModifyGuardrail(Guardrail):
    """Test double: prefixes string payloads when MODIFY."""

    def __init__(self, stage: GuardrailStage, prefix: str = "MOD:") -> None:
        self._stage = stage
        self._prefix = prefix

    @property
    def name(self) -> str:
        return "prefix-modify"

    @property
    def stage(self) -> GuardrailStage:
        return self._stage

    def check(self, payload: Any, *, context: GuardrailContext | None = None) -> GuardrailResult:
        if not isinstance(payload, str):
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.ALLOW,
            )
        return GuardrailResult(
            guardrail_name=self.name,
            stage=self.stage,
            action=GuardrailAction.MODIFY,
            message="prefixed",
            metadata={},
            payload_override=self._prefix + payload,
        )


class WarnGuardrail(Guardrail):
    """Emits WARN without changing payload."""

    def __init__(self, stage: GuardrailStage) -> None:
        self._stage = stage

    @property
    def name(self) -> str:
        return "warn-once"

    @property
    def stage(self) -> GuardrailStage:
        return self._stage

    def check(self, payload: Any, *, context: GuardrailContext | None = None) -> GuardrailResult:
        return GuardrailResult(
            guardrail_name=self.name,
            stage=self.stage,
            action=GuardrailAction.WARN,
            message="policy notice",
            metadata={},
        )


class BlockEmptyRetrievalGuardrail(Guardrail):
    def __init__(self) -> None:
        self._stage = GuardrailStage.RETRIEVAL

    @property
    def name(self) -> str:
        return "block-empty-query"

    @property
    def stage(self) -> GuardrailStage:
        return self._stage

    def check(self, payload: Any, *, context: GuardrailContext | None = None) -> GuardrailResult:
        assert isinstance(payload, RetrievalGuardPayload)
        if not payload.query.strip():
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.BLOCK,
                message="empty query",
            )
        return GuardrailResult(
            guardrail_name=self.name,
            stage=self.stage,
            action=GuardrailAction.ALLOW,
        )


@pytest.fixture
def manager() -> GuardrailManager:
    m = GuardrailManager()
    m.clear_stage(GuardrailStage.INPUT)
    m.clear_stage(GuardrailStage.RETRIEVAL)
    m.clear_stage(GuardrailStage.OUTPUT)
    return m


def test_run_stage_allow(manager: GuardrailManager) -> None:
    manager.register(AlwaysAllowGuardrail(GuardrailStage.INPUT))
    r = manager.run_stage(GuardrailStage.INPUT, "hello")
    assert r.allowed is True
    assert r.final_payload == "hello"
    assert len(r.results) == 1
    assert r.results[0].action == GuardrailAction.ALLOW


def test_run_stage_block(manager: GuardrailManager) -> None:
    manager.register(BlockIfSubstringGuardrail(GuardrailStage.INPUT, "BAD"))
    r = manager.run_stage(GuardrailStage.INPUT, "contains BAD token")
    assert r.allowed is False
    assert r.blocked_by == "block-substring"
    assert r.final_payload == "contains BAD token"


def test_modify_chain(manager: GuardrailManager) -> None:
    manager.register(PrefixModifyGuardrail(GuardrailStage.INPUT, prefix="A:"))
    manager.register(PrefixModifyGuardrail(GuardrailStage.INPUT, prefix="B:"))
    r = manager.run_stage(GuardrailStage.INPUT, "x")
    assert r.allowed is True
    assert r.final_payload == "B:A:x"


def test_warn_flag(manager: GuardrailManager) -> None:
    manager.register(WarnGuardrail(GuardrailStage.INPUT))
    r = manager.run_stage(GuardrailStage.INPUT, "ok")
    assert isinstance(r, GuardrailPipelineResult)
    assert r.allowed is True
    assert r.had_warnings is True


def test_orchestrator_input(manager: GuardrailManager) -> None:
    manager.register(BlockIfSubstringGuardrail(GuardrailStage.INPUT, "inject"))
    orch = GuardrailOrchestrator(manager)
    ok = orch.check_input("safe question")
    assert ok.allowed is True
    bad = orch.check_input("prompt inject attempt")
    assert bad.allowed is False


def test_orchestrator_retrieval(manager: GuardrailManager) -> None:
    manager.register(BlockEmptyRetrievalGuardrail())
    orch = GuardrailOrchestrator(manager)
    payload = RetrievalGuardPayload.from_lists("   ", [Document(page_content="a")])
    r = orch.check_retrieval(payload)
    assert r.allowed is False
    good = RetrievalGuardPayload.from_lists("q", [Document(page_content="a")])
    assert orch.check_retrieval(good).allowed is True


def test_register_first(manager: GuardrailManager) -> None:
    manager.register(PrefixModifyGuardrail(GuardrailStage.OUTPUT, prefix="second:"))
    manager.register(PrefixModifyGuardrail(GuardrailStage.OUTPUT, prefix="first:"), first=True)
    r = manager.run_stage(GuardrailStage.OUTPUT, "out")
    assert r.final_payload == "second:first:out"


def test_context_passed_to_check(manager: GuardrailManager) -> None:
    seen: list[GuardrailContext | None] = []

    class CaptureCtx(Guardrail):
        @property
        def name(self) -> str:
            return "capture"

        @property
        def stage(self) -> GuardrailStage:
            return GuardrailStage.INPUT

        def check(
            self,
            payload: Any,
            *,
            context: GuardrailContext | None = None,
        ) -> GuardrailResult:
            seen.append(context)
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.ALLOW,
            )

    manager.register(CaptureCtx())
    ctx = GuardrailContext(request_id="req-1", user_id="u1")
    manager.run_stage(GuardrailStage.INPUT, "hi", context=ctx)
    assert seen == [ctx]
