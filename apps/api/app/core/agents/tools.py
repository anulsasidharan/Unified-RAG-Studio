"""LangChain tools registered for Autopilot agents (P6-1 scaffolding + P6-2 analyst)."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import tool

from app.core.agents.document_analyst import (
    build_corpus_summary,
    recommend_chunking,
    run_document_analyst,
)


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


@tool
def document_corpus_analyze(document_ids_json: str, requirements_json: str) -> str:
    """Run the P6-2 document analyst and return JSON (corpus_summary + chunking_recommendation).

    ``document_ids_json`` must be a JSON array of string ids.
    ``requirements_json`` is a JSON object; optional ``corpus_profiles`` list refines heuristics.
    """

    try:
        ids_raw = json.loads(document_ids_json) if document_ids_json.strip() else []
    except json.JSONDecodeError as exc:
        return json.dumps({"error": "invalid document_ids_json", "detail": str(exc)})
    if not isinstance(ids_raw, list):
        return json.dumps({"error": "document_ids_json must be a JSON array"})
    document_ids = [str(x) for x in ids_raw]

    try:
        req = json.loads(requirements_json) if requirements_json.strip() else {}
    except json.JSONDecodeError as exc:
        return json.dumps({"error": "invalid requirements_json", "detail": str(exc)})
    if not isinstance(req, dict):
        return json.dumps({"error": "requirements_json must be a JSON object"})

    payload = run_document_analyst(document_ids=document_ids, requirements=req)
    return json.dumps(payload, ensure_ascii=False)


@tool
def summarize_corpus_profiles_json(profiles_json: str, requirements_json: str) -> str:
    """Summarize a JSON array of per-document profile dicts; returns JSON corpus_summary only."""

    try:
        raw = json.loads(profiles_json) if profiles_json.strip() else []
    except json.JSONDecodeError as exc:
        return json.dumps({"error": "invalid profiles_json", "detail": str(exc)})
    profiles = [p for p in raw if isinstance(p, dict)] if isinstance(raw, list) else []

    try:
        req = json.loads(requirements_json) if requirements_json.strip() else {}
    except json.JSONDecodeError as exc:
        return json.dumps({"error": "invalid requirements_json", "detail": str(exc)})
    if not isinstance(req, dict):
        return json.dumps({"error": "requirements_json must be a JSON object"})

    summary = build_corpus_summary(profiles, requirements=req)
    return json.dumps(summary, ensure_ascii=False)


@tool
def recommend_chunking_from_summary_json(summary_json: str, requirements_json: str) -> str:
    """Given a corpus_summary JSON object, return chunking_recommendation JSON."""

    try:
        summary = json.loads(summary_json) if summary_json.strip() else {}
    except json.JSONDecodeError as exc:
        return json.dumps({"error": "invalid summary_json", "detail": str(exc)})
    if not isinstance(summary, dict):
        return json.dumps({"error": "summary_json must be a JSON object"})

    try:
        req = json.loads(requirements_json) if requirements_json.strip() else {}
    except json.JSONDecodeError as exc:
        return json.dumps({"error": "invalid requirements_json", "detail": str(exc)})
    if not isinstance(req, dict):
        return json.dumps({"error": "requirements_json must be a JSON object"})

    rec = recommend_chunking(summary, requirements=req)
    return json.dumps(rec, ensure_ascii=False)


def get_autopilot_bootstrap_tools() -> list[Any]:
    """Tools bound to the bootstrap graph / future orchestrator LLM."""

    return [
        autopilot_health_ping,
        summarize_requirements_snapshot,
        document_corpus_analyze,
        summarize_corpus_profiles_json,
        recommend_chunking_from_summary_json,
    ]
