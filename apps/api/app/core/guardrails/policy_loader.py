"""Optional JSON operator policies for INPUT / RETRIEVAL guardrails — P4.5-7.

Paths are read from :class:`app.config.Settings`. When unset or the file is
missing, built-in defaults (self-test markers only) apply unchanged.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import logging
from pathlib import Path
import re
from typing import Any

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ToxicityPolicyData:
    blocked_terms: frozenset[str]
    extra_patterns: tuple[re.Pattern[str], ...]


@dataclass(frozen=True)
class ContentFilterPolicyData:
    blocked_terms: frozenset[str]
    extra_patterns: tuple[re.Pattern[str], ...]


@dataclass(frozen=True)
class BiasPolicyData:
    patterns: tuple[re.Pattern[str], ...]


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _compile_regex_list(raw: list[Any], *, context: str) -> tuple[re.Pattern[str], ...]:
    out: list[re.Pattern[str]] = []
    for item in raw:
        s = str(item).strip()
        if not s:
            continue
        try:
            out.append(re.compile(s))
        except re.error as e:
            raise ValueError(f"{context}: invalid regex {s!r}: {e}") from e
    return tuple(out)


def load_toxicity_operator_policy(
    path_str: str,
    *,
    default_extra: tuple[re.Pattern[str], ...],
) -> ToxicityPolicyData | None:
    if not (path_str or "").strip():
        return None
    path = Path(path_str).expanduser().resolve()
    if not path.is_file():
        logger.warning("Guardrails toxicity policy path set but file not found: %s", path)
        return None
    raw = _read_json(path)
    terms = frozenset(str(x).strip() for x in raw.get("blocked_terms", []) if str(x).strip())
    compiled = _compile_regex_list(list(raw.get("regex_patterns", [])), context="toxicity policy")
    extra = compiled + default_extra
    return ToxicityPolicyData(blocked_terms=terms, extra_patterns=extra)


def load_content_filter_operator_policy(
    path_str: str,
    *,
    default_extra: tuple[re.Pattern[str], ...],
) -> ContentFilterPolicyData | None:
    if not (path_str or "").strip():
        return None
    path = Path(path_str).expanduser().resolve()
    if not path.is_file():
        logger.warning("Guardrails content-filter policy path set but file not found: %s", path)
        return None
    raw = _read_json(path)
    terms = frozenset(str(x).strip() for x in raw.get("blocked_terms", []) if str(x).strip())
    compiled = _compile_regex_list(
        list(raw.get("regex_patterns", [])),
        context="content-filter policy",
    )
    extra = compiled + default_extra
    return ContentFilterPolicyData(blocked_terms=terms, extra_patterns=extra)


def load_bias_operator_policy(
    path_str: str,
    *,
    default_patterns: tuple[re.Pattern[str], ...],
) -> BiasPolicyData | None:
    if not (path_str or "").strip():
        return None
    path = Path(path_str).expanduser().resolve()
    if not path.is_file():
        logger.warning("Guardrails bias patterns path set but file not found: %s", path)
        return None
    raw = _read_json(path)
    compiled = _compile_regex_list(list(raw.get("regex_patterns", [])), context="bias policy")
    patterns = compiled + default_patterns
    return BiasPolicyData(patterns=patterns)
