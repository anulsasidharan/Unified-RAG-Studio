"""Chunk quality scoring for the chunking pipeline.

ChunkQualityScorer evaluates individual chunks on three dimensions:

  content_density  — proportion of non-whitespace characters (higher = denser)
  completeness     — whether the chunk ends with sentence-ending punctuation
  size_score       — proximity of chunk character length to a target_size

These metrics help the Autopilot agent identify and filter low-quality chunks
before they reach the embedding step.
"""

import re
from dataclasses import dataclass

import structlog
from langchain_core.documents import Document

logger = structlog.get_logger(__name__)

_SENTENCE_END_RE = re.compile(r"[.!?]\s*$")


@dataclass
class ChunkQualityMetrics:
    """Quality metrics computed for a single chunk Document."""

    content_density: float  # 0.0–1.0 — proportion of non-whitespace characters
    completeness: float     # 0.0 or 1.0 — ends with sentence-ending punctuation
    size_score: float       # 0.0–1.0 — closeness to target_size (1.0 = exact match)
    overall: float          # weighted average of the three dimensions


class ChunkQualityScorer:
    """Scores chunks and optionally filters those below a quality threshold.

    Args:
        target_size:          Expected chunk character count for size scoring.
        density_weight:       Contribution of content_density to overall score.
        completeness_weight:  Contribution of completeness to overall score.
        size_weight:          Contribution of size_score to overall score.

    The three weights must sum to 1.0.
    """

    def __init__(
        self,
        *,
        target_size: int = 512,
        density_weight: float = 0.4,
        completeness_weight: float = 0.3,
        size_weight: float = 0.3,
    ) -> None:
        if abs(density_weight + completeness_weight + size_weight - 1.0) > 1e-6:
            raise ValueError("density_weight + completeness_weight + size_weight must equal 1.0")
        self._target_size = target_size
        self._w_density = density_weight
        self._w_completeness = completeness_weight
        self._w_size = size_weight

    def score(self, chunk: Document) -> ChunkQualityMetrics:
        """Compute quality metrics for a single chunk Document."""
        text = chunk.page_content

        if not text:
            return ChunkQualityMetrics(0.0, 0.0, 0.0, 0.0)

        # Content density — proportion of non-whitespace characters
        non_ws = sum(1 for c in text if not c.isspace())
        density = non_ws / len(text)

        # Completeness — chunk ends with sentence-ending punctuation
        completeness = 1.0 if _SENTENCE_END_RE.search(text) else 0.0

        # Size score — linear decay from 1.0 at target_size toward 0.0
        deviation = abs(len(text) - self._target_size) / max(self._target_size, 1)
        size_score = max(0.0, 1.0 - deviation)

        overall = (
            self._w_density * density
            + self._w_completeness * completeness
            + self._w_size * size_score
        )

        return ChunkQualityMetrics(
            content_density=round(density, 4),
            completeness=completeness,
            size_score=round(size_score, 4),
            overall=round(overall, 4),
        )

    def score_batch(self, chunks: list[Document]) -> list[ChunkQualityMetrics]:
        """Score a list of chunks and return a parallel list of metrics."""
        return [self.score(c) for c in chunks]

    def filter_low_quality(
        self,
        chunks: list[Document],
        *,
        min_score: float = 0.5,
    ) -> list[Document]:
        """Return only chunks whose overall score is >= min_score."""
        kept: list[Document] = []
        for chunk in chunks:
            metrics = self.score(chunk)
            if metrics.overall >= min_score:
                kept.append(chunk)
            else:
                logger.debug(
                    "chunk_filtered_low_quality",
                    score=metrics.overall,
                    strategy=chunk.metadata.get("chunk_strategy"),
                    preview=chunk.page_content[:40],
                )
        return kept
