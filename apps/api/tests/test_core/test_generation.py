"""Unit tests for P2-6 Generation Service (mocked LLM, pure prompt/bridge tests)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from langchain_core.documents import Document
from langchain_core.messages import AIMessage
import pytest

from app.core.generation import (
    GenerationRuntimeConfig,
    GenerationService,
    generation_runtime_from_pipeline,
)
from app.core.generation.prompts import build_rag_user_message, format_context_block
from app.core.vectorstore.strategies import ScoredDoc
from app.schemas.pipeline import GenerationConfigSchema, GenerationProvider, OutputFormat


@pytest.mark.unit
def test_format_context_block_numbers_sources():
    docs = [
        Document(page_content="alpha", metadata={"source": "a.txt"}),
        Document(page_content="beta", metadata={}),
    ]
    text = format_context_block(docs)
    assert "[1] (source: a.txt)" in text
    assert "alpha" in text
    assert "[2]" in text


@pytest.mark.unit
def test_build_rag_user_json_hint():
    d = [Document(page_content="only fact")]
    msg = build_rag_user_message("Q?", d, output_format="json")
    assert "valid JSON" in msg
    assert "only fact" in msg


@pytest.mark.unit
def test_generation_runtime_from_pipeline():
    cfg = GenerationConfigSchema(
        model="gpt-4o-mini",
        provider=GenerationProvider.OPENAI,
        temperature=0.5,
        max_tokens=256,
        output_format=OutputFormat.MARKDOWN,
    )
    rt = generation_runtime_from_pipeline(cfg)
    assert rt.model == "gpt-4o-mini"
    assert rt.provider == "openai"
    assert rt.output_format == "markdown"
    assert rt.max_tokens == 256


@pytest.mark.asyncio
@pytest.mark.unit
async def test_generate_invokes_chat_model():
    cfg = GenerationRuntimeConfig(model="gpt-4o-mini", provider="openai")
    fake = AIMessage(
        content="answer",
        response_metadata={"finish_reason": "stop", "token_usage": {"total_tokens": 10}},
    )
    mock_model = AsyncMock()
    mock_model.ainvoke = AsyncMock(return_value=fake)

    with patch("app.core.generation.service.create_chat_model", return_value=mock_model):
        svc = GenerationService()
        out = await svc.generate(
            "What is X?",
            [Document(page_content="context about X")],
            cfg,
        )

    assert out.text == "answer"
    assert out.finish_reason == "stop"
    mock_model.ainvoke.assert_awaited_once()


@pytest.mark.unit
def test_normalize_accepts_scored_doc():
    cfg = GenerationRuntimeConfig(model="m", provider="openai")
    assert cfg.model == "m"
    doc = Document(page_content="hi")
    sd = ScoredDoc(doc, 0.9)
    # exercise import path used by service
    from app.core.generation.service import _normalize_context

    norm = _normalize_context([sd])
    assert len(norm) == 1
    assert norm[0].page_content == "hi"
