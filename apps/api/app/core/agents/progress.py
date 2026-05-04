"""Autopilot progress snapshots for agent_trace and worker/SSE consumers (P6-8)."""

from __future__ import annotations

from typing import Any

# Terminal percentage for each specialist stage (single-pass Autopilot graph).
_STAGE_BASE_PCT: dict[str, int] = {
    "analyze": 12,
    "chunking": 28,
    "embedding": 44,
    "retrieval": 60,
    "evaluation": 78,
    "deployment": 100,
}


def _clamp_pct(n: int) -> int:
    return max(0, min(100, n))


def autopilot_progress_percent(
    *,
    completed_stage_key: str | None,
    evaluation_pass_index: int,
    max_iterations: int,
) -> int:
    """0–100 progress for UI/SSE: fixed ladder per stage plus a small bump per optimisation pass.

    ``max_iterations`` is honoured only to cap the bump so very large limits do not distort the bar.
    """

    _ = max(1, min(10, int(max_iterations or 1)))
    ep = max(0, int(evaluation_pass_index or 0))
    if not completed_stage_key:
        return 2
    base = _STAGE_BASE_PCT.get(completed_stage_key, 8)
    if completed_stage_key == "deployment":
        return 100
    bump = min(12, ep * 3)
    return _clamp_pct(min(99, base + bump))


def progress_trace_fields(
    *,
    build_id: str,
    stage_key: str,
    detail: str,
    evaluation_pass_index: int,
    max_iterations: int,
) -> dict[str, Any]:
    """Common keys for ``agent_trace`` rows consumable as SSE-style progress."""

    pct = autopilot_progress_percent(
        completed_stage_key=stage_key,
        evaluation_pass_index=evaluation_pass_index,
        max_iterations=max_iterations,
    )
    return {
        "kind": "autopilot_progress",
        "build_id": build_id,
        "stage": stage_key,
        "progress": pct,
        "detail": detail,
        "evaluation_pass_index": evaluation_pass_index,
    }
