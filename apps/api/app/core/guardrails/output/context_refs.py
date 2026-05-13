"""Shared helpers to read grounding metadata from GuardrailContext — P4.5-3."""

from __future__ import annotations

from app.core.guardrails.types import GuardrailContext


def reference_texts_from_context(context: GuardrailContext | None) -> tuple[str, ...]:
    """Return retrieved passage strings from ``context.extra['reference_texts']``.

    Accepted shapes: ``list[str]``, ``tuple[str, ...]``, or omitted / empty → ``()``.
    """
    if context is None or not context.extra:
        return ()
    raw = context.extra.get("reference_texts")
    if raw is None:
        return ()
    if isinstance(raw, list | tuple):
        out: list[str] = []
        for x in raw:
            s = str(x).strip()
            if s:
                out.append(s)
        return tuple(out)
    return ()


def citation_source_count(context: GuardrailContext | None, refs: tuple[str, ...]) -> int:
    """Maximum valid citation index (1-based): ``extra['citation_source_count']`` or len(*refs*)."""

    if context and context.extra:
        raw = context.extra.get("citation_source_count")
        if isinstance(raw, int) and raw >= 0:
            return raw
    return len(refs)
