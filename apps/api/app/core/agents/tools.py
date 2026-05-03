"""LangChain tools registered for Autopilot agents (P6-1 scaffolding).

P6-2+ replace stub implementations with calls into ingestion, chunking, embedding, retrieval, and evaluation services.
"""

from __future__ import annotations

from typing import Any

from langchain_core.tools import tool


@tool
def autopilot_health_ping() -> str:
    """Returns a fixed marker proving the tool registry is wired. Used in CI."""

    return "autopilot_tools_ok"


@tool
def summarize_requirements_snapshot(requirements_json: str) -> str:
    """Echo a short summary string for a JSON-encoded BuildRequirements object (stub).

    Real implementation should ``model_validate`` JSON and surface targets/constraints.
    """

    if not requirements_json.strip():
        return "empty_requirements"
    return f"requirements_bytes={len(requirements_json.encode('utf-8'))}"


def get_autopilot_bootstrap_tools() -> list[Any]:
    """Tools bound to the bootstrap graph / future orchestrator LLM."""

    return [autopilot_health_ping, summarize_requirements_snapshot]
