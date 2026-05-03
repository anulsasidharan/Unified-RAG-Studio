"""LangGraph construction — bootstrap plus Document Analyst (P6-2 analyze stage)."""

from __future__ import annotations

from typing import Any

import structlog
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from app.core.agents.document_analyst import human_readable_analyst_message, run_document_analyst
from app.core.agents.prompts import DOCUMENT_ANALYST_PROMPT, ORCHESTRATOR_SYSTEM_PROMPT
from app.core.agents.state import AutopilotGraphState

logger = structlog.get_logger(__name__)


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
        "Running document analyst next, then later subgraphs per AUTOPILOT_STAGE_ORDER."
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
    """Marks bootstrap complete so workers / APIs can detect graph viability without running full Autopilot."""

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
            },
        },
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
    """Compile graph: prepare → finalize → document_analyst → END.

    Pass a ``MemorySaver`` (or other checkpointer) to exercise persistence; omit for stateless smoke tests.
    """

    graph = StateGraph(AutopilotGraphState)
    graph.add_node("bootstrap_prepare", _bootstrap_prepare)
    graph.add_node("bootstrap_finalize", _bootstrap_finalize)
    graph.add_node("document_analyst", _document_analyst_node)
    graph.set_entry_point("bootstrap_prepare")
    graph.add_edge("bootstrap_prepare", "bootstrap_finalize")
    graph.add_edge("bootstrap_finalize", "document_analyst")
    graph.add_edge("document_analyst", END)
    compiled = graph.compile(checkpointer=checkpointer)
    logger.debug("autopilot_bootstrap_graph_compiled", checkpointer=bool(checkpointer))
    return compiled


def invoke_autopilot_bootstrap(
    state: AutopilotGraphState,
    *,
    thread_id: str = "bootstrap-test",
    checkpointer: MemorySaver | None = None,
) -> AutopilotGraphState:
    """Run bootstrap + document analyst graph once; return merged terminal state (typed dict)."""

    app = compile_autopilot_bootstrap_graph(checkpointer=checkpointer)
    if checkpointer is not None:
        cfg: RunnableConfig = {"configurable": {"thread_id": thread_id}}
        result = app.invoke(state, config=cfg)
    else:
        result = app.invoke(state)
    return result  # type: ignore[return-value]
