"""Text preprocessing utilities for document ingestion.

Preprocessors clean raw extracted text before it reaches the chunker.
All functions are pure — they accept a string and return a string.
The TextPreprocessor class chains transforms in a configurable pipeline.
"""

import re
import unicodedata

import structlog

logger = structlog.get_logger(__name__)


# ── Individual transforms ──────────────────────────────────────────────────────


def strip_html_tags(text: str) -> str:
    """Remove any residual HTML/XML tags from text (post-extraction safety net)."""
    return re.sub(r"<[^>]+>", "", text)


def normalize_whitespace(text: str) -> str:
    """Collapse runs of whitespace; preserve paragraph breaks (double newlines)."""
    # Cap sequences of 3+ newlines to a double newline
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse inline whitespace (spaces, tabs) to a single space
    text = re.sub(r"[ \t]+", " ", text)
    # Strip trailing whitespace from each line
    lines = [line.rstrip() for line in text.split("\n")]
    return "\n".join(lines).strip()


def fix_encoding(text: str) -> str:
    """Normalise Unicode to NFC and strip null bytes common in PDF extractions."""
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\x00", "")
    return text


def remove_headers_footers(text: str, *, min_occurrences: int = 3) -> str:
    """Heuristically strip repeated header/footer lines across PDF page breaks.

    Pages are identified by form-feed characters (\\f). Lines appearing
    identically at the top/bottom of at least `min_occurrences` pages
    are treated as headers/footers and removed.
    """
    pages = text.split("\f")
    if len(pages) < min_occurrences:
        return text

    # Count how often each short line appears at page boundaries
    line_counts: dict[str, int] = {}
    for page in pages:
        lines = [line.strip() for line in page.strip().splitlines()]
        # Inspect only the first and last 3 lines of each page
        candidates = lines[:3] + lines[-3:]
        for line in candidates:
            if len(line) > 5:
                line_counts[line] = line_counts.get(line, 0) + 1

    repeated = {line for line, count in line_counts.items() if count >= min_occurrences}

    if not repeated:
        return text

    cleaned: list[str] = []
    for page in pages:
        filtered = [line for line in page.splitlines() if line.strip() not in repeated]
        cleaned.append("\n".join(filtered))

    logger.debug("headers_footers_removed", patterns=len(repeated))
    return "\f".join(cleaned)


# ── Pipeline class ─────────────────────────────────────────────────────────────


class TextPreprocessor:
    """Applies a configurable sequence of text cleaning transforms.

    Each transform can be individually enabled or disabled to match the
    characteristics of the source format.
    """

    def __init__(
        self,
        *,
        strip_html: bool = False,
        normalize_whitespace_: bool = True,
        fix_encoding_: bool = True,
        remove_headers_footers_: bool = False,
    ) -> None:
        self._strip_html = strip_html
        self._normalize_whitespace = normalize_whitespace_
        self._fix_encoding = fix_encoding_
        self._remove_headers_footers = remove_headers_footers_

    def preprocess(self, text: str) -> str:
        """Apply all enabled transforms in sequence and return cleaned text."""
        if self._fix_encoding:
            text = fix_encoding(text)
        if self._strip_html:
            text = strip_html_tags(text)
        if self._remove_headers_footers:
            text = remove_headers_footers(text)
        if self._normalize_whitespace:
            text = normalize_whitespace(text)
        return text

    @classmethod
    def from_config(cls, config: dict) -> "TextPreprocessor":
        """Construct from a DataIngestionPreprocessingSchema-compatible dict."""
        return cls(
            strip_html=config.get("strip_html", False),
            normalize_whitespace_=config.get("normalize_whitespace", True),
            fix_encoding_=True,  # Always applied regardless of config
            remove_headers_footers_=config.get("remove_headers_footers", False),
        )
