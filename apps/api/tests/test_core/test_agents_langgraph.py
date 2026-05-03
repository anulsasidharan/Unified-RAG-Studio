"""P6-1 / P6-2 LangGraph agent infrastructure — bootstrap + document analyst + tools."""

from __future__ import annotations

import json

from langgraph.checkpoint.memory import MemorySaver

from app.core.agents import (
    AUTOPILOT_STAGE_ORDER,
    compile_autopilot_bootstrap_graph,
    get_autopilot_bootstrap_tools,
    initial_autopilot_graph_state,
    invoke_autopilot_bootstrap,
)
from app.core.agents.prompts import format_stage_delegation
from app.core.agents.tools import autopilot_health_ping, document_corpus_analyze, summarize_requirements_snapshot


def test_initial_state_shapes():
    st = initial_autopilot_graph_state(
        build_id="b1",
        project_id="p1",
        document_ids=["a", "b"],
        requirements={"optimize_for": "balanced"},
        pipeline_config=None,
    )
    assert st["build_id"] == "b1"
    assert st["document_ids"] == ["a", "b"]
    assert st["stage_outputs"] == {}
    assert st["iteration"] == 0


def test_autopilot_stage_order_matches_worker_stub():
    assert AUTOPILOT_STAGE_ORDER[0] == "analyze"
    assert AUTOPILOT_STAGE_ORDER[-1] == "evaluation"


def test_bootstrap_graph_runs_without_checkpointer():
    st = initial_autopilot_graph_state(
        build_id="b2",
        project_id="p2",
        document_ids=["doc1"],
        requirements={},
    )
    out = invoke_autopilot_bootstrap(st, checkpointer=None)
    assert out["current_stage"] == "analyze_complete"
    assert out["iteration"] == 1
    assert out["stage_outputs"]["bootstrap"]["status"] == "complete"
    assert out["stage_outputs"]["analyze"]["status"] == "complete"
    assert len(out["messages"]) >= 2
    assert len(out["agent_trace"]) >= 3


def test_bootstrap_graph_with_memory_checkpointer():
    st = initial_autopilot_graph_state(
        build_id="b3",
        project_id="p3",
        document_ids=[],
        requirements={"max_iterations": 3},
    )
    mem = MemorySaver()
    out = invoke_autopilot_bootstrap(st, thread_id="unit-thread", checkpointer=mem)
    assert out["build_id"] == "b3"


def test_compile_returns_runnable():
    app = compile_autopilot_bootstrap_graph()
    st = initial_autopilot_graph_state(
        build_id="b4",
        project_id="p4",
        document_ids=["x"],
        requirements={},
    )
    final = app.invoke(st)
    assert final["current_stage"] == "analyze_complete"


def test_stub_tools():
    assert autopilot_health_ping.invoke({}) == "autopilot_tools_ok"
    assert "requirements_bytes=" in summarize_requirements_snapshot.invoke({"requirements_json": "{}"})


def test_tool_registry_non_empty():
    tools = get_autopilot_bootstrap_tools()
    assert len(tools) == 5


def test_document_corpus_analyze_tool_smoke():
    raw = document_corpus_analyze.invoke(
        {"document_ids_json": json.dumps(["1"]), "requirements_json": "{}"},
    )
    assert "chunking_recommendation" in json.loads(raw)


def test_format_stage_delegation_contains_ids():
    s = format_stage_delegation(stage="chunking", build_id="bid", project_id="pid")
    assert "chunking" in s and "bid" in s and "pid" in s
