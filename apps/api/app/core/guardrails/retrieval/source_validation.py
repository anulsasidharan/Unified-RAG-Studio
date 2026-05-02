"""Document metadata / provenance checks for retrieved chunks — P4.5-4.

Drops chunks that do not satisfy metadata requirements (non-empty string values for
each configured key). Optional ``source_url`` validation: when enabled, if the key
is present it must be an ``https://`` URL.

When ``required_metadata_keys`` is empty, the guardrail **ALLOW**s without changes
(useful until ingestion populates metadata consistently).
"""

from __future__ import annotations

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


def _is_nonempty_str(v: object) -> bool:
    return isinstance(v, str) and bool(v.strip())


class SourceProvenanceGuardrail(Guardrail):
    """Keeps only chunks with required metadata (and optional https source_url)."""

    def __init__(
        self,
        *,
        required_metadata_keys: frozenset[str] = frozenset(),
        require_https_source_url: bool = False,
        name: str = "source-provenance",
    ) -> None:
        self._name = name
        self._required = required_metadata_keys
        self._require_https = require_https_source_url

    @property
    def name(self) -> str:
        return self._name

    @property
    def stage(self) -> GuardrailStage:
        return GuardrailStage.RETRIEVAL

    def _doc_valid(self, doc: Document) -> bool:
        meta = doc.metadata or {}
        for key in self._required:
            if not _is_nonempty_str(meta.get(key)):
                return False
        if self._require_https and "source_url" in meta:
            url = meta.get("source_url")
            if url is not None and str(url).strip():
                s = str(url).strip()
                if not s.lower().startswith("https://"):
                    return False
        return True

    def check(self, payload: Any, *, context: GuardrailContext | None = None) -> GuardrailResult:
        if not isinstance(payload, RetrievalGuardPayload):
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.ALLOW,
                metadata={"skipped": "wrong_payload_type"},
            )

        if not self._required and not self._require_https:
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.ALLOW,
                metadata={"skipped": "no_requirements_configured"},
            )

        kept = [d for d in payload.documents if self._doc_valid(d)]
        removed = len(payload.documents) - len(kept)

        if removed == 0:
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
                message="Retrieval blocked: no chunks passed source provenance checks",
                metadata={"removed": removed, "required_keys": sorted(self._required)},
            )

        new_payload = RetrievalGuardPayload(query=payload.query, documents=tuple(kept))
        return GuardrailResult(
            guardrail_name=self.name,
            stage=self.stage,
            action=GuardrailAction.MODIFY,
            message="Dropped chunks failing source provenance checks",
            metadata={"removed": removed, "documents_kept": len(kept)},
            payload_override=new_payload,
        )
