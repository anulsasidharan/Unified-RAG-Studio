"""Chain INPUT → RETRIEVAL → generation → OUTPUT guardrails — P4.5-5."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from langchain_core.documents import Document

from app.core.generation import GenerationResult, GenerationService, generation_runtime_from_pipeline
from app.core.guardrails.configure_manager import build_guardrail_manager
from app.core.guardrails.orchestrator import GuardrailOrchestrator, RetrievalGuardPayload
from app.core.guardrails.types import GuardrailContext, GuardrailPipelineResult, GuardrailStage
from app.core.vectorstore.strategies import ScoredDoc
from app.schemas.guardrails import GuardrailsConfigSchema
from app.schemas.pipeline import GenerationConfigSchema, PipelineConfigurationSchema


def _reference_bundle(documents: Sequence[Document]) -> dict[str, object]:
    texts = [d.page_content or "" for d in documents if (d.page_content or "").strip()]
    return {
        "reference_texts": texts,
        "citation_source_count": len(texts),
    }


@dataclass(frozen=True)
class GuardedRAGOutcome:
    """Result of a guarded RAG call (preview or internal orchestration)."""

    allowed: bool
    blocked_stage: GuardrailStage | None
    blocked_by: str | None
    query_used: str
    documents_used: tuple[Document, ...]
    generation: GenerationResult | None
    input_result: GuardrailPipelineResult | None
    retrieval_result: GuardrailPipelineResult | None
    output_result: GuardrailPipelineResult | None


def _final_query_string(payload: object) -> str:
    if isinstance(payload, str):
        return payload
    return str(payload)


def _final_documents(payload: object) -> tuple[Document, ...]:
    if isinstance(payload, RetrievalGuardPayload):
        return tuple(payload.documents)
    return ()


async def run_guarded_rag_query(
    *,
    query: str,
    context_documents: Sequence[Document | ScoredDoc],
    pipeline: PipelineConfigurationSchema,
    generation_service: GenerationService | None = None,
    guardrails: GuardrailsConfigSchema | None = None,
    guardrail_context: GuardrailContext | None = None,
    conversation: list[tuple[str, str]] | None = None,
) -> GuardedRAGOutcome:
    """Run the full guarded path: input → retrieval stage on payload → LLM → output.

    *context_documents* are treated as retrieved chunks (same shape as
    :meth:`GenerationService.generate`). Retrieval-stage guardrails filter or block
    on the query + documents tuple.

    When a stage **BLOCK**s, later stages are skipped. Model output is **not**
    returned when OUTPUT stage blocks (unsafe text is omitted).
    """
    policy = guardrails if guardrails is not None else pipeline.guardrails
    manager = build_guardrail_manager(policy)
    orch = GuardrailOrchestrator(manager)
    ctx_base = guardrail_context or GuardrailContext(
        pipeline_config_id=pipeline.id,
        extra={},
    )

    # Normalize to plain Documents for downstream
    norm_docs: list[Document] = []
    for item in context_documents:
        if isinstance(item, ScoredDoc):
            norm_docs.append(item.document)
        else:
            norm_docs.append(item)

    input_res = orch.check_input(query, context=ctx_base)
    if not input_res.allowed:
        return GuardedRAGOutcome(
            allowed=False,
            blocked_stage=GuardrailStage.INPUT,
            blocked_by=input_res.blocked_by,
            query_used=query,
            documents_used=tuple(norm_docs),
            generation=None,
            input_result=input_res,
            retrieval_result=None,
            output_result=None,
        )

    q_after = _final_query_string(input_res.final_payload)
    payload = RetrievalGuardPayload.from_lists(q_after, norm_docs)
    retr_res = orch.check_retrieval(payload, context=ctx_base)
    if not retr_res.allowed:
        return GuardedRAGOutcome(
            allowed=False,
            blocked_stage=GuardrailStage.RETRIEVAL,
            blocked_by=retr_res.blocked_by,
            query_used=q_after,
            documents_used=_final_documents(retr_res.final_payload),
            generation=None,
            input_result=input_res,
            retrieval_result=retr_res,
            output_result=None,
        )

    docs_after = _final_documents(retr_res.final_payload)
    gen_cfg: GenerationConfigSchema = pipeline.stages.generation
    runtime = generation_runtime_from_pipeline(gen_cfg)
    svc = generation_service or GenerationService()
    gen_out = await svc.generate(
        q_after,
        list(docs_after),
        runtime,
        conversation=conversation,
    )

    extra = dict(ctx_base.extra or {})
    extra.update(_reference_bundle(docs_after))
    out_ctx = GuardrailContext(
        request_id=ctx_base.request_id,
        user_id=ctx_base.user_id,
        pipeline_config_id=ctx_base.pipeline_config_id,
        project_id=ctx_base.project_id,
        extra=extra,
    )
    out_res = orch.check_output(gen_out.text, context=out_ctx)
    if not out_res.allowed:
        return GuardedRAGOutcome(
            allowed=False,
            blocked_stage=GuardrailStage.OUTPUT,
            blocked_by=out_res.blocked_by,
            query_used=q_after,
            documents_used=docs_after,
            generation=None,
            input_result=input_res,
            retrieval_result=retr_res,
            output_result=out_res,
        )

    final_text = _final_query_string(out_res.final_payload)
    safe_result = GenerationResult(
        text=final_text,
        model=gen_out.model,
        provider=gen_out.provider,
        finish_reason=gen_out.finish_reason,
        usage=gen_out.usage,
    )
    return GuardedRAGOutcome(
        allowed=True,
        blocked_stage=None,
        blocked_by=None,
        query_used=q_after,
        documents_used=docs_after,
        generation=safe_result,
        input_result=input_res,
        retrieval_result=retr_res,
        output_result=out_res,
    )
