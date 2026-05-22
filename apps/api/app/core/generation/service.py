"""Generation Service — P2-6.

Multi-provider LLM calls with RAG-style context assembly. Composes with
``RetrievalService`` by passing retrieved ``Document`` or ``ScoredDoc`` lists.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence

from langchain_core.documents import Document
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
import structlog

from app.config import Settings, get_settings
from app.core.vectorstore.strategies import ScoredDoc

from .factory import create_chat_model
from .prompts import DEFAULT_RAG_SYSTEM_PROMPT, build_rag_user_message
from .strategies import GenerationResult, GenerationRuntimeConfig

logger = structlog.get_logger(__name__)


def _normalize_context(context: Sequence[Document | ScoredDoc]) -> list[Document]:
    out: list[Document] = []
    for item in context:
        if isinstance(item, ScoredDoc):
            out.append(item.document)
        else:
            out.append(item)
    return out


def _messages_for_rag(
    *,
    system_text: str,
    user_text: str,
    conversation: list[tuple[str, str]] | None,
    few_shots: Sequence[tuple[str, str]] | None = None,
) -> list[BaseMessage]:
    msgs: list[BaseMessage] = [SystemMessage(content=system_text)]
    for role, content in few_shots or ():
        r = (role or "").lower()
        if r == "assistant":
            msgs.append(AIMessage(content=content))
        elif r == "system":
            msgs.append(SystemMessage(content=content))
        else:
            msgs.append(HumanMessage(content=content))
    for user_turn, assistant_turn in conversation or []:
        msgs.append(HumanMessage(content=user_turn))
        msgs.append(AIMessage(content=assistant_turn))
    msgs.append(HumanMessage(content=user_text))
    return msgs


def _compose_system_prompt(cfg: GenerationRuntimeConfig) -> str:
    system = (cfg.system_prompt or "").strip() or DEFAULT_RAG_SYSTEM_PROMPT
    if (cfg.persona or "").strip():
        system = f"You are {(cfg.persona or '').strip()}.\n\n" + system
    if cfg.citation_grounding:
        system += "\n\nGround answers in the provided context and cite supporting passages when you rely on them."  # noqa: E501
    return system


def _result_from_ai_message(
    msg: BaseMessage,
    cfg: GenerationRuntimeConfig,
) -> GenerationResult:
    text = msg.content
    if isinstance(text, list):
        text = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part) for part in text
        )
    text = str(text).strip()
    meta = getattr(msg, "response_metadata", None) or {}
    finish = None
    usage: dict[str, int] = {}
    if isinstance(meta, dict):
        fr = meta.get("finish_reason")
        finish = fr if isinstance(fr, str) else None
        raw_usage = meta.get("token_usage") or meta.get("usage")
        if isinstance(raw_usage, dict):
            for k, v in raw_usage.items():
                if isinstance(v, int | float):
                    usage[str(k)] = int(v)
    return GenerationResult(
        text=text,
        model=cfg.model,
        provider=cfg.provider,
        finish_reason=finish,
        usage=usage,
    )


class GenerationService:
    """LLM generation with optional conversational history and RAG context."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    async def generate(
        self,
        query: str,
        context: Sequence[Document | ScoredDoc],
        cfg: GenerationRuntimeConfig,
        *,
        conversation: list[tuple[str, str]] | None = None,
    ) -> GenerationResult:
        """Single completion: system + optional prior turns + RAG user message."""
        docs = _normalize_context(context)
        model = create_chat_model(cfg, self._settings)
        system = _compose_system_prompt(cfg)
        user = build_rag_user_message(
            query,
            docs,
            output_format=cfg.output_format,
        )
        messages = _messages_for_rag(
            system_text=system,
            user_text=user,
            conversation=conversation,
            few_shots=cfg.few_shots,
        )
        resp = await model.ainvoke(messages)
        if not isinstance(resp, AIMessage):
            resp = AIMessage(content=getattr(resp, "content", str(resp)))
        out = _result_from_ai_message(resp, cfg)
        logger.info(
            "generation_complete",
            provider=cfg.provider,
            model=cfg.model,
            chars=len(out.text),
        )
        return out

    async def stream(
        self,
        query: str,
        context: Sequence[Document | ScoredDoc],
        cfg: GenerationRuntimeConfig,
        *,
        conversation: list[tuple[str, str]] | None = None,
    ) -> AsyncIterator[str]:
        """Token/chunk stream for UIs that support streaming (optional)."""
        docs = _normalize_context(context)
        model = create_chat_model(cfg, self._settings)
        system = _compose_system_prompt(cfg)
        user = build_rag_user_message(
            query,
            docs,
            output_format=cfg.output_format,
        )
        messages = _messages_for_rag(
            system_text=system,
            user_text=user,
            conversation=conversation,
            few_shots=cfg.few_shots,
        )
        async for chunk in model.astream(messages):
            content = chunk.content
            if isinstance(content, str) and content:
                yield content
            elif isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get("text"):
                        yield str(part["text"])
