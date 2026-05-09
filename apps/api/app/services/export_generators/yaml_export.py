"""YAML serialisation — mirrors ``yamlGenerator.ts``."""

from __future__ import annotations

from datetime import UTC, datetime
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.schemas.pipeline import PipelineConfigurationSchema, PipelineStagesSchema

from app.services.export_generators._compat import ev


def _indent(level: int) -> str:
    return "  " * level


def _yaml_string(value: str | None) -> str:
    if not value:
        return '""'
    if re.search(r"[:#\[\]{},|>&*!,]", value) or "\n" in value:
        return '"' + value.replace('"', '\\"') + '"'
    return value


def _yaml_bool(value: bool) -> str:
    return "true" if value else "false"


def _yaml_array(items: list[str], lvl: int) -> str:
    if not items:
        return "[]"
    return "\n" + "\n".join(f"{_indent(lvl)}- {_yaml_string(item)}" for item in items)


def generate_yaml(config: PipelineConfigurationSchema, generated_at: str | None = None) -> str:
    now = generated_at or (
        datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    )
    stages = config.stages
    md = config.metadata
    desc_line = (
        f"  description: {_yaml_string(config.description)}"
        if config.description
        else '  description: ""'
    )
    updated = (
        f"    updatedAt: {_yaml_string(md.updated_at)}"
        if md.updated_at
        else ""
    )
    source_line = f"    source: {_yaml_string(md.source)}" if md.source else ""

    sections: list[str] = [
        "# RAG Studio — Pipeline Configuration",
        f"# Generated: {now}",
        f"# Version: {md.version}",
        "",
        "pipeline:",
        f"  id: {_yaml_string(config.id)}",
        f"  name: {_yaml_string(config.name)}",
        desc_line,
        f"  cloudProvider: {_yaml_string(ev(config.cloud_provider))}",
        "",
        "  metadata:",
        f"    createdAt: {_yaml_string(md.created_at)}",
    ]
    if updated:
        sections.append(updated)
    sections.extend(
        [
            f"    version: {_yaml_string(md.version)}",
        ]
    )
    if source_line:
        sections.append(source_line)
    sections.extend(
        [
            "",
            "  stages:",
            _ingestion_section(stages, 2),
            _chunking_section(stages, 2),
            _embedding_section(stages, 2),
            _vector_store_section(stages, 2),
            _retrieval_section(stages, 2),
            _reranking_section(stages, 2),
            _generation_section(stages, 2),
            _routing_section(stages, 2),
            _memory_section(stages, 2),
            _evaluation_section(stages, 2),
            _human_in_the_loop_section(stages, 2),
        ]
    )
    return "\n".join(s for s in sections if s != "")


def _ingestion_section(stages: PipelineStagesSchema, lvl: int) -> str:
    di = stages.data_ingestion
    if not di:
        return f"{_indent(lvl)}dataIngestion: ~"
    pre = di.preprocessing
    meta = di.metadata
    return "\n".join(
        [
            f"{_indent(lvl)}dataIngestion:",
            f"{_indent(lvl + 1)}sourceType: {_yaml_string(di.source_type)}",
            f"{_indent(lvl + 1)}fileTypes: {_yaml_array(di.file_types, lvl + 2)}",
            f"{_indent(lvl + 1)}preprocessing:",
            f"{_indent(lvl + 2)}stripHtml: {_yaml_bool(pre.strip_html)}",
            f"{_indent(lvl + 2)}normalizeWhitespace: {_yaml_bool(pre.normalize_whitespace)}",
            f"{_indent(lvl + 2)}extractMetadata: {_yaml_bool(pre.extract_metadata)}",
            f"{_indent(lvl + 1)}metadata:",
            f"{_indent(lvl + 2)}includeSource: {_yaml_bool(meta.include_source)}",
            f"{_indent(lvl + 2)}includePageNumber: {_yaml_bool(meta.include_page_number)}",
        ]
    )


def _chunking_section(stages: PipelineStagesSchema, lvl: int) -> str:
    c = stages.chunking
    lines = [
        f"{_indent(lvl)}chunking:",
        f"{_indent(lvl + 1)}strategy: {_yaml_string(ev(c.strategy))}",
        f"{_indent(lvl + 1)}chunkSize: {c.chunk_size}",
        f"{_indent(lvl + 1)}chunkOverlap: {c.chunk_overlap}",
    ]
    if c.separators:
        lines.append(f"{_indent(lvl + 1)}separators: {_yaml_array(c.separators, lvl + 2)}")
    return "\n".join(lines)


def _embedding_section(stages: PipelineStagesSchema, lvl: int) -> str:
    e = stages.embedding
    lines = [
        f"{_indent(lvl)}embedding:",
        f"{_indent(lvl + 1)}model: {_yaml_string(e.model)}",
        f"{_indent(lvl + 1)}provider: {_yaml_string(ev(e.provider))}",
        f"{_indent(lvl + 1)}dimensions: {e.dimensions}",
    ]
    if e.batch_size is not None:
        lines.append(f"{_indent(lvl + 1)}batchSize: {e.batch_size}")
    if e.max_tokens is not None:
        lines.append(f"{_indent(lvl + 1)}maxTokens: {e.max_tokens}")
    return "\n".join(lines)


def _vector_store_section(stages: PipelineStagesSchema, lvl: int) -> str:
    vs = stages.vector_store
    cfg = vs.configuration
    lines = [
        f"{_indent(lvl)}vectorStore:",
        f"{_indent(lvl + 1)}provider: {_yaml_string(ev(vs.provider))}",
        f"{_indent(lvl + 1)}indexName: {_yaml_string(vs.index_name)}",
        f"{_indent(lvl + 1)}configuration:",
    ]
    if cfg.metric:
        lines.append(f"{_indent(lvl + 2)}metric: {_yaml_string(ev(cfg.metric))}")
    if cfg.replicas is not None:
        lines.append(f"{_indent(lvl + 2)}replicas: {cfg.replicas}")
    if cfg.shards is not None:
        lines.append(f"{_indent(lvl + 2)}shards: {cfg.shards}")
    if cfg.namespace:
        lines.append(f"{_indent(lvl + 2)}namespace: {_yaml_string(cfg.namespace)}")
    if cfg.cloud:
        lines.append(f"{_indent(lvl + 2)}cloud:")
        lines.append(f"{_indent(lvl + 3)}region: {_yaml_string(cfg.cloud.region)}")
        if cfg.cloud.instance_type:
            lines.append(
                f"{_indent(lvl + 3)}instanceType: {_yaml_string(cfg.cloud.instance_type)}"
            )
    return "\n".join(lines)


def _retrieval_section(stages: PipelineStagesSchema, lvl: int) -> str:
    r = stages.retrieval
    lines = [
        f"{_indent(lvl)}retrieval:",
        f"{_indent(lvl + 1)}strategy: {_yaml_string(ev(r.strategy))}",
        f"{_indent(lvl + 1)}topK: {r.top_k}",
    ]
    if r.score_threshold is not None:
        lines.append(f"{_indent(lvl + 1)}scoreThreshold: {r.score_threshold}")
    if r.hybrid_search:
        lines.append(f"{_indent(lvl + 1)}hybridSearch:")
        lines.append(f"{_indent(lvl + 2)}alpha: {r.hybrid_search.alpha}")
    if r.parent_child_config:
        lines.append(f"{_indent(lvl + 1)}parentChildConfig:")
        lines.append(
            f"{_indent(lvl + 2)}parentChunkSize: {r.parent_child_config.parent_chunk_size}"
        )
        lines.append(
            f"{_indent(lvl + 2)}childChunkSize: {r.parent_child_config.child_chunk_size}"
        )
    if r.multi_query_config:
        lines.append(f"{_indent(lvl + 1)}multiQueryConfig:")
        lines.append(f"{_indent(lvl + 2)}numVariants: {r.multi_query_config.num_variants}")
        lines.append(
            f"{_indent(lvl + 2)}llmModel: {_yaml_string(r.multi_query_config.llm_model)}"
        )
    return "\n".join(lines)


def _reranking_section(stages: PipelineStagesSchema, lvl: int) -> str:
    rr = stages.reranking
    if not rr:
        return f"{_indent(lvl)}reranking:\n{_indent(lvl + 1)}enabled: false"
    lines = [
        f"{_indent(lvl)}reranking:",
        f"{_indent(lvl + 1)}enabled: {_yaml_bool(rr.enabled)}",
    ]
    if rr.enabled:
        if rr.model:
            lines.append(f"{_indent(lvl + 1)}model: {_yaml_string(rr.model)}")
        if rr.top_n is not None:
            lines.append(f"{_indent(lvl + 1)}topN: {rr.top_n}")
        if rr.provider:
            lines.append(f"{_indent(lvl + 1)}provider: {_yaml_string(rr.provider)}")
    return "\n".join(lines)


def _generation_section(stages: PipelineStagesSchema, lvl: int) -> str:
    g = stages.generation
    lines = [
        f"{_indent(lvl)}generation:",
        f"{_indent(lvl + 1)}model: {_yaml_string(g.model)}",
        f"{_indent(lvl + 1)}provider: {_yaml_string(ev(g.provider))}",
        f"{_indent(lvl + 1)}temperature: {g.temperature}",
        f"{_indent(lvl + 1)}maxTokens: {g.max_tokens}",
    ]
    if g.top_p is not None:
        lines.append(f"{_indent(lvl + 1)}topP: {g.top_p}")
    if g.output_format:
        lines.append(f"{_indent(lvl + 1)}outputFormat: {_yaml_string(ev(g.output_format))}")
    if g.system_prompt:
        lines.append(f"{_indent(lvl + 1)}systemPrompt: |")
        for line in g.system_prompt.split("\n"):
            lines.append(f"{_indent(lvl + 2)}{line}")
    return "\n".join(lines)


def _routing_section(stages: PipelineStagesSchema, lvl: int) -> str:
    rt = stages.routing
    if not rt:
        return f"{_indent(lvl)}routing:\n{_indent(lvl + 1)}enabled: false"
    lines = [
        f"{_indent(lvl)}routing:",
        f"{_indent(lvl + 1)}enabled: {_yaml_bool(rt.enabled)}",
    ]
    if rt.default_model:
        lines.append(f"{_indent(lvl + 1)}defaultModel: {_yaml_string(rt.default_model)}")
    if rt.rules:
        lines.append(f"{_indent(lvl + 1)}rules:")
        for rule in rt.rules:
            lines.append(f"{_indent(lvl + 2)}- condition: {_yaml_string(rule.condition)}")
            if rule.threshold is not None:
                lines.append(f"{_indent(lvl + 3)}threshold: {rule.threshold}")
            if rule.keywords:
                lines.append(f"{_indent(lvl + 3)}keywords: {_yaml_array(rule.keywords, lvl + 4)}")
            lines.append(f"{_indent(lvl + 3)}targetModel: {_yaml_string(rule.target_model)}")
    return "\n".join(lines)


def _memory_section(stages: PipelineStagesSchema, lvl: int) -> str:
    m = stages.memory
    if not m:
        return f"{_indent(lvl)}memory:\n{_indent(lvl + 1)}type: none"
    lines = [
        f"{_indent(lvl)}memory:",
        f"{_indent(lvl + 1)}type: {_yaml_string(ev(m.type))}",
    ]
    if m.window_size is not None:
        lines.append(f"{_indent(lvl + 1)}windowSize: {m.window_size}")
    if m.max_tokens is not None:
        lines.append(f"{_indent(lvl + 1)}maxTokens: {m.max_tokens}")
    if m.session_persistence is not None:
        lines.append(
            f"{_indent(lvl + 1)}sessionPersistence: {_yaml_bool(m.session_persistence)}"
        )
    return "\n".join(lines)


def _evaluation_section(stages: PipelineStagesSchema, lvl: int) -> str:
    ev = stages.evaluation
    if not ev:
        return f"{_indent(lvl)}evaluation:\n{_indent(lvl + 1)}enabled: false"
    lines = [
        f"{_indent(lvl)}evaluation:",
        f"{_indent(lvl + 1)}enabled: {_yaml_bool(ev.enabled)}",
    ]
    if ev.enabled:
        if ev.metrics:
            lines.append(
                f"{_indent(lvl + 1)}metrics: {_yaml_array([str(m) for m in ev.metrics], lvl + 2)}"
            )
        if ev.test_set_size is not None:
            lines.append(f"{_indent(lvl + 1)}testSetSize: {ev.test_set_size}")
        if ev.schedule:
            lines.append(f"{_indent(lvl + 1)}schedule: {_yaml_string(ev.schedule)}")
    return "\n".join(lines)


def _human_in_the_loop_section(stages: PipelineStagesSchema, lvl: int) -> str:
    h = stages.human_in_the_loop
    if not h:
        return f"{_indent(lvl)}humanInTheLoop:\n{_indent(lvl + 1)}enabled: false"
    p = h.placement
    c = h.confidence
    w = h.workflow
    a = h.advanced
    lines = [
        f"{_indent(lvl)}humanInTheLoop:",
        f"{_indent(lvl + 1)}enabled: {_yaml_bool(h.enabled)}",
        f"{_indent(lvl + 1)}tier: {_yaml_string(h.tier)}",
        f"{_indent(lvl + 1)}roles: {_yaml_array([str(r) for r in h.roles], lvl + 2)}",
        f"{_indent(lvl + 1)}placement:",
        f"{_indent(lvl + 2)}preIngestionValidation: {_yaml_bool(p.pre_ingestion_validation)}",
        f"{_indent(lvl + 2)}retrievalTime: {_yaml_bool(p.retrieval_time)}",
        f"{_indent(lvl + 2)}generationTime: {_yaml_bool(p.generation_time)}",
        f"{_indent(lvl + 2)}postResponseFeedback: {_yaml_bool(p.post_response_feedback)}",
    ]
    if not h.enabled:
        return "\n".join(lines)
    lines.extend(
        [
            f"{_indent(lvl + 1)}confidence:",
            f"{_indent(lvl + 2)}retrieverScoreThreshold: "
            f"{c.retriever_score_threshold if c.retriever_score_threshold is not None else 'null'}",
            f"{_indent(lvl + 2)}rerankerScoreThreshold: "
            f"{c.reranker_score_threshold if c.reranker_score_threshold is not None else 'null'}",
            f"{_indent(lvl + 2)}llmUncertaintySignals: {_yaml_bool(c.llm_uncertainty_signals)}",
            f"{_indent(lvl + 2)}escalationMode: {_yaml_string(c.escalation_mode)}",
            f"{_indent(lvl + 1)}workflow:",
            f"{_indent(lvl + 2)}synchronousReview: {_yaml_bool(w.synchronous_review)}",
            f"{_indent(lvl + 2)}allowHumanEdit: {_yaml_bool(w.allow_human_edit)}",
            f"{_indent(lvl + 2)}sequentialApprovalRoles: "
            f"{_yaml_array([str(r) for r in w.sequential_approval_roles], lvl + 3)}",
            f"{_indent(lvl + 1)}advanced:",
            f"{_indent(lvl + 2)}orchestrationHint: "
            f"{_yaml_string(a.orchestration_hint) if a.orchestration_hint else 'null'}",
            f"{_indent(lvl + 2)}agenticToolApproval: {_yaml_bool(a.agentic_tool_approval)}",
            f"{_indent(lvl + 2)}multiReviewerConsensus: {_yaml_bool(a.multi_reviewer_consensus)}",
            f"{_indent(lvl + 2)}auditLoggingRequired: {_yaml_bool(a.audit_logging_required)}",
            f"{_indent(lvl + 2)}humanGuidedRetrieval: {_yaml_bool(a.human_guided_retrieval)}",
            f"{_indent(lvl + 2)}activeLearningFeedback: {_yaml_bool(a.active_learning_feedback)}",
        ]
    )
    return "\n".join(lines)
