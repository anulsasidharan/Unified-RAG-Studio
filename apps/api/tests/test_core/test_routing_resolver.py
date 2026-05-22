"""Routing resolver — model selection from pipeline rules."""

from __future__ import annotations

from app.core.routing import generation_with_routing
from app.schemas.pipeline import (
    ChunkingConfigSchema,
    EmbeddingConfigSchema,
    GenerationConfigSchema,
    PipelineConfigurationSchema,
    PipelineMetadataSchema,
    PipelineStagesSchema,
    RetrievalConfigSchema,
    RoutingConfigSchema,
    RoutingRuleSchema,
    VectorStoreConfigSchema,
)


def test_routing_keyword_selects_target_model() -> None:
    routing = RoutingConfigSchema(
        enabled=True,
        default_model="gpt-4o-mini",
        rules=[
            RoutingRuleSchema(condition="keyword", keywords=["refund"], target_model="gpt-4o"),
        ],
    )
    p = PipelineConfigurationSchema(
        id="p1",
        name="t",
        cloud_provider="aws",
        stages=PipelineStagesSchema(
            chunking=ChunkingConfigSchema(
                strategy="recursive-character", chunk_size=512, chunk_overlap=50
            ),
            embedding=EmbeddingConfigSchema(
                model="text-embedding-3-small", provider="openai", dimensions=1536
            ),
            vector_store=VectorStoreConfigSchema(provider="qdrant", index_name="kb"),
            retrieval=RetrievalConfigSchema(strategy="similarity", top_k=5),
            generation=GenerationConfigSchema(
                model="gpt-4o-mini",
                provider="openai",
                temperature=0.1,
                max_tokens=1024,
            ),
            routing=routing,
        ),
        metadata=PipelineMetadataSchema(created_at="2026-01-01T00:00:00Z"),
    )
    out = generation_with_routing(p, "I need a refund please")
    assert out.model == "gpt-4o"


def test_routing_fallback_default_model() -> None:
    routing = RoutingConfigSchema(
        enabled=True,
        default_model="gpt-4o",
        rules=[
            RoutingRuleSchema(
                condition="keyword", keywords=["zzzznotfound"], target_model="gpt-4o-mini"
            ),
        ],
    )
    p = PipelineConfigurationSchema(
        id="p1",
        name="t",
        cloud_provider="aws",
        stages=PipelineStagesSchema(
            chunking=ChunkingConfigSchema(
                strategy="recursive-character", chunk_size=512, chunk_overlap=50
            ),
            embedding=EmbeddingConfigSchema(
                model="text-embedding-3-small", provider="openai", dimensions=1536
            ),
            vector_store=VectorStoreConfigSchema(provider="qdrant", index_name="kb"),
            retrieval=RetrievalConfigSchema(strategy="similarity", top_k=5),
            generation=GenerationConfigSchema(
                model="gpt-4o-mini",
                provider="openai",
                temperature=0.1,
                max_tokens=1024,
            ),
            routing=routing,
        ),
        metadata=PipelineMetadataSchema(created_at="2026-01-01T00:00:00Z"),
    )
    out = generation_with_routing(p, "hello world")
    assert out.model == "gpt-4o"


def test_routing_disabled_returns_base() -> None:
    routing = RoutingConfigSchema(enabled=False, rules=[])
    p = PipelineConfigurationSchema(
        id="p1",
        name="t",
        cloud_provider="aws",
        stages=PipelineStagesSchema(
            chunking=ChunkingConfigSchema(
                strategy="recursive-character", chunk_size=512, chunk_overlap=50
            ),
            embedding=EmbeddingConfigSchema(
                model="text-embedding-3-small", provider="openai", dimensions=1536
            ),
            vector_store=VectorStoreConfigSchema(provider="qdrant", index_name="kb"),
            retrieval=RetrievalConfigSchema(strategy="similarity", top_k=5),
            generation=GenerationConfigSchema(
                model="gpt-4o-mini",
                provider="openai",
                temperature=0.1,
                max_tokens=1024,
            ),
            routing=routing,
        ),
        metadata=PipelineMetadataSchema(created_at="2026-01-01T00:00:00Z"),
    )
    out = generation_with_routing(p, "refund")
    assert out.model == "gpt-4o-mini"
