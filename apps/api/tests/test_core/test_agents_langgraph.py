"""P6-1 … P6-7 LangGraph agent infrastructure — bootstrap through deployment agent + tools."""

from __future__ import annotations

import json
from unittest.mock import patch

from langgraph.checkpoint.memory import MemorySaver

from app.core.agents import (
    AUTOPILOT_STAGE_ORDER,
    compile_autopilot_bootstrap_graph,
    compile_autopilot_orchestrator_graph,
    get_autopilot_bootstrap_tools,
    initial_autopilot_graph_state,
    invoke_autopilot_bootstrap,
    invoke_autopilot_orchestrator,
)
from app.core.agents.progress import progress_trace_fields
from app.core.agents.prompts import format_stage_delegation
from app.core.agents.tools import (
    autopilot_health_ping,
    chunking_optimizer_run,
    deployment_agent_run,
    document_corpus_analyze,
    embedding_tester_run,
    evaluation_agent_run,
    retrieval_optimizer_run,
    summarize_requirements_snapshot,
)
from app.core.embedding.benchmarker import BenchmarkResult


def _fake_embedding_benchmark_results() -> list[BenchmarkResult]:
    return [
        BenchmarkResult(
            provider="huggingface",
            model="all-minilm-l6-v2",
            dimensions=384,
            total_texts=2,
            total_time_s=0.05,
            texts_per_second=40.0,
            avg_latency_ms=25.0,
            embedding_sample=[0.01] * 384,
        ),
        BenchmarkResult(
            provider="openai",
            model="text-embedding-3-small",
            dimensions=1536,
            total_texts=2,
            total_time_s=0.1,
            texts_per_second=20.0,
            avg_latency_ms=50.0,
            embedding_sample=[0.001] * 1536,
        ),
    ]


def test_progress_trace_fields_shape():
    row = progress_trace_fields(
        build_id="b",
        stage_key="retrieval",
        detail="unit",
        evaluation_pass_index=1,
        max_iterations=5,
    )
    assert row["kind"] == "autopilot_progress"
    assert row["stage"] == "retrieval"
    assert row["progress"] == 63
    assert row["build_id"] == "b"


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
    assert st["evaluation_pass_index"] == 0


def test_autopilot_stage_order_matches_worker_stub():
    assert AUTOPILOT_STAGE_ORDER[0] == "analyze"
    assert AUTOPILOT_STAGE_ORDER[-1] == "deployment"


@patch("app.core.agents.embedding_tester.EmbeddingBenchmarker")
def test_bootstrap_graph_runs_without_checkpointer(mock_bench_cls):
    mock_bench_cls.return_value.benchmark.return_value = _fake_embedding_benchmark_results()
    st = initial_autopilot_graph_state(
        build_id="b2",
        project_id="p2",
        document_ids=["doc1"],
        requirements={"embedding_max_benchmarks": 2},
    )
    out = invoke_autopilot_bootstrap(st, checkpointer=None)
    assert out["current_stage"] == "deployment_complete"
    assert out["iteration"] == 1
    assert out["stage_outputs"]["bootstrap"]["status"] == "complete"
    assert out["stage_outputs"]["analyze"]["status"] == "complete"
    assert out["stage_outputs"]["chunking"]["status"] == "complete"
    assert (out["stage_outputs"]["chunking"].get("selected") or {}).get("strategy")
    assert out["stage_outputs"]["embedding"]["status"] == "complete"
    assert (out["stage_outputs"]["embedding"].get("selected") or {}).get("model")
    assert out["stage_outputs"]["retrieval"]["status"] == "complete"
    assert (out["stage_outputs"]["retrieval"].get("selected") or {}).get("strategy")
    assert out["stage_outputs"]["evaluation"]["status"] == "complete"
    assert (out["stage_outputs"]["evaluation"].get("metrics") or {}).get("faithfulness") is not None
    assert "failure_analysis" in out["stage_outputs"]["evaluation"]
    assert out["stage_outputs"]["deployment"]["status"] == "complete"
    assert "docker_compose" in (out["stage_outputs"]["deployment"].get("artefacts") or {})
    assert (out["stage_outputs"]["deployment"].get("cloud_deployers") or {}).get("aws", {}).get(
        "apply_gated"
    )
    assert len(out["messages"]) >= 7
    assert len(out["agent_trace"]) >= 9
    gate_events = [t for t in out["agent_trace"] if t.get("event") == "orchestration_gate"]
    assert len(gate_events) >= 1
    assert gate_events[-1].get("decision") == "deploy"
    assert out["evaluation_pass_index"] == 0


@patch("app.core.agents.embedding_tester.EmbeddingBenchmarker")
def test_bootstrap_graph_with_memory_checkpointer(mock_bench_cls):
    mock_bench_cls.return_value.benchmark.return_value = _fake_embedding_benchmark_results()
    st = initial_autopilot_graph_state(
        build_id="b3",
        project_id="p3",
        document_ids=[],
        requirements={"max_iterations": 3, "embedding_max_benchmarks": 2},
    )
    mem = MemorySaver()
    out = invoke_autopilot_bootstrap(st, thread_id="unit-thread", checkpointer=mem)
    assert out["build_id"] == "b3"


@patch("app.core.agents.embedding_tester.EmbeddingBenchmarker")
def test_compile_returns_runnable(mock_bench_cls):
    mock_bench_cls.return_value.benchmark.return_value = _fake_embedding_benchmark_results()
    app = compile_autopilot_orchestrator_graph()
    st = initial_autopilot_graph_state(
        build_id="b4",
        project_id="p4",
        document_ids=["x"],
        requirements={"embedding_max_benchmarks": 2},
    )
    final = app.invoke(st)
    assert final["current_stage"] == "deployment_complete"


def test_stub_tools():
    assert autopilot_health_ping.invoke({}) == "autopilot_tools_ok"
    snap = summarize_requirements_snapshot.invoke({"requirements_json": "{}"})
    assert "requirements_bytes=" in snap


def test_tool_registry_non_empty():
    tools = get_autopilot_bootstrap_tools()
    assert len(tools) == 10


def test_document_corpus_analyze_tool_smoke():
    raw = document_corpus_analyze.invoke(
        {"document_ids_json": json.dumps(["1"]), "requirements_json": "{}"},
    )
    assert "chunking_recommendation" in json.loads(raw)


def test_chunking_optimizer_tool_smoke():
    analyze_raw = document_corpus_analyze.invoke(
        {"document_ids_json": json.dumps(["1"]), "requirements_json": "{}"},
    )
    analyze = json.loads(analyze_raw)
    out_raw = chunking_optimizer_run.invoke(
        {"analyze_json": json.dumps(analyze), "requirements_json": "{}"},
    )
    out = json.loads(out_raw)
    assert out.get("status") == "complete"
    assert out.get("selected", {}).get("strategy")


@patch("app.core.agents.embedding_tester.EmbeddingBenchmarker")
def test_embedding_tester_tool_smoke(mock_bench_cls):
    mock_bench_cls.return_value.benchmark.return_value = _fake_embedding_benchmark_results()
    analyze_raw = document_corpus_analyze.invoke(
        {"document_ids_json": json.dumps(["1"]), "requirements_json": "{}"},
    )
    analyze = json.loads(analyze_raw)
    chunk_raw = chunking_optimizer_run.invoke(
        {"analyze_json": json.dumps(analyze), "requirements_json": "{}"},
    )
    chunking = json.loads(chunk_raw)
    out_raw = embedding_tester_run.invoke(
        {
            "chunking_json": json.dumps(chunking),
            "analyze_json": json.dumps(analyze),
            "requirements_json": json.dumps({"embedding_max_benchmarks": 2}),
        },
    )
    out = json.loads(out_raw)
    assert out.get("status") == "complete"
    assert out.get("selected", {}).get("provider")
    assert out.get("selected", {}).get("model")


@patch("app.core.agents.embedding_tester.EmbeddingBenchmarker")
def test_retrieval_optimizer_tool_smoke(mock_bench_cls):
    mock_bench_cls.return_value.benchmark.return_value = _fake_embedding_benchmark_results()
    analyze_raw = document_corpus_analyze.invoke(
        {"document_ids_json": json.dumps(["1"]), "requirements_json": "{}"},
    )
    analyze = json.loads(analyze_raw)
    chunk_raw = chunking_optimizer_run.invoke(
        {"analyze_json": json.dumps(analyze), "requirements_json": "{}"},
    )
    chunking = json.loads(chunk_raw)
    emb_raw = embedding_tester_run.invoke(
        {
            "chunking_json": json.dumps(chunking),
            "analyze_json": json.dumps(analyze),
            "requirements_json": json.dumps({"embedding_max_benchmarks": 2}),
        },
    )
    embedding = json.loads(emb_raw)
    out_raw = retrieval_optimizer_run.invoke(
        {
            "embedding_json": json.dumps(embedding),
            "chunking_json": json.dumps(chunking),
            "analyze_json": json.dumps(analyze),
            "requirements_json": json.dumps({"retrieval_max_benchmarks": 6}),
        },
    )
    out = json.loads(out_raw)
    assert out.get("status") == "complete"
    assert out.get("selected", {}).get("strategy")
    assert out.get("selected", {}).get("top_k") is not None


@patch("app.core.agents.embedding_tester.EmbeddingBenchmarker")
def test_evaluation_agent_tool_smoke(mock_bench_cls):
    mock_bench_cls.return_value.benchmark.return_value = _fake_embedding_benchmark_results()
    analyze_raw = document_corpus_analyze.invoke(
        {"document_ids_json": json.dumps(["1"]), "requirements_json": "{}"},
    )
    analyze = json.loads(analyze_raw)
    chunk_raw = chunking_optimizer_run.invoke(
        {"analyze_json": json.dumps(analyze), "requirements_json": "{}"},
    )
    chunking = json.loads(chunk_raw)
    emb_raw = embedding_tester_run.invoke(
        {
            "chunking_json": json.dumps(chunking),
            "analyze_json": json.dumps(analyze),
            "requirements_json": json.dumps({"embedding_max_benchmarks": 2}),
        },
    )
    embedding = json.loads(emb_raw)
    ret_raw = retrieval_optimizer_run.invoke(
        {
            "embedding_json": json.dumps(embedding),
            "chunking_json": json.dumps(chunking),
            "analyze_json": json.dumps(analyze),
            "requirements_json": json.dumps({"retrieval_max_benchmarks": 6}),
        },
    )
    retrieval = json.loads(ret_raw)
    ev_raw = evaluation_agent_run.invoke(
        {
            "retrieval_json": json.dumps(retrieval),
            "chunking_json": json.dumps(chunking),
            "analyze_json": json.dumps(analyze),
            "requirements_json": "{}",
        },
    )
    ev = json.loads(ev_raw)
    assert ev.get("status") == "complete"
    assert ev.get("metrics", {}).get("faithfulness") is not None
    assert ev.get("failure_analysis", {}).get("summary")


@patch("app.core.agents.embedding_tester.EmbeddingBenchmarker")
def test_deployment_agent_tool_smoke(mock_bench_cls):
    mock_bench_cls.return_value.benchmark.return_value = _fake_embedding_benchmark_results()
    analyze_raw = document_corpus_analyze.invoke(
        {"document_ids_json": json.dumps(["1"]), "requirements_json": "{}"},
    )
    analyze = json.loads(analyze_raw)
    chunk_raw = chunking_optimizer_run.invoke(
        {"analyze_json": json.dumps(analyze), "requirements_json": "{}"},
    )
    chunking = json.loads(chunk_raw)
    emb_raw = embedding_tester_run.invoke(
        {
            "chunking_json": json.dumps(chunking),
            "analyze_json": json.dumps(analyze),
            "requirements_json": json.dumps({"embedding_max_benchmarks": 2}),
        },
    )
    embedding = json.loads(emb_raw)
    ret_raw = retrieval_optimizer_run.invoke(
        {
            "embedding_json": json.dumps(embedding),
            "chunking_json": json.dumps(chunking),
            "analyze_json": json.dumps(analyze),
            "requirements_json": json.dumps({"retrieval_max_benchmarks": 6}),
        },
    )
    retrieval = json.loads(ret_raw)
    ev_raw = evaluation_agent_run.invoke(
        {
            "retrieval_json": json.dumps(retrieval),
            "chunking_json": json.dumps(chunking),
            "analyze_json": json.dumps(analyze),
            "requirements_json": "{}",
        },
    )
    evaluation = json.loads(ev_raw)
    dep_raw = deployment_agent_run.invoke(
        {
            "evaluation_json": json.dumps(evaluation),
            "retrieval_json": json.dumps(retrieval),
            "chunking_json": json.dumps(chunking),
            "embedding_json": json.dumps(embedding),
            "requirements_json": "{}",
            "pipeline_config_json": "",
            "build_id": "test-build-id",
            "project_id": "test-project-id",
        },
    )
    dep = json.loads(dep_raw)
    assert dep.get("status") == "complete"
    assert dep.get("artefacts", {}).get("docker_compose")
    assert dep.get("cloud_deployers", {}).get("aws", {}).get("apply_gated") is True


def test_format_stage_delegation_contains_ids():
    s = format_stage_delegation(stage="chunking", build_id="bid", project_id="pid")
    assert "chunking" in s and "bid" in s and "pid" in s


@patch("app.core.agents.graph.run_evaluation_agent")
@patch("app.core.agents.embedding_tester.EmbeddingBenchmarker")
def test_orchestrator_retries_when_targets_unmet(mock_bench_cls, mock_run_eval):
    """Gate retries chunking→…→eval when evaluation reports ``meets_targets`` false."""

    mock_bench_cls.return_value.benchmark.return_value = _fake_embedding_benchmark_results()

    def _eval_payload(**_kwargs: object) -> dict:
        _eval_payload.n += 1
        meets = _eval_payload.n >= 2
        return {
            "status": "complete",
            "metrics": {
                "faithfulness": 0.99 if meets else 0.2,
                "answer_relevance": 0.5,
                "context_precision": 0.5,
                "context_recall": 0.5,
                "avg_latency_ms": 100.0,
            },
            "meets_targets": meets,
            "target_gaps": [] if meets else ["faithfulness"],
            "failure_analysis": {"summary": "stub", "failure_rows": []},
            "per_row_scores": [],
            "test_set_size": 1,
            "eval_mode": "unit_mock",
            "rationale": "mock",
        }

    _eval_payload.n = 0
    mock_run_eval.side_effect = lambda **kw: _eval_payload()

    st = initial_autopilot_graph_state(
        build_id="b-retry",
        project_id="p-retry",
        document_ids=["doc1"],
        requirements={
            "max_iterations": 3,
            "embedding_max_benchmarks": 2,
            "target_metrics": {"faithfulness": 0.999},
        },
    )
    out = invoke_autopilot_orchestrator(st)
    eval_ok_traces = [
        t for t in out["agent_trace"] if t.get("event") == "evaluation_agent" and "error" not in t
    ]
    assert len(eval_ok_traces) >= 2
    assert int(out.get("evaluation_pass_index") or 0) >= 1
    decisions = [t.get("decision") for t in out["agent_trace"] if t.get("event") == "orchestration_gate"]
    assert "retry" in decisions
    assert decisions[-1] == "deploy"


@patch("app.core.agents.embedding_tester.EmbeddingBenchmarker")
def test_invoke_orchestrator_matches_bootstrap(mock_bench_cls):
    mock_bench_cls.return_value.benchmark.return_value = _fake_embedding_benchmark_results()
    st = initial_autopilot_graph_state(
        build_id="b-alias",
        project_id="p-alias",
        document_ids=["z"],
        requirements={"embedding_max_benchmarks": 2},
    )
    a = invoke_autopilot_bootstrap(st, checkpointer=None)
    st2 = initial_autopilot_graph_state(
        build_id="b-alias",
        project_id="p-alias",
        document_ids=["z"],
        requirements={"embedding_max_benchmarks": 2},
    )
    b = invoke_autopilot_orchestrator(st2, checkpointer=None)
    assert a["current_stage"] == b["current_stage"] == "deployment_complete"
