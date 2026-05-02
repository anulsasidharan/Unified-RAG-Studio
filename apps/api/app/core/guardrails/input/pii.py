"""PII detection and redaction for user input — P4.5-2."""

from __future__ import annotations

import re
from typing import Any

from app.core.guardrails.base import Guardrail
from app.core.guardrails.types import (
    GuardrailAction,
    GuardrailContext,
    GuardrailResult,
    GuardrailStage,
)

# ── Regex (conservative; tune for locale in production) ───────────────────────

_EMAIL_RE = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
)
# US-style SSN; avoid matching arbitrary 9-digit IDs where possible
_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
# Phone: optional +, groups of digits with separators
_PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b",
)
# Credit-card-like runs (digits + spaces); validated with Luhn when 13–19 digits
_CARD_CANDIDATE_RE = re.compile(r"\b(?:\d[ -]*?){13,19}\b")


def _luhn_valid(digits: str) -> bool:
    if len(digits) < 13 or len(digits) > 19:
        return False
    s = 0
    alt = False
    for ch in reversed(digits):
        if not ch.isdigit():
            continue
        n = int(ch)
        if alt:
            n *= 2
            if n > 9:
                n -= 9
        s += n
        alt = not alt
    return s % 10 == 0


def _normalize_card_candidate(raw: str) -> str | None:
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) < 13:
        return None
    if _luhn_valid(digits):
        return digits
    return None


class PiiRedactionGuardrail(Guardrail):
    """Redacts common PII patterns in string payloads (MODIFY).

    Runs on ``GuardrailStage.INPUT`` only. Non-string payloads are passed through
    with ``ALLOW``.
    """

    def __init__(
        self,
        *,
        redact_email: bool = True,
        redact_phone: bool = True,
        redact_ssn: bool = True,
        redact_card: bool = True,
        name: str = "pii-redaction",
    ) -> None:
        self._name = name
        self._redact_email = redact_email
        self._redact_phone = redact_phone
        self._redact_ssn = redact_ssn
        self._redact_card = redact_card

    @property
    def name(self) -> str:
        return self._name

    @property
    def stage(self) -> GuardrailStage:
        return GuardrailStage.INPUT

    def check(self, payload: Any, *, context: GuardrailContext | None = None) -> GuardrailResult:
        if not isinstance(payload, str):
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.ALLOW,
                metadata={"skipped": "non_string_payload"},
            )

        text = payload
        counts: dict[str, int] = {}

        if self._redact_email:
            text, n = _EMAIL_RE.subn("[REDACTED_EMAIL]", text)
            if n:
                counts["email"] = counts.get("email", 0) + n

        if self._redact_ssn:
            text, n = _SSN_RE.subn("[REDACTED_SSN]", text)
            if n:
                counts["ssn"] = counts.get("ssn", 0) + n

        # Card before phone so contiguous PAN digits are not partially matched as a phone.
        if self._redact_card:

            def _sub_card(m: re.Match[str]) -> str:
                raw = m.group(0)
                if _normalize_card_candidate(raw):
                    return "[REDACTED_CARD]"
                return raw

            card_hits = sum(
                1
                for m in _CARD_CANDIDATE_RE.finditer(text)
                if _normalize_card_candidate(m.group(0))
            )
            if card_hits:
                text = _CARD_CANDIDATE_RE.sub(_sub_card, text)
                counts["card"] = counts.get("card", 0) + card_hits

        if self._redact_phone:
            text, n = _PHONE_RE.subn("[REDACTED_PHONE]", text)
            if n:
                counts["phone"] = counts.get("phone", 0) + n

        if text == payload:
            return GuardrailResult(
                guardrail_name=self.name,
                stage=self.stage,
                action=GuardrailAction.ALLOW,
                metadata=counts,
            )

        return GuardrailResult(
            guardrail_name=self.name,
            stage=self.stage,
            action=GuardrailAction.MODIFY,
            message="PII patterns redacted from input",
            metadata=counts,
            payload_override=text,
        )
