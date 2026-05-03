"""Shared LangGraph state for Autopilot — single TypedDict + reducers (P6-1)."""

from __future__ import annotations

from operator import add
from typing import Annotated, Any, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


def merge_stage_outputs(
    existing: dict[str, Any] | None,
    new: dict[str, Any] | None,
) -> dict[str, Any]:
    """Shallow-merge per-node stage payloads so parallel branches can publish disjoint keys."""

    left = existing or {}
    right = new or {}
    return {**left, **right}


class AutopilotGraphState(TypedDict):
    """Canonical graph state passed between Autopilot nodes and future specialist agents.

    ``messages`` uses LangGraph's ``add_messages`` reducer for LLM/tool turns.
    ``agent_trace`` appends structured log lines suitable for persisting onto ``AutopilotBuild.messages``.
    ``stage_outputs`` accumulates machine-readable outputs per stage key (e.g. ``chunking``, ``embedding``).
    """

    messages: Annotated[list[AnyMessage], add_messages]
    build_id: str
    project_id: str
    document_ids: list[str]
    requirements: dict[str, Any]
    pipeline_config: dict[str, Any] | None
    iteration: int
    current_stage: str
    agent_trace: Annotated[list[dict[str, Any]], add]
    stage_outputs: Annotated[dict[str, Any], merge_stage_outputs]


# Aligns with ``_AUTOPILOT_STAGE_KEYS`` in ``app.worker.tasks`` — future subgraphs attach here.
AUTOPILOT_STAGE_ORDER: tuple[str, ...] = (
    "analyze",
    "chunking",
    "embedding",
    "retrieval",
    "generation",
    "evaluation",
)


def initial_autopilot_graph_state(
    *,
    build_id: str,
    project_id: str,
    document_ids: list[str],
    requirements: dict[str, Any],
    pipeline_config: dict[str, Any] | None = None,
) -> AutopilotGraphState:
    """Build a valid initial state for ``compile_autopilot_bootstrap_graph``."""

    return AutopilotGraphState(
        messages=[],
        build_id=build_id,
        project_id=project_id,
        document_ids=list(document_ids),
        requirements=dict(requirements),
        pipeline_config=dict(pipeline_config) if pipeline_config is not None else None,
        iteration=0,
        current_stage="pending",
        agent_trace=[],
        stage_outputs={},
    )
