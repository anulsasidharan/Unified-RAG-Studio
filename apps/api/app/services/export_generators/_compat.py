"""Helpers for Pydantic models that may store StrEnum fields as plain strings."""


def ev(x: object) -> str:
    """Return the canonical string for a StrEnum or an already-resolved string."""
    if isinstance(x, str):
        return x
    return getattr(x, "value", str(x))
