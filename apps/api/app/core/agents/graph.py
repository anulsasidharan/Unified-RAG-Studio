"""LangGraph construction — bootstrap through Retrieval Optimizer (P6-5)."""

from __future__ import annotations

from typing import Any

from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
import structlog

from app.core.agents.chunking_optimizer import (
    human_readable_optimizer_message,
    run_chunking_optimizer,
)
from app.core.agents.document_analyst import (
    human_readable_analyst_message,
    run_document_analyst,
)
from app.core.agents.embedding_tester import (
    human_readable_embedding_message,
    run_embedding_tester,
)
from app.core.agents.prompts import (
    CHUNKING_OPTIMIZER_PROMPT,
    DOCUMENT_ANALYST_PROMPT,
    EMBEDDING_TESTER_PROMPT,
    ORCHESTRATOR_SYSTEM_PROMPT,
    RETRIEVAL_OPTIMIZER_PROMPT,
)
from app.core.agents.retrieval_optimizer import (
    human_readable_retrieval_message,
    run_retrieval_optimizer,
)
from app.core.agents.state import AutopilotGraphState

logger = structlog.get_logger(__name__)
_CHUNKING_OPT_HINT = CHUNKING_OPTIMIZER_PROMPT[:120]
_EMBEDDING_TESTER_HINT = EMBEDDING_TESTER_PROMPT[:120]
_RETRIEVAL_OPT_HINT = RETRIEVAL_OPTIMIZER_PROMPT[:120]


def _bootstrap_prepare(state: AutopilotGraphState) -> dict[str, Any]:
    """Seed trace + assistant acknowledgement; specialist nodes extend this pattern."""

    trace = {
        "event": "bootstrap_prepare",
        "build_id": state["build_id"],
        "project_id": state["project_id"],
        "document_count": len(state.get("document_ids") or []),
    }
    text = (
        "Autopilot graph online. "
        f"Documents queued: {trace['document_count']}. "
        "Running document analyst, chunking optimizer, embedding tester, retrieval optimizer, "
        "then later subgraphs per AUTOPILOT_STAGE_ORDER."
    )
    return {
        "messages": [
            AIMessage(
                content=text,
                additional_kwargs={"system_context": ORCHESTRATOR_SYSTEM_PROMPT[:200]},
            ),
        ],
        "current_stage": "bootstrap",
        "agent_trace": [trace],
        "stage_outputs": {"bootstrap": {"status": "ready", "prompt_seed": True}},
    }


def _bootstrap_finalize(state: AutopilotGraphState) -> dict[str, Any]:
    """Mark bootstrap complete for workers that probe graph viability."""

    return {
        "current_stage": "bootstrap_complete",
        "iteration": int(state.get("iteration") or 0) + 1,
        "agent_trace": [
            {
                "event": "bootstrap_finalize",
                "build_id": state["build_id"],
                "prior_stage": state.get("current_stage"),
            },
        ],
        "stage_outputs": {
            "bootstrap": {
                "status": "complete",
                "next": "document_analyst",
                "then": "chunking_optimizer",
                "then_embedding": "embedding_tester",
                "then_retrieval": "retrieval_optimizer",
            },
        },
    }


def _retrieval_optimizer_node(state: AutopilotGraphState) -> dict[str, Any]:
    """P6-5: tune retrieval; write ``stage_outputs['retrieval']``."""

    merged = state.get("stage_outputs") or {}
    embedding = merged.get("embedding")
    chunking = merged.get("chunking")
    analyze = merged.get("analyze")
    if not embedding or embedding.get("status") != "complete":
        trace = {
            "event": "retrieval_optimizer",
            "build_id": state["build_id"],
            "error": "missing_or_incomplete_embedding",
        }
        return {
            "messages": [
                AIMessage(
                    content="Retrieval optimizer skipped: embedding stage missing or incomplete.",
                    additional_kwargs={
                        "stage": "retrieval",
                        "retrieval_prompt_hint": _RETRIEVAL_OPT_HINT,
                    },
                ),
            ],
            "current_stage": "retrieval_complete",
            "agent_trace": [trace],
            "stage_outputs": {
                "retrieval": {
                    "status": "failed",
                    "reason": "missing_embedding",
                },
            },
        }

    if not chunking or chunking.get("status") != "complete":
        trace = {
            "event": "retrieval_optimizer",
            "build_id": state["build_id"],
            "error": "missing_or_incomplete_chunking",
        }
        return {
            "messages": [
                AIMessage(
                    content="Retrieval optimizer skipped: chunking stage missing or incomplete.",
                    additional_kwargs={
                        "stage": "retrieval",
                        "retrieval_prompt_hint": _RETRIEVAL_OPT_HINT,
                    },
                ),
            ],
            "current_stage": "retrieval_complete",
            "agent_trace": [trace],
            "stage_outputs": {
                "retrieval": {
                    "status": "failed",
                    "reason": "missing_chunking",
                },
            },
        }

    if not analyze or analyze.get("status") != "complete":
        trace = {
            "event": "retrieval_optimizer",
            "build_id": state["build_id"],
            "error": "missing_or_incomplete_analyze",
        }
        return {
            "messages": [
                AIMessage(
                    content="Retrieval optimizer skipped: analyze stage missing or incomplete.",
                    additional_kwargs={
                        "stage": "retrieval",
                        "retrieval_prompt_hint": _RETRIEVAL_OPT_HINT,
                    },
                ),
            ],
            "current_stage": "retrieval_complete",
            "agent_trace": [trace],
            "stage_outputs": {
                "retrieval": {
                    "status": "failed",
                    "reason": "missing_analyze",
                },
            },
        }

    payload = run_retrieval_optimizer(
        embedding_payload=dict(embedding),
        chunking_payload=dict(chunking),
        analyze_payload=dict(analyze),
        requirements=dict(state.get("requirements") or {}),
        pipeline_config=state.get("pipeline_config"),
    )
    trace = {
        "event": "retrieval_optimizer",
        "build_id": state["build_id"],
        "project_id": state["project_id"],
        "selected_strategy": (payload.get("selected") or {}).get("strategy"),
    }
    text = human_readable_retrieval_message(payload)
    return {
        "messages": [
            AIMessage(
                content=text,
                additional_kwargs={
                    "stage": "retrieval",
                    "retrieval_prompt_hint": _RETRIEVAL_OPT_HINT,
                },
            ),
        ],
        "current_stage": "retrieval_complete",
        "agent_trace": [trace],
        "stage_outputs": {"retrieval": payload},
    }


def _embedding_tester_node(state: AutopilotGraphState) -> dict[str, Any]:
    """P6-4: benchmark embedding candidates; write ``stage_outputs['embedding']``."""

    merged = state.get("stage_outputs") or {}
    chunking = merged.get("chunking")
    analyze = merged.get("analyze")
    if not chunking or chunking.get("status") != "complete":
        trace = {
            "event": "embedding_tester",
            "build_id": state["build_id"],
            "error": "missing_or_incomplete_chunking",
        }
        return {
            "messages": [
                AIMessage(
                    content="Embedding tester skipped: chunking stage missing or incomplete.",
                    additional_kwargs={
                        "stage": "embedding",
                        "embedding_prompt_hint": _EMBEDDING_TESTER_HINT,
                    },
                ),
            ],
            "current_stage": "embedding_complete",
            "agent_trace": [trace],
            "stage_outputs": {
                "embedding": {
                    "status": "failed",
                    "reason": "missing_chunking",
                },
            },
        }

    if not analyze or analyze.get("status") != "complete":
        trace = {
            "event": "embedding_tester",
            "build_id": state["build_id"],
            "error": "missing_or_incomplete_analyze",
        }
        return {
            "messages": [
                AIMessage(
                    content="Embedding tester skipped: analyze stage missing or incomplete.",
                    additional_kwargs={
                        "stage": "embedding",
                        "embedding_prompt_hint": _EMBEDDING_TESTER_HINT,
                    },
                ),
            ],
            "current_stage": "embedding_complete",
            "agent_trace": [trace],
            "stage_outputs": {
                "embedding": {
                    "status": "failed",
                    "reason": "missing_analyze",
                },
            },
        }

    payload = run_embedding_tester(
        chunking_payload=dict(chunking),
        analyze_payload=dict(analyze),
        requirements=dict(state.get("requirements") or {}),
        pipeline_config=state.get("pipeline_config"),
    )
    trace = {
        "event": "embedding_tester",
        "build_id": state["build_id"],
        "project_id": state["project_id"],
        "selected_model": (payload.get("selected") or {}).get("model"),
    }
    text = human_readable_embedding_message(payload)
    return {
        "messages": [
            AIMessage(
                content=text,
                additional_kwargs={
                    "stage": "embedding",
                    "embedding_prompt_hint": _EMBEDDING_TESTER_HINT,
                },
            ),
        ],
        "current_stage": "embedding_complete",
        "agent_trace": [trace],
        "stage_outputs": {"embedding": payload},
    }


def _chunking_optimizer_node(state: AutopilotGraphState) -> dict[str, Any]:
    """P6-3: benchmark chunking configs; write ``stage_outputs['chunking']``."""

    merged = state.get("stage_outputs") or {}
    analyze = merged.get("analyze")
    if not analyze or analyze.get("status") != "complete":
        trace = {
            "event": "chunking_optimizer",
            "build_id": state["build_id"],
            "error": "missing_or_incomplete_analyze",
        }
        return {
            "messages": [
                AIMessage(
                    content="Chunking optimizer skipped: analyze stage missing or incomplete.",
                    additional_kwargs={
                        "stage": "chunking",
                        "optimizer_prompt_hint": _CHUNKING_OPT_HINT,
                    },
                ),
            ],
            "current_stage": "chunking_complete",
            "agent_trace": [trace],
            "stage_outputs": {
                "chunking": {
                    "status": "failed",
                    "reason": "missing_analyze",
                },
            },
        }

    payload = run_chunking_optimizer(
        analyze_payload=dict(analyze),
        requirements=dict(state.get("requirements") or {}),
    )
    trace = {
        "event": "chunking_optimizer",
        "build_id": state["build_id"],
        "project_id": state["project_id"],
        "selected_strategy": (payload.get("selected") or {}).get("strategy"),
    }
    text = human_readable_optimizer_message(payload)
    return {
        "messages": [
            AIMessage(
                content=text,
                additional_kwargs={
                    "stage": "chunking",
                    "optimizer_prompt_hint": _CHUNKING_OPT_HINT,
                },
            ),
        ],
        "current_stage": "chunking_complete",
        "agent_trace": [trace],
        "stage_outputs": {"chunking": payload},
    }


def _document_analyst_node(state: AutopilotGraphState) -> dict[str, Any]:
    """P6-2: summarize corpus (from requirements profiles) and emit chunking guidance."""

    payload = run_document_analyst(
        document_ids=list(state.get("document_ids") or []),
        requirements=dict(state.get("requirements") or {}),
    )
    trace = {
        "event": "document_analyst",
        "build_id": state["build_id"],
        "project_id": state["project_id"],
        "primary_strategy": (payload.get("chunking_recommendation") or {}).get("primary_strategy"),
    }
    text = human_readable_analyst_message(payload)
    return {
        "messages": [
            AIMessage(
                content=text,
                additional_kwargs={
                    "stage": "analyze",
                    "analyst_prompt_hint": DOCUMENT_ANALYST_PROMPT[:120],
                },
            ),
        ],
        "current_stage": "analyze_complete",
        "agent_trace": [trace],
        "stage_outputs": {"analyze": payload},
    }


def compile_autopilot_bootstrap_graph(*, checkpointer: MemorySaver | None = None):
    """Compile linear graph through retrieval_optimizer (optional ``MemorySaver``)."""

    graph = StateGraph(AutopilotGraphState)
    graph.add_node("bootstrap_prepare", _bootstrap_prepare)
    graph.add_node("bootstrap_finalize", _bootstrap_finalize)
    graph.add_node("document_analyst", _document_analyst_node)
    graph.add_node("chunking_optimizer", _chunking_optimizer_node)
    graph.add_node("embedding_tester", _embedding_tester_node)
    graph.add_node("retrieval_optimizer", _retrieval_optimizer_node)
    graph.set_entry_point("bootstrap_prepare")
    graph.add_edge("bootstrap_prepare", "bootstrap_finalize")
    graph.add_edge("bootstrap_finalize", "document_analyst")
    graph.add_edge("document_analyst", "chunking_optimizer")
    graph.add_edge("chunking_optimizer", "embedding_tester")
    graph.add_edge("embedding_tester", "retrieval_optimizer")
    graph.add_edge("retrieval_optimizer", END)
    compiled = graph.compile(checkpointer=checkpointer)
    logger.debug("autopilot_bootstrap_graph_compiled", checkpointer=bool(checkpointer))
    return compiled


def invoke_autopilot_bootstrap(
    state: AutopilotGraphState,
    *,
    thread_id: str = "bootstrap-test",
    checkpointer: MemorySaver | None = None,
) -> AutopilotGraphState:
    """Run bootstrap + analyst + chunking + embedding + retrieval optimizer once; return merged terminal state."""

    app = compile_autopilot_bootstrap_graph(checkpointer=checkpointer)
    if checkpointer is not None:
        cfg: RunnableConfig = {"configurable": {"thread_id": thread_id}}
        result = app.invoke(state, config=cfg)
    else:
        result = app.invoke(state)
    return result  # type: ignore[return-value]
