"""LangGraph construction — Autopilot orchestrator through Deployment Agent (P6-8)."""

from __future__ import annotations

from typing import Any, Literal, cast

from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
import structlog

from app.core.agents.chunking_optimizer import (
    human_readable_optimizer_message,
    run_chunking_optimizer,
)
from app.core.agents.deployment_agent import (
    human_readable_deployment_message,
    run_deployment_agent,
)
from app.core.agents.document_analyst import (
    human_readable_analyst_message,
    run_document_analyst,
)
from app.core.agents.embedding_tester import (
    human_readable_embedding_message,
    run_embedding_tester,
)
from app.core.agents.evaluation_agent import (
    human_readable_evaluation_message,
    run_evaluation_agent,
)
from app.core.agents.progress import progress_trace_fields
from app.core.agents.prompts import (
    CHUNKING_OPTIMIZER_PROMPT,
    DEPLOYMENT_AGENT_PROMPT,
    DOCUMENT_ANALYST_PROMPT,
    EMBEDDING_TESTER_PROMPT,
    EVALUATION_AGENT_PROMPT,
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
_EVAL_AGENT_HINT = EVALUATION_AGENT_PROMPT[:120]
_DEPLOYMENT_AGENT_HINT = DEPLOYMENT_AGENT_PROMPT[:120]


def _max_iterations_cap(requirements: dict[str, Any] | None) -> int:
    return max(1, min(10, int((requirements or {}).get("max_iterations", 5) or 5)))


def _progress_row(
    state: AutopilotGraphState,
    *,
    stage_key: str,
    detail: str,
) -> dict[str, Any]:
    req = dict(state.get("requirements") or {})
    return progress_trace_fields(
        build_id=state["build_id"],
        stage_key=stage_key,
        detail=detail,
        evaluation_pass_index=int(state.get("evaluation_pass_index") or 0),
        max_iterations=_max_iterations_cap(req),
    )


def _orchestration_decision(
    state: AutopilotGraphState,
) -> tuple[Literal["retry", "deploy"], dict[str, Any]]:
    """After evaluation: retry tuning (chunking onward) or finish toward deployment."""

    req = dict(state.get("requirements") or {})
    max_iter = _max_iterations_cap(req)
    merged = state.get("stage_outputs") or {}
    ev = merged.get("evaluation") or {}
    idx = int(state.get("evaluation_pass_index") or 0)
    meta: dict[str, Any] = {"evaluation_pass_index": idx, "max_iterations": max_iter}

    if ev.get("status") != "complete":
        return "deploy", {**meta, "reason": "evaluation_incomplete"}
    if ev.get("meets_targets"):
        return "deploy", {**meta, "reason": "targets_met"}
    if idx >= max_iter - 1:
        return "deploy", {**meta, "reason": "max_iterations_reached"}
    return "retry", {**meta, "reason": "targets_not_met"}


def _orchestration_gate_node(state: AutopilotGraphState) -> dict[str, Any]:
    """P6-8: decide retry vs deploy; emit progress-shaped trace rows for SSE/workers."""

    decision, meta = _orchestration_decision(state)
    req = dict(state.get("requirements") or {})
    mi = _max_iterations_cap(req)
    ep = int(state.get("evaluation_pass_index") or 0)
    prog = progress_trace_fields(
        build_id=state["build_id"],
        stage_key="evaluation",
        detail=f"orchestration:{decision}",
        evaluation_pass_index=ep,
        max_iterations=mi,
    )
    trace = {
        **prog,
        "event": "orchestration_gate",
        "decision": decision,
        "reason": meta.get("reason"),
        "max_iterations": meta.get("max_iterations"),
        "evaluation_pass_index_before": meta.get("evaluation_pass_index"),
    }
    orch_payload: dict[str, Any] = {"decision": decision, **meta}
    out: dict[str, Any] = {
        "agent_trace": [trace],
        "current_stage": "orchestration_gate_complete",
        "stage_outputs": {"orchestration": orch_payload},
    }
    if decision == "retry":
        next_idx = ep + 1
        out["evaluation_pass_index"] = next_idx
        out["messages"] = [
            AIMessage(
                content=(
                    "Orchestrator: optimisation targets not met; "
                    f"scheduling pass {next_idx + 1}/{mi} "
                    "(re-running chunking → embedding → retrieval → evaluation)."
                ),
            ),
        ]
    else:
        out["messages"] = [
            AIMessage(
                content=(
                    f"Orchestrator: closing optimisation loop — {meta.get('reason')} "
                    "(continuing to deployment)."
                ),
            ),
        ]
    return out


def _route_post_gate(state: AutopilotGraphState) -> str:
    orch = (state.get("stage_outputs") or {}).get("orchestration") or {}
    return "retry_chunking" if orch.get("decision") == "retry" else "deploy"


def _bootstrap_prepare(state: AutopilotGraphState) -> dict[str, Any]:
    """Seed trace + assistant acknowledgement; specialist nodes extend this pattern."""

    trace = {
        **_progress_row(state, stage_key="analyze", detail="bootstrap_prepare"),
        "event": "bootstrap_prepare",
        "project_id": state["project_id"],
        "document_count": len(state.get("document_ids") or []),
    }
    text = (
        "Autopilot graph online. "
        f"Documents queued: {trace['document_count']}. "
        "Running document analyst → chunking → embedding → retrieval → evaluation, "
        "then the orchestration gate (retry vs deploy), then deployment."
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
                **_progress_row(state, stage_key="analyze", detail="bootstrap_finalize"),
                "event": "bootstrap_finalize",
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
                "then_evaluation": "evaluation_agent",
                "then_deployment": "deployment_agent",
            },
        },
    }


def _deployment_agent_node(state: AutopilotGraphState) -> dict[str, Any]:
    """P6-7: compose / K8s / Terraform previews + gated cloud stubs; ``stage_outputs['deployment']``."""  # noqa: E501

    merged = state.get("stage_outputs") or {}
    retrieval = merged.get("retrieval")
    chunking = merged.get("chunking")
    embedding = merged.get("embedding")
    evaluation = merged.get("evaluation")

    if not retrieval or retrieval.get("status") != "complete":
        trace = {
            **_progress_row(state, stage_key="deployment", detail="deployment_skipped"),
            "event": "deployment_agent",
            "error": "missing_or_incomplete_retrieval",
        }
        return {
            "messages": [
                AIMessage(
                    content="Deployment agent skipped: retrieval stage missing or incomplete.",
                    additional_kwargs={
                        "stage": "deployment",
                        "deployment_prompt_hint": _DEPLOYMENT_AGENT_HINT,
                    },
                ),
            ],
            "current_stage": "deployment_complete",
            "agent_trace": [trace],
            "stage_outputs": {
                "deployment": {
                    "status": "failed",
                    "reason": "missing_retrieval",
                },
            },
        }

    if not embedding or embedding.get("status") != "complete":
        trace = {
            **_progress_row(state, stage_key="deployment", detail="deployment_skipped"),
            "event": "deployment_agent",
            "error": "missing_or_incomplete_embedding",
        }
        return {
            "messages": [
                AIMessage(
                    content="Deployment agent skipped: embedding stage missing or incomplete.",
                    additional_kwargs={
                        "stage": "deployment",
                        "deployment_prompt_hint": _DEPLOYMENT_AGENT_HINT,
                    },
                ),
            ],
            "current_stage": "deployment_complete",
            "agent_trace": [trace],
            "stage_outputs": {
                "deployment": {
                    "status": "failed",
                    "reason": "missing_embedding",
                },
            },
        }

    if not chunking or chunking.get("status") != "complete":
        trace = {
            **_progress_row(state, stage_key="deployment", detail="deployment_skipped"),
            "event": "deployment_agent",
            "error": "missing_or_incomplete_chunking",
        }
        return {
            "messages": [
                AIMessage(
                    content="Deployment agent skipped: chunking stage missing or incomplete.",
                    additional_kwargs={
                        "stage": "deployment",
                        "deployment_prompt_hint": _DEPLOYMENT_AGENT_HINT,
                    },
                ),
            ],
            "current_stage": "deployment_complete",
            "agent_trace": [trace],
            "stage_outputs": {
                "deployment": {
                    "status": "failed",
                    "reason": "missing_chunking",
                },
            },
        }

    eval_payload = dict(evaluation) if isinstance(evaluation, dict) else {}

    payload = run_deployment_agent(
        evaluation_payload=eval_payload,
        retrieval_payload=dict(retrieval),
        chunking_payload=dict(chunking),
        embedding_payload=dict(embedding),
        requirements=dict(state.get("requirements") or {}),
        pipeline_config=state.get("pipeline_config"),
        build_id=state["build_id"],
        project_id=state["project_id"],
    )
    trace = {
        **_progress_row(state, stage_key="deployment", detail="deployment_agent"),
        "event": "deployment_agent",
        "project_id": state["project_id"],
        "deploy_status": payload.get("status"),
        "synthesized_from": payload.get("synthesized_from"),
    }
    text = human_readable_deployment_message(payload)
    return {
        "messages": [
            AIMessage(
                content=text,
                additional_kwargs={
                    "stage": "deployment",
                    "deployment_prompt_hint": _DEPLOYMENT_AGENT_HINT,
                },
            ),
        ],
        "current_stage": "deployment_complete",
        "agent_trace": [trace],
        "stage_outputs": {"deployment": payload},
    }


def _evaluation_agent_node(state: AutopilotGraphState) -> dict[str, Any]:
    """P6-6: offline eval + failure analysis; write ``stage_outputs['evaluation']``."""

    merged = state.get("stage_outputs") or {}
    retrieval = merged.get("retrieval")
    chunking = merged.get("chunking")
    analyze = merged.get("analyze")
    if not retrieval or retrieval.get("status") != "complete":
        trace = {
            **_progress_row(state, stage_key="evaluation", detail="evaluation_skipped"),
            "event": "evaluation_agent",
            "error": "missing_or_incomplete_retrieval",
        }
        return {
            "messages": [
                AIMessage(
                    content="Evaluation agent skipped: retrieval stage missing or incomplete.",
                    additional_kwargs={
                        "stage": "evaluation",
                        "evaluation_prompt_hint": _EVAL_AGENT_HINT,
                    },
                ),
            ],
            "current_stage": "evaluation_complete",
            "agent_trace": [trace],
            "stage_outputs": {
                "evaluation": {
                    "status": "failed",
                    "reason": "missing_retrieval",
                },
            },
        }

    if not chunking or chunking.get("status") != "complete":
        trace = {
            **_progress_row(state, stage_key="evaluation", detail="evaluation_skipped"),
            "event": "evaluation_agent",
            "error": "missing_or_incomplete_chunking",
        }
        return {
            "messages": [
                AIMessage(
                    content="Evaluation agent skipped: chunking stage missing or incomplete.",
                    additional_kwargs={
                        "stage": "evaluation",
                        "evaluation_prompt_hint": _EVAL_AGENT_HINT,
                    },
                ),
            ],
            "current_stage": "evaluation_complete",
            "agent_trace": [trace],
            "stage_outputs": {
                "evaluation": {
                    "status": "failed",
                    "reason": "missing_chunking",
                },
            },
        }

    if not analyze or analyze.get("status") != "complete":
        trace = {
            **_progress_row(state, stage_key="evaluation", detail="evaluation_skipped"),
            "event": "evaluation_agent",
            "error": "missing_or_incomplete_analyze",
        }
        return {
            "messages": [
                AIMessage(
                    content="Evaluation agent skipped: analyze stage missing or incomplete.",
                    additional_kwargs={
                        "stage": "evaluation",
                        "evaluation_prompt_hint": _EVAL_AGENT_HINT,
                    },
                ),
            ],
            "current_stage": "evaluation_complete",
            "agent_trace": [trace],
            "stage_outputs": {
                "evaluation": {
                    "status": "failed",
                    "reason": "missing_analyze",
                },
            },
        }

    payload = run_evaluation_agent(
        retrieval_payload=dict(retrieval),
        chunking_payload=dict(chunking),
        analyze_payload=dict(analyze),
        requirements=dict(state.get("requirements") or {}),
        pipeline_config=state.get("pipeline_config"),
    )
    trace = {
        **_progress_row(state, stage_key="evaluation", detail="evaluation_agent"),
        "event": "evaluation_agent",
        "project_id": state["project_id"],
        "meets_targets": payload.get("meets_targets"),
        "eval_status": payload.get("status"),
    }
    text = human_readable_evaluation_message(payload)
    return {
        "messages": [
            AIMessage(
                content=text,
                additional_kwargs={
                    "stage": "evaluation",
                    "evaluation_prompt_hint": _EVAL_AGENT_HINT,
                },
            ),
        ],
        "current_stage": "evaluation_complete",
        "agent_trace": [trace],
        "stage_outputs": {"evaluation": payload},
    }


def _retrieval_optimizer_node(state: AutopilotGraphState) -> dict[str, Any]:
    """P6-5: tune retrieval; write ``stage_outputs['retrieval']``."""

    merged = state.get("stage_outputs") or {}
    embedding = merged.get("embedding")
    chunking = merged.get("chunking")
    analyze = merged.get("analyze")
    if not embedding or embedding.get("status") != "complete":
        trace = {
            **_progress_row(state, stage_key="retrieval", detail="retrieval_skipped"),
            "event": "retrieval_optimizer",
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
            **_progress_row(state, stage_key="retrieval", detail="retrieval_skipped"),
            "event": "retrieval_optimizer",
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
            **_progress_row(state, stage_key="retrieval", detail="retrieval_skipped"),
            "event": "retrieval_optimizer",
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
        **_progress_row(state, stage_key="retrieval", detail="retrieval_optimizer"),
        "event": "retrieval_optimizer",
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
            **_progress_row(state, stage_key="embedding", detail="embedding_skipped"),
            "event": "embedding_tester",
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
            **_progress_row(state, stage_key="embedding", detail="embedding_skipped"),
            "event": "embedding_tester",
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
        **_progress_row(state, stage_key="embedding", detail="embedding_tester"),
        "event": "embedding_tester",
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
            **_progress_row(state, stage_key="chunking", detail="chunking_skipped"),
            "event": "chunking_optimizer",
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
        **_progress_row(state, stage_key="chunking", detail="chunking_optimizer"),
        "event": "chunking_optimizer",
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
        **_progress_row(state, stage_key="analyze", detail="document_analyst"),
        "event": "document_analyst",
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


def compile_autopilot_bootstrap_graph(*, checkpointer: MemorySaver | None = None) -> Any:
    """Compile Autopilot orchestrator graph: specialists, ``orchestration_gate``, optional retry loop, deployment."""  # noqa: E501

    graph = StateGraph(AutopilotGraphState)
    graph.add_node("bootstrap_prepare", _bootstrap_prepare)
    graph.add_node("bootstrap_finalize", _bootstrap_finalize)
    graph.add_node("document_analyst", _document_analyst_node)
    graph.add_node("chunking_optimizer", _chunking_optimizer_node)
    graph.add_node("embedding_tester", _embedding_tester_node)
    graph.add_node("retrieval_optimizer", _retrieval_optimizer_node)
    graph.add_node("evaluation_agent", _evaluation_agent_node)
    graph.add_node("orchestration_gate", _orchestration_gate_node)
    graph.add_node("deployment_agent", _deployment_agent_node)
    graph.set_entry_point("bootstrap_prepare")
    graph.add_edge("bootstrap_prepare", "bootstrap_finalize")
    graph.add_edge("bootstrap_finalize", "document_analyst")
    graph.add_edge("document_analyst", "chunking_optimizer")
    graph.add_edge("chunking_optimizer", "embedding_tester")
    graph.add_edge("embedding_tester", "retrieval_optimizer")
    graph.add_edge("retrieval_optimizer", "evaluation_agent")
    graph.add_edge("evaluation_agent", "orchestration_gate")
    graph.add_conditional_edges(
        "orchestration_gate",
        _route_post_gate,
        {
            "retry_chunking": "chunking_optimizer",
            "deploy": "deployment_agent",
        },
    )
    graph.add_edge("deployment_agent", END)
    compiled = graph.compile(checkpointer=checkpointer)
    logger.debug("autopilot_orchestrator_graph_compiled", checkpointer=bool(checkpointer))
    return compiled


def compile_autopilot_orchestrator_graph(*, checkpointer: MemorySaver | None = None) -> Any:
    """P6-8: same graph as bootstrap — linear specialists + evaluation gate + optional retry loop."""  # noqa: E501

    return compile_autopilot_bootstrap_graph(checkpointer=checkpointer)


def _safe_recursion_limit(state: AutopilotGraphState) -> int:
    """Compute a recursion limit that accommodates the configured max_iterations.

    Graph node counts per full run:
      8 fixed  (prepare + finalize + analyst + chunking + embedding + retrieval + evaluation + gate)
      5 × (max_iter - 1)  retry loops  (chunking → embedding → retrieval → evaluation → gate)
      6  final deployment pass          (same 5 + deployment node)
    Total = 8 + 5*(max_iter-1) + 6 = 9 + 5*max_iter
    We add a 10-node safety buffer so LangGraph never raises GraphRecursionError.
    """
    max_iter = _max_iterations_cap(state.get("requirements"))
    return 19 + 5 * max_iter


def invoke_autopilot_bootstrap(
    state: AutopilotGraphState,
    *,
    thread_id: str = "bootstrap-test",
    checkpointer: MemorySaver | None = None,
) -> AutopilotGraphState:
    """Run orchestrator graph (including evaluation gate and retries); return merged terminal state."""  # noqa: E501

    app = compile_autopilot_bootstrap_graph(checkpointer=checkpointer)
    recursion_limit = _safe_recursion_limit(state)
    if checkpointer is not None:
        cfg: RunnableConfig = {
            "configurable": {"thread_id": thread_id},
            "recursion_limit": recursion_limit,
        }
        result = app.invoke(state, config=cfg)
    else:
        result = app.invoke(state, config={"recursion_limit": recursion_limit})
    return cast(AutopilotGraphState, result)


def invoke_autopilot_orchestrator(
    state: AutopilotGraphState,
    *,
    thread_id: str = "orchestrator-test",
    checkpointer: MemorySaver | None = None,
) -> AutopilotGraphState:
    """P6-8 alias — run orchestrator graph with optional checkpointing."""

    return invoke_autopilot_bootstrap(state, thread_id=thread_id, checkpointer=checkpointer)
