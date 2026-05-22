"""Embedding model benchmarker.

EmbeddingBenchmarker evaluates multiple embedding configurations on the same
text corpus and ranks them by throughput. It is used by the Embedding Tester
Agent in Autopilot mode to select the best model given user-specified
quality/cost/latency targets.

Metrics collected per configuration:
  texts_per_second — throughput (higher = faster)
  avg_latency_ms   — mean per-text latency in milliseconds
  dimensions       — actual output dimensionality (may differ from config if
                     the provider ignores the field)
  total_time_s     — wall-clock seconds for the full corpus
"""

from dataclasses import dataclass
import time
from typing import cast

import structlog

from .strategies import EmbeddingConfig

logger = structlog.get_logger(__name__)


@dataclass
class BenchmarkResult:
    """Results from benchmarking one embedding configuration."""

    provider: str
    model: str
    dimensions: int
    total_texts: int
    total_time_s: float
    texts_per_second: float
    avg_latency_ms: float
    # First embedding vector returned — lets callers verify shape and type
    embedding_sample: list[float]


class EmbeddingBenchmarker:
    """Runs a speed/throughput benchmark across multiple EmbeddingConfig options.

    Typical usage (Autopilot agent):

        benchmarker = EmbeddingBenchmarker()
        configs = [
            EmbeddingConfig(provider="openai", model="text-embedding-3-small"),
            EmbeddingConfig(provider="huggingface", model="all-minilm-l6-v2"),
        ]
        results = benchmarker.benchmark(sample_texts, configs)
        best = results[0]  # sorted by texts_per_second descending
    """

    def benchmark(
        self,
        texts: list[str],
        configs: list[EmbeddingConfig],
    ) -> list[BenchmarkResult]:
        """Benchmark every config against the corpus and return ranked results.

        Configs that raise an exception (missing API key, model not found, etc.)
        are logged as warnings and excluded from the result list so the caller
        always receives a valid ranked list of working configurations.
        """
        results: list[BenchmarkResult] = []

        for config in configs:
            result = self._run_single(texts, config)
            if result is not None:
                results.append(result)

        results.sort(key=lambda r: r.texts_per_second, reverse=True)
        logger.info(
            "benchmark_complete",
            configs_tested=len(configs),
            results_returned=len(results),
        )
        return results

    def _run_single(
        self,
        texts: list[str],
        config: EmbeddingConfig,
    ) -> BenchmarkResult | None:
        """Benchmark a single config. Returns None if the provider errors."""
        # Import here to avoid circular reference (factory lives in __init__)
        from . import EmbedderFactory

        try:
            embedder = EmbedderFactory.from_provider(config.provider)

            start = time.perf_counter()
            embeddings = cast(list[list[float]], embedder.embed_documents(texts, config))
            elapsed = time.perf_counter() - start

            n = len(texts)
            sample = embeddings[0] if embeddings else []
            actual_dims = len(sample) if sample else config.dimensions

            return BenchmarkResult(
                provider=config.provider,
                model=config.model,
                dimensions=actual_dims,
                total_texts=n,
                total_time_s=round(elapsed, 4),
                texts_per_second=round(n / elapsed, 2) if elapsed > 0 else 0.0,
                avg_latency_ms=round((elapsed / n) * 1000, 2) if n > 0 else 0.0,
                embedding_sample=list(sample),
            )

        except Exception as exc:
            logger.warning(
                "benchmark_provider_failed",
                provider=config.provider,
                model=config.model,
                error=str(exc),
            )
            return None
