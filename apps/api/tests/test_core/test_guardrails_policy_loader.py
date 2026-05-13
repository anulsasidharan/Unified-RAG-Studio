"""P4.5-7 — file-based guardrail operator policies and manager wiring."""

from __future__ import annotations

import json
from pathlib import Path

from langchain_core.documents import Document
import pytest

from app.config import get_settings
from app.core.generation import GenerationService
from app.core.guardrails import (
    GuardrailOrchestrator,
    GuardrailStage,
    build_guardrail_manager,
)
from app.core.guardrails.input.toxicity import DEFAULT_TOXICITY_EXTRA_PATTERNS
from app.core.guardrails.policy_loader import (
    load_bias_operator_policy,
    load_content_filter_operator_policy,
    load_toxicity_operator_policy,
)
from app.core.guardrails.retrieval.bias import DEFAULT_BIAS_HEURISTIC_PATTERNS
from app.core.guardrails.retrieval.content_filter import DEFAULT_RETRIEVAL_FILTER_EXTRA_PATTERNS
from app.core.rag import run_guarded_rag_query
from app.schemas import GuardrailsConfigSchema
from app.schemas.pipeline import (
    ChunkingConfigSchema,
    ChunkingStrategy,
    CloudProvider,
    EmbeddingConfigSchema,
    EmbeddingProvider,
    GenerationConfigSchema,
    GenerationProvider,
    OutputFormat,
    PipelineConfigurationSchema,
    PipelineMetadataSchema,
    PipelineStagesSchema,
    RetrievalConfigSchema,
    RetrievalStrategy,
    VectorStoreConfigSchema,
    VectorStoreProvider,
)


def _minimal_pipeline() -> PipelineConfigurationSchema:
    stages = PipelineStagesSchema(
        chunking=ChunkingConfigSchema(
            strategy=ChunkingStrategy.RECURSIVE_CHARACTER,
            chunk_size=512,
            chunk_overlap=50,
        ),
        embedding=EmbeddingConfigSchema(
            model="text-embedding-3-small",
            provider=EmbeddingProvider.OPENAI,
            dimensions=1536,
        ),
        vector_store=VectorStoreConfigSchema(
            provider=VectorStoreProvider.QDRANT,
            index_name="i",
        ),
        retrieval=RetrievalConfigSchema(strategy=RetrievalStrategy.SIMILARITY, top_k=5),
        generation=GenerationConfigSchema(
            model="gpt-4o-mini",
            provider=GenerationProvider.OPENAI,
            temperature=0.7,
            max_tokens=256,
            output_format=OutputFormat.TEXT,
        ),
    )
    return PipelineConfigurationSchema(
        id="cfg-policy",
        name="Test",
        cloud_provider=CloudProvider.AWS,
        stages=stages,
        metadata=PipelineMetadataSchema(created_at="2026-01-01T00:00:00+00:00", version="1.0.0"),
    )


@pytest.mark.unit
def test_load_toxicity_policy_merges_defaults(tmp_path: Path) -> None:
    p = tmp_path / "tox.json"
    p.write_text(
        json.dumps({"blocked_terms": ["blockme"], "regex_patterns": [r"regexhit"]}),
        encoding="utf-8",
    )
    data = load_toxicity_operator_policy(str(p), default_extra=DEFAULT_TOXICITY_EXTRA_PATTERNS)
    assert data is not None
    assert "blockme" in data.blocked_terms
    assert len(data.extra_patterns) >= len(DEFAULT_TOXICITY_EXTRA_PATTERNS)


@pytest.mark.unit
def test_load_toxicity_invalid_regex_raises(tmp_path: Path) -> None:
    p = tmp_path / "bad.json"
    p.write_text(json.dumps({"blocked_terms": [], "regex_patterns": ["("]}), encoding="utf-8")
    with pytest.raises(ValueError, match="invalid regex"):
        load_toxicity_operator_policy(str(p), default_extra=DEFAULT_TOXICITY_EXTRA_PATTERNS)


@pytest.mark.unit
def test_load_missing_file_returns_none_with_warning(caplog: pytest.LogCaptureFixture) -> None:
    import logging

    caplog.set_level(logging.WARNING)
    data = load_toxicity_operator_policy(
        "/nonexistent/path/tox.json", default_extra=DEFAULT_TOXICITY_EXTRA_PATTERNS
    )
    assert data is None
    assert "not found" in caplog.text


@pytest.mark.unit
def test_load_content_filter_policy(tmp_path: Path) -> None:
    p = tmp_path / "cf.json"
    p.write_text(
        json.dumps({"blocked_terms": ["dropchunk"], "regex_patterns": []}),
        encoding="utf-8",
    )
    data = load_content_filter_operator_policy(
        str(p), default_extra=DEFAULT_RETRIEVAL_FILTER_EXTRA_PATTERNS
    )
    assert data is not None
    assert "dropchunk" in data.blocked_terms


@pytest.mark.unit
def test_load_bias_policy(tmp_path: Path) -> None:
    p = tmp_path / "bias.json"
    p.write_text(json.dumps({"regex_patterns": [r"bias_marker_xyz"]}), encoding="utf-8")
    data = load_bias_operator_policy(str(p), default_patterns=DEFAULT_BIAS_HEURISTIC_PATTERNS)
    assert data is not None
    assert len(data.patterns) >= len(DEFAULT_BIAS_HEURISTIC_PATTERNS)


@pytest.mark.unit
def test_build_manager_applies_toxicity_policy_from_env(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    p = tmp_path / "tox.json"
    p.write_text(json.dumps({"blocked_terms": ["badword"], "regex_patterns": []}), encoding="utf-8")
    monkeypatch.setenv("GUARDRAILS_TOXICITY_POLICY_PATH", str(p))
    get_settings.cache_clear()
    try:
        m = build_guardrail_manager(GuardrailsConfigSchema())
        orch = GuardrailOrchestrator(m)
        res = orch.check_input("Hello badword here")
        assert res.allowed is False
        assert res.blocked_by == "toxicity-filter"
    finally:
        monkeypatch.delenv("GUARDRAILS_TOXICITY_POLICY_PATH", raising=False)
        get_settings.cache_clear()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_run_guarded_rag_blocks_operator_toxicity_term(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    p = tmp_path / "tox.json"
    p.write_text(
        json.dumps({"blocked_terms": ["stopword"], "regex_patterns": []}), encoding="utf-8"
    )
    monkeypatch.setenv("GUARDRAILS_TOXICITY_POLICY_PATH", str(p))
    get_settings.cache_clear()
    try:
        pipe = _minimal_pipeline()
        out = await run_guarded_rag_query(
            query="This contains stopword in text.",
            context_documents=[Document(page_content="ctx")],
            pipeline=pipe,
        )
        assert out.allowed is False
        assert out.blocked_stage == GuardrailStage.INPUT
    finally:
        monkeypatch.delenv("GUARDRAILS_TOXICITY_POLICY_PATH", raising=False)
        get_settings.cache_clear()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_run_guarded_rag_warns_bias_from_policy_file(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    p = tmp_path / "bias.json"
    p.write_text(
        json.dumps({"regex_patterns": [r"unique_bias_test_token_12345"]}), encoding="utf-8"
    )
    monkeypatch.setenv("GUARDRAILS_BIAS_PATTERNS_POLICY_PATH", str(p))
    get_settings.cache_clear()
    try:
        from unittest.mock import AsyncMock, patch

        from langchain_core.messages import AIMessage

        pipe = _minimal_pipeline()
        fake = AIMessage(content="Answer.", response_metadata={"finish_reason": "stop"})
        mock_model = AsyncMock()
        mock_model.ainvoke = AsyncMock(return_value=fake)
        with patch("app.core.generation.service.create_chat_model", return_value=mock_model):
            svc = GenerationService()
            out = await run_guarded_rag_query(
                query="unique_bias_test_token_12345 in query",
                context_documents=[Document(page_content="safe chunk")],
                pipeline=pipe,
                generation_service=svc,
            )
        assert out.allowed is True
        assert out.retrieval_result is not None
        assert out.retrieval_result.had_warnings is True
    finally:
        monkeypatch.delenv("GUARDRAILS_BIAS_PATTERNS_POLICY_PATH", raising=False)
        get_settings.cache_clear()
