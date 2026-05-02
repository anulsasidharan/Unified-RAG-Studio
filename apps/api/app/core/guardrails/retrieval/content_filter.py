"""Policy-based filtering of retrieved document chunks — P4.5-4.

Removes chunks whose ``page_content`` matches configured blocked terms or regex
patterns (same composition model as :class:`ToxicityFilterGuardrail` on INPUT).

If every chunk is removed, the stage **BLOCK**s (nothing safe to pass to generation).
"""

from __future__ import annotations

import re
from typing import Any

from langchain_core.documents import Document

from app.core.guardrails.base import Guardrail
from app.core.guardrails.orchestrator import RetrievalGuardPayload
from app.core.guardrails.types import (
    GuardrailAction,
    GuardrailContext,
    GuardrailResult,
    GuardrailStage,
)

_SELF_TEST_PATTERN = re.compile(r"___RAG_STUDIO_RETRIEVAL_FILTER_SELF_TEST___")

_DEFAULT_EXTRA_PATTERNS: tuple[re.Pattern[str], ...] = (_SELF_TEST_PATTERN,)


def _compile_terms(terms: frozenset[str]) -> tuple[re.Pattern[str], ...]:
    out: list[re.Pattern[str]] = []
    for t in sorted(terms, key=len, reverse=True):
        if not t.strip():
            continue
        escaped = re.escape(t.strip())
        out.append(re.compile(rf"\b{escaped}\b", re.IGNORECASE))
    return tuple(out)


class RetrievedContentFilterGuardrail(Guardrail):
    """Drops retrieved documents that match blocked terms or extra patterns."""

    def __init__(
        self,
        *,
        blocked_terms: frozenset[str] | None = None,
        extra_patterns: tuple[re.Pattern[str], ...] | None = None,
        name: str = "retrieved-content-filter",
    ) -> None:
        self._name = name
        terms = blocked_terms if blocked_terms is not None else frozenset()
        self._term_patterns = _compile_terms(terms)
        self._extra = extra_patterns if extra_patterns is not None else _DEFAULT_EXTRA_PATTERNS

    @property
    def name(self) -> str:
        return self._name

    @property
    def stage(self) -> GuardrailStage:
        return GuardrailStage.RETRIEVAL

    def _matches_policy(self, text: str) -> bool:
        for pat in self._extra:
            if pat.search(text):
                return True
        for pat in self._term_patterns:
            if pat.search(text):
                return True
        return False

    def check(self, payload: Any, *, context: GuardrailContext | None = None) -> GuardrailResult:
        if not isinstance(payload, RetrievalGuardPayload):
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.ALLOW,
                metadata={"skipped": "wrong_payload_type"},
            )

        kept: list[Document] = []
        removed = 0
        for doc in payload.documents:
            text = doc.page_content or ""
            if self._matches_policy(text):
                removed += 1
            else:
                kept.append(doc)

        if not removed:
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.ALLOW,
                metadata={"documents_kept": len(kept)},
            )

        if not kept:
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.BLOCK,
                message="Retrieval blocked: all chunks matched content-filter policy",
                metadata={"removed": removed},
            )

        new_payload = RetrievalGuardPayload(
            query=payload.query,
            documents=tuple(kept),
        )
        return GuardrailResult(
            guardrail_name=self.name,
            stage=self.stage,
            action=GuardrailAction.MODIFY,
            message="Removed retrieved chunks matching content-filter policy",
            metadata={"removed": removed, "documents_kept": len(kept)},
            payload_override=new_payload,
        )
