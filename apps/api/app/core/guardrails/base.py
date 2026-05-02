"""Abstract guardrail contract — P4.5-1."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from .types import GuardrailContext, GuardrailResult, GuardrailStage


class Guardrail(ABC):
    """One safety or policy check at a defined pipeline stage.

    Implementations return a :class:`GuardrailResult`. When ``action`` is
    ``MODIFY`` and ``payload_override`` is set, the manager replaces the
    in-flight payload before the next guardrail runs. ``BLOCK`` stops the stage.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Stable identifier for logging and metrics."""

    @property
    @abstractmethod
    def stage(self) -> GuardrailStage:
        """Pipeline stage this guardrail belongs to."""

    @abstractmethod
    def check(self, payload: Any, *, context: GuardrailContext | None = None) -> GuardrailResult:
        """Inspect (and optionally transform) *payload* for this stage."""
