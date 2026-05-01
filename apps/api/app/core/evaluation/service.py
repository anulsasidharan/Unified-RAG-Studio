"""Evaluation Engine — P2-7.

Runs RAGAS metrics over batched examples, optional failure clustering, and exposes
helpers for A/B comparison and synthetic test rows.
"""

from __future__ import annotations

import asyncio
import importlib
import time
from typing import Any

import structlog
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import SecretStr

from app.config import Settings, get_settings

from .failure_analysis import analyze_failures
from .ragas_bridge import (
    build_dataset,
    load_ragas_metrics,
    ragas_dict_to_evaluation_metrics,
    resolve_ragas_metric_names,
)
from .strategies import EvaluationEngineResult, EvaluationExample

logger = structlog.get_logger(__name__)


class EvaluationEngine:
    """RAGAS-backed evaluation with OpenAI chat + embeddings (configurable models)."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    def _build_models(self) -> tuple[ChatOpenAI, OpenAIEmbeddings]:
        key = SecretStr(self._settings.openai_api_key) if self._settings.openai_api_key else None
        llm_kw: dict[str, Any] = {
            "model": self._settings.evaluation_llm_model,
            "temperature": 0.0,
            "api_key": key,
        }
        emb_kw: dict[str, Any] = {
            "model": self._settings.evaluation_embedding_model,
            "api_key": key,
        }
        llm = ChatOpenAI(**llm_kw)
        emb = OpenAIEmbeddings(**emb_kw)
        return llm, emb

    def evaluate(
        self,
        examples: list[EvaluationExample],
        *,
        metric_names: list[str] | None = None,
        with_failure_analysis: bool = True,
        raise_exceptions: bool = False,
        run_config: Any | None = None,
    ) -> EvaluationEngineResult:
        """Run RAGAS on the batch; attach average wall-clock latency per query."""
        if not examples:
            from app.schemas.evaluation import EvaluationMetrics

            return EvaluationEngineResult(
                metrics=EvaluationMetrics(
                    faithfulness=0.0,
                    answer_relevance=0.0,
                    context_precision=0.0,
                    context_recall=0.0,
                    avg_latency_ms=0.0,
                    cost_per_query=None,
                ),
                failure_analysis=None,
                per_row_scores=[],
            )

        resolved = resolve_ragas_metric_names(metric_names)

        ragas_evaluate = importlib.import_module("ragas").evaluate

        ds = build_dataset(
            questions=[e.question for e in examples],
            answers=[e.answer for e in examples],
            contexts=[e.contexts for e in examples],
            ground_truths=[e.ground_truth for e in examples],
        )
        metrics = load_ragas_metrics(resolved)
        llm, emb = self._build_models()
        rc = run_config

        t0 = time.perf_counter()
        result = ragas_evaluate(
            ds,
            metrics=metrics,
            llm=llm,
            embeddings=emb,
            raise_exceptions=raise_exceptions,
            run_config=rc,
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        avg_latency = elapsed_ms / len(examples)

        agg = ragas_dict_to_evaluation_metrics(
            dict(result),
            avg_latency_ms=avg_latency,
            cost_per_query=None,
        )

        per_rows: list[dict[str, object]] = []
        failure = None
        if with_failure_analysis:
            try:
                pdf = result.to_pandas()
                for _, row in pdf.iterrows():
                    rec: dict[str, object] = {
                        "question": row.get("question", ""),
                        "answer": row.get("answer", ""),
                    }
                    for col in ("faithfulness", "answer_relevancy", "context_precision", "context_recall"):
                        if col in row.index:
                            v = row[col]
                            try:
                                rec[col] = float(v)
                            except (TypeError, ValueError):
                                rec[col] = 0.0
                    per_rows.append(rec)
                failure = analyze_failures(per_rows)
            except Exception as exc:  # noqa: BLE001 — degrade if pandas merge fails
                logger.warning("failure_analysis_skipped", error=str(exc))

        logger.info(
            "evaluation_complete",
            rows=len(examples),
            faithfulness=agg.faithfulness,
            answer_relevance=agg.answer_relevance,
        )
        return EvaluationEngineResult(
            metrics=agg,
            failure_analysis=failure,
            per_row_scores=per_rows,
        )

    async def evaluate_async(
        self,
        examples: list[EvaluationExample],
        *,
        metric_names: list[str] | None = None,
        with_failure_analysis: bool = True,
        raise_exceptions: bool = False,
        run_config: Any | None = None,
    ) -> EvaluationEngineResult:
        """Async wrapper (thread offload) for FastAPI handlers."""
        return await asyncio.to_thread(
            self.evaluate,
            examples,
            metric_names=metric_names,
            with_failure_analysis=with_failure_analysis,
            raise_exceptions=raise_exceptions,
            run_config=run_config,
        )
