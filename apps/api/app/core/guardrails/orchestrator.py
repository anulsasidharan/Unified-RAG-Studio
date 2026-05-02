"""Typed entry points for input, retrieval, and output guardrail runs — P4.5-1."""

from __future__ import annotations

from dataclasses import dataclass

from langchain_core.documents import Document

from .manager import GuardrailManager
from .types import GuardrailContext, GuardrailPipelineResult, GuardrailStage


@dataclass(frozen=True)
class RetrievalGuardPayload:
    """Payload shape for retrieval-stage checks (query + retrieved docs)."""

    query: str
    documents: tuple[Document, ...]

    @classmethod
    def from_lists(cls, query: str, documents: list[Document]) -> RetrievalGuardPayload:
        return cls(query=query, documents=tuple(documents))


class GuardrailOrchestrator:
    """High-level facade over :class:`GuardrailManager` with RAG-shaped payloads."""

    def __init__(self, manager: GuardrailManager | None = None) -> None:
        self._manager = manager or GuardrailManager()

    @property
    def manager(self) -> GuardrailManager:
        return self._manager

    def check_input(
        self,
        text: str,
        *,
        context: GuardrailContext | None = None,
    ) -> GuardrailPipelineResult:
        return self._manager.run_stage(GuardrailStage.INPUT, text, context=context)

    def check_retrieval(
        self,
        payload: RetrievalGuardPayload,
        *,
        context: GuardrailContext | None = None,
    ) -> GuardrailPipelineResult:
        return self._manager.run_stage(GuardrailStage.RETRIEVAL, payload, context=context)

    def check_output(
        self,
        text: str,
        *,
        context: GuardrailContext | None = None,
    ) -> GuardrailPipelineResult:
        return self._manager.run_stage(GuardrailStage.OUTPUT, text, context=context)
