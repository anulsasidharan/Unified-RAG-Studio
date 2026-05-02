"""Guarded RAG preview — shared by Designer and utilities routes (P4.5-5)."""

from __future__ import annotations

import uuid

from app.core.guardrails.types import GuardrailContext, GuardrailPipelineResult, GuardrailStage
from app.core.rag import run_guarded_rag_query
from app.schemas.designer import GuardrailCheckSummary, RagPreviewRequest, RagPreviewResponse


def _summarize(pr: GuardrailPipelineResult | None) -> list[GuardrailCheckSummary]:
    if pr is None:
        return []
    return [
        GuardrailCheckSummary(
            guardrail_name=r.guardrail_name,
            stage=r.stage.value,
            action=r.action.value,
            message=r.message,
        )
        for r in pr.results
    ]


def _any_warnings(*results: GuardrailPipelineResult | None) -> bool:
    for pr in results:
        if pr is not None and pr.had_warnings:
            return True
    return False


def _blocked_stage_literal(stage: GuardrailStage | None) -> str | None:
    if stage is None:
        return None
    v = stage.value
    if v in ("input", "retrieval", "output"):
        return v
    return v


async def run_rag_preview(req: RagPreviewRequest) -> RagPreviewResponse:
    """Execute INPUT → RETRIEVAL → generation → OUTPUT for one preview query."""
    docs = [d.to_document() for d in req.context_documents]
    rid = str(uuid.uuid4())
    ctx = GuardrailContext(request_id=rid, extra={})
    out = await run_guarded_rag_query(
        query=req.query,
        context_documents=docs,
        pipeline=req.config,
        guardrail_context=ctx,
        conversation=req.conversation,
    )
    gen = out.generation
    return RagPreviewResponse(
        allowed=out.allowed,
        blocked_stage=_blocked_stage_literal(out.blocked_stage),
        blocked_by=out.blocked_by,
        query_used=out.query_used,
        answer=gen.text if gen else None,
        model=gen.model if gen else None,
        provider=gen.provider if gen else None,
        input_checks=_summarize(out.input_result),
        retrieval_checks=_summarize(out.retrieval_result),
        output_checks=_summarize(out.output_result),
        had_warnings=_any_warnings(out.input_result, out.retrieval_result, out.output_result),
    )
