"""Evaluation HTTP API backing — P8-3.

Runs RAGAS via :class:`EvaluationEngine`, persists rows on ``evaluation_runs``,
and supports A/B comparison of two pipeline configurations.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from langchain_core.documents import Document
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.evaluation.compare import compare_metrics
from app.core.evaluation.pipeline_bridge import metric_names_from_pipeline
from app.core.evaluation.service import EvaluationEngine
from app.core.evaluation.strategies import EvaluationExample
from app.core.rag import run_guarded_rag_query
from app.models.evaluation_run import EvaluationRun
from app.models.pipeline_config import PipelineConfig
from app.models.project import Project
from app.schemas.evaluation import (
    CompareConfigsRequest,
    CompareConfigsResponse,
    EvaluationMetrics,
    EvaluationRunListResponse,
    EvaluationRunRequest,
    EvaluationRunResponse,
    FailureAnalysisResult,
    MetricDelta,
    TestSetEntry,
)
from app.schemas.pipeline import PipelineConfigurationSchema


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _synthetic_test_entries(n: int) -> list[TestSetEntry]:
    n = max(10, min(int(n), 500))
    corpus = (
        "RAG Studio evaluates pipelines with RAGAS faithfulness and relevance metrics. "
        "Chunking and retrieval strongly affect context precision. "
    ) * 30
    out: list[TestSetEntry] = []
    step = max(1, len(corpus) // n)
    for i in range(n):
        start = (i * step) % max(1, len(corpus) - 120)
        gt = corpus[start : start + 400]
        out.append(
            TestSetEntry(
                question=f"Summarize the main points described in support segment {i + 1}.",
                ground_truth=gt,
                context=None,
            )
        )
    return out


def _resolve_test_entries(body: EvaluationRunRequest) -> list[TestSetEntry]:
    if body.test_set is not None:
        if not body.test_set:
            raise ValueError("test_set must be non-empty when provided")
        return list(body.test_set)
    return _synthetic_test_entries(body.test_set_size)


def _metric_name_list(body: EvaluationRunRequest, pipeline: PipelineConfigurationSchema) -> list[str] | None:
    if body.metrics:
        return [m for m in body.metrics if m != "latency"]
    return metric_names_from_pipeline(pipeline.stages.evaluation)


async def _entry_to_example(
    pipeline: PipelineConfigurationSchema,
    entry: TestSetEntry,
) -> EvaluationExample:
    if entry.context:
        docs = [Document(page_content=c) for c in entry.context if (c or "").strip()]
        if not docs:
            docs = [Document(page_content=entry.ground_truth)]
    else:
        docs = [Document(page_content=entry.ground_truth)]

    out = await run_guarded_rag_query(
        query=entry.question,
        context_documents=docs,
        pipeline=pipeline,
    )
    answer = ""
    if out.allowed and out.generation:
        answer = out.generation.text or ""

    ctx_texts = [d.page_content or "" for d in out.documents_used if (d.page_content or "").strip()]
    if not ctx_texts:
        ctx_texts = [entry.ground_truth]

    return EvaluationExample(
        question=entry.question,
        answer=answer,
        contexts=ctx_texts,
        ground_truth=entry.ground_truth,
    )


def _row_to_response(row: EvaluationRun) -> EvaluationRunResponse:
    metrics = None
    if row.metrics:
        metrics = EvaluationMetrics.model_validate(row.metrics)
    failure = None
    if row.failure_analysis:
        failure = FailureAnalysisResult.model_validate(row.failure_analysis)
    st = row.status
    if st not in ("pending", "running", "complete", "failed"):
        st = "failed"
    return EvaluationRunResponse(
        run_id=str(row.id),
        config_id=str(row.config_id),
        status=st,  # type: ignore[arg-type]
        metrics=metrics,
        failure_analysis=failure,
        test_set_size=row.test_set_size,
        created_at=_iso(row.created_at),
        completed_at=_iso(row.completed_at) if row.completed_at else None,
        error=row.error,
    )


class EvaluationService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _owned_config(self, user_id: uuid.UUID, config_id: uuid.UUID) -> PipelineConfig | None:
        q = (
            select(PipelineConfig)
            .join(Project, PipelineConfig.project_id == Project.id)
            .where(PipelineConfig.id == config_id)
            .where(Project.user_id == user_id)
            .where(Project.deleted_at.is_(None))
        )
        return (await self._session.execute(q)).scalar_one_or_none()

    def _parse_pipeline(self, row: PipelineConfig) -> PipelineConfigurationSchema:
        cfg_dict = dict(row.config)
        cfg_dict["id"] = str(row.id)
        cfg_dict.setdefault("name", row.name)
        return PipelineConfigurationSchema.model_validate(cfg_dict)

    async def run_evaluation(
        self,
        user_id: uuid.UUID,
        body: EvaluationRunRequest,
    ) -> EvaluationRunResponse | None:
        try:
            cfg_uuid = uuid.UUID(body.config_id.strip())
        except ValueError:
            return None

        p_row = await self._owned_config(user_id, cfg_uuid)
        if p_row is None:
            return None

        pipeline = self._parse_pipeline(p_row)
        entries = _resolve_test_entries(body)

        metric_names = _metric_name_list(body, pipeline)
        test_set_size = len(entries)

        row = EvaluationRun(
            config_id=p_row.id,
            build_id=None,
            status="running",
            metrics=None,
            failure_analysis=None,
            test_set_size=test_set_size,
            error=None,
            completed_at=None,
        )
        self._session.add(row)
        await self._session.flush()

        try:
            examples: list[EvaluationExample] = []
            for ent in entries:
                examples.append(await _entry_to_example(pipeline, ent))

            engine = EvaluationEngine()
            eng_result = await engine.evaluate_async(
                examples,
                metric_names=metric_names,
                with_failure_analysis=True,
                raise_exceptions=False,
            )
            row.status = "complete"
            row.metrics = eng_result.metrics.model_dump(mode="json")
            if eng_result.failure_analysis:
                row.failure_analysis = eng_result.failure_analysis.model_dump(mode="json")
            row.completed_at = datetime.now(UTC)
            row.error = None
        except Exception as exc:  # noqa: BLE001 — persist failure on evaluation_runs
            row.status = "failed"
            row.error = str(exc)
            row.completed_at = datetime.now(UTC)

        await self._session.flush()
        return _row_to_response(row)

    async def get_run(self, user_id: uuid.UUID, run_id: uuid.UUID) -> EvaluationRunResponse | None:
        q = (
            select(EvaluationRun)
            .join(PipelineConfig, EvaluationRun.config_id == PipelineConfig.id)
            .join(Project, PipelineConfig.project_id == Project.id)
            .where(EvaluationRun.id == run_id)
            .where(Project.user_id == user_id)
            .where(Project.deleted_at.is_(None))
        )
        er = (await self._session.execute(q)).scalar_one_or_none()
        if er is None:
            return None
        return _row_to_response(er)

    async def list_runs(
        self,
        user_id: uuid.UUID,
        config_id: uuid.UUID,
        *,
        limit: int = 50,
    ) -> EvaluationRunListResponse | None:
        owner = await self._owned_config(user_id, config_id)
        if owner is None:
            return None

        q = (
            select(EvaluationRun)
            .where(EvaluationRun.config_id == config_id)
            .order_by(EvaluationRun.created_at.desc())
            .limit(min(max(limit, 1), 200))
        )
        rows = list((await self._session.execute(q)).scalars().all())
        items = [_row_to_response(r) for r in rows]
        cq = select(func.count()).select_from(EvaluationRun).where(EvaluationRun.config_id == config_id)
        total = int((await self._session.execute(cq)).scalar_one())
        return EvaluationRunListResponse(items=items, total=total)

    async def _metrics_from_completed_run(
        self,
        user_id: uuid.UUID,
        run_id: uuid.UUID,
        expected_config_id: uuid.UUID,
    ) -> EvaluationMetrics | None:
        er = await self.get_run(user_id, run_id)
        if er is None or er.config_id != str(expected_config_id):
            return None
        if er.status != "complete" or er.metrics is None:
            return None
        return er.metrics

    async def compare(
        self,
        user_id: uuid.UUID,
        body: CompareConfigsRequest,
    ) -> CompareConfigsResponse | None:
        try:
            cid_a = uuid.UUID(body.config_id_a.strip())
            cid_b = uuid.UUID(body.config_id_b.strip())
        except ValueError:
            return None

        row_a = await self._owned_config(user_id, cid_a)
        row_b = await self._owned_config(user_id, cid_b)
        if row_a is None or row_b is None:
            return None

        has_a = body.run_id_a is not None and str(body.run_id_a).strip() != ""
        has_b = body.run_id_b is not None and str(body.run_id_b).strip() != ""
        if has_a != has_b:
            raise ValueError("provide both run_id_a and run_id_b, or neither")

        pipeline_a = self._parse_pipeline(row_a)
        pipeline_b = self._parse_pipeline(row_b)

        if has_a and has_b:
            try:
                rida = uuid.UUID(str(body.run_id_a).strip())
                ridb = uuid.UUID(str(body.run_id_b).strip())
            except ValueError:
                return None
            m_a = await self._metrics_from_completed_run(user_id, rida, cid_a)
            m_b = await self._metrics_from_completed_run(user_id, ridb, cid_b)
            if m_a is None or m_b is None:
                return None
        else:
            probe = EvaluationRunRequest(
                config_id=str(cid_a),
                test_set=None,
                test_set_size=body.test_set_size,
                metrics=None,
            )
            entries = _resolve_test_entries(probe)
            req_a = EvaluationRunRequest(
                config_id=str(cid_a),
                test_set=entries,
                test_set_size=len(entries),
                metrics=None,
            )
            req_b = EvaluationRunRequest(
                config_id=str(cid_b),
                test_set=entries,
                test_set_size=len(entries),
                metrics=None,
            )

            out_a = await self.run_evaluation(user_id, req_a)
            out_b = await self.run_evaluation(user_id, req_b)
            if out_a is None or out_b is None:
                return None
            if out_a.status != "complete" or out_b.status != "complete":
                return None
            m_a = out_a.metrics
            m_b = out_b.metrics
            if m_a is None or m_b is None:
                return None

        deltas, overall = compare_metrics(m_a, m_b)
        summary = _compare_summary(overall, deltas, str(cid_a), str(cid_b))
        return CompareConfigsResponse(
            config_id_a=str(cid_a),
            config_id_b=str(cid_b),
            metrics_a=m_a,
            metrics_b=m_b,
            deltas=deltas,
            overall_winner=overall,
            summary=summary,
        )


def _compare_summary(
    overall: str,
    deltas: list[MetricDelta],
    id_a: str,
    id_b: str,
) -> str:
    short_a = id_a[:8]
    short_b = id_b[:8]
    lead = (
        f"Overall winner: configuration {'A' if overall == 'a' else 'B' if overall == 'b' else 'tie'} "
        f"(A={short_a}…, B={short_b}…)."
    )
    parts: list[str] = [lead]
    for d in deltas:
        if d.winner == "tie":
            parts.append(f"{d.metric}: tie.")
        elif d.metric == "avg_latency_ms":
            parts.append(
                f"{d.metric}: {'A' if d.winner == 'a' else 'B'} (lower is better; Δ={d.delta:+.2f} ms)."
            )
        else:
            parts.append(f"{d.metric}: {'A' if d.winner == 'a' else 'B'} (Δ={d.delta:+.4f}).")
    return " ".join(parts)
