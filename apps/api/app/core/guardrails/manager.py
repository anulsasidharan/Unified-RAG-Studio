"""Register guardrails and run them in order for a stage — P4.5-1."""

from __future__ import annotations

from typing import Any

import structlog

from .base import Guardrail
from .types import (
    GuardrailAction,
    GuardrailContext,
    GuardrailPipelineResult,
    GuardrailResult,
    GuardrailStage,
)

logger = structlog.get_logger(__name__)


class GuardrailManager:
    """Ordered registry of guardrails per :class:`GuardrailStage`.

    Execution policy:

    * Run checks in registration order.
    * ``BLOCK`` — stop immediately; ``allowed`` is False.
    * ``MODIFY`` with ``payload_override`` — replace payload for subsequent checks
      and for ``final_payload`` if the stage completes.
    * ``WARN`` / ``ALLOW`` — continue with the current payload.
    """

    def __init__(self) -> None:
        self._by_stage: dict[GuardrailStage, list[Guardrail]] = {s: [] for s in GuardrailStage}

    def register(self, guardrail: Guardrail, *, first: bool = False) -> None:
        """Add a guardrail to its stage. With *first* True, insert at the front."""
        stage = guardrail.stage
        if first:
            self._by_stage[stage].insert(0, guardrail)
        else:
            self._by_stage[stage].append(guardrail)

    def clear_stage(self, stage: GuardrailStage) -> None:
        """Remove all guardrails for *stage* (mainly for tests)."""
        self._by_stage[stage].clear()

    def guardrails_for(self, stage: GuardrailStage) -> tuple[Guardrail, ...]:
        """Return registered guardrails for *stage* (immutable snapshot)."""
        return tuple(self._by_stage[stage])

    def run_stage(
        self,
        stage: GuardrailStage,
        payload: Any,
        *,
        context: GuardrailContext | None = None,
    ) -> GuardrailPipelineResult:
        """Execute all guardrails for *stage* in order."""
        current = payload
        results: list[GuardrailResult] = []

        for g in self._by_stage[stage]:
            res = g.check(current, context=context)
            results.append(res)

            log_kwargs: dict[str, object] = {
                "guardrail": res.guardrail_name,
                "stage": stage.value,
                "action": res.action.value,
            }
            if context and context.request_id:
                log_kwargs["request_id"] = context.request_id
            logger.info("guardrail_check", **log_kwargs)

            if res.action == GuardrailAction.BLOCK:
                return GuardrailPipelineResult(
                    allowed=False,
                    final_payload=current,
                    results=tuple(results),
                    blocked_by=res.guardrail_name,
                )

            if res.action == GuardrailAction.MODIFY and res.payload_override is not None:
                current = res.payload_override

        return GuardrailPipelineResult(
            allowed=True,
            final_payload=current,
            results=tuple(results),
            blocked_by=None,
        )
