"""Aggregate DB-backed usage metrics for observability dashboards (P11-3)."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.build_history import AutopilotBuild
from app.models.deployment import Deployment
from app.models.evaluation_run import EvaluationRun
from app.models.pipeline_config import PipelineConfig
from app.models.project import Project
from app.schemas.analytics import (
    AnalyticsSummarySchema,
    CostSignalsSchema,
    CountBreakdownSchema,
)


def _sum_counts(rows: Sequence[tuple[str, int]]) -> dict[str, int]:
    return {str(status): int(n) for status, n in rows}


def _scoped_user(user_id: uuid.UUID) -> Any:
    return (Project.user_id == user_id, Project.deleted_at.is_(None))


class AnalyticsService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def summary_for_user(self, user_id: uuid.UUID) -> AnalyticsSummarySchema:
        scoped = _scoped_user(user_id)

        n_projects = int(
            (
                await self._session.execute(
                    select(func.count()).select_from(Project).where(*scoped),
                )
            ).scalar_one()
        )

        n_configs = int(
            (
                await self._session.execute(
                    select(func.count())
                    .select_from(PipelineConfig)
                    .join(Project, PipelineConfig.project_id == Project.id)
                    .where(*scoped),
                )
            ).scalar_one()
        )

        ab_q = (
            select(AutopilotBuild.status, func.count())
            .join(Project, AutopilotBuild.project_id == Project.id)
            .where(*scoped)
            .group_by(AutopilotBuild.status)
        )
        ab_rows = (await self._session.execute(ab_q)).all()

        ev_q = (
            select(EvaluationRun.status, func.count())
            .select_from(EvaluationRun)
            .join(PipelineConfig, EvaluationRun.config_id == PipelineConfig.id)
            .join(Project, PipelineConfig.project_id == Project.id)
            .where(*scoped)
            .group_by(EvaluationRun.status)
        )
        ev_rows = (await self._session.execute(ev_q)).all()

        dep_q = (
            select(Deployment.status, func.count())
            .select_from(Deployment)
            .join(PipelineConfig, Deployment.config_id == PipelineConfig.id)
            .join(Project, PipelineConfig.project_id == Project.id)
            .where(*scoped)
            .group_by(Deployment.status)
        )
        dep_rows = (await self._session.execute(dep_q)).all()

        docs_hint_q = (
            select(AutopilotBuild.requirements)
            .join(Project, AutopilotBuild.project_id == Project.id)
            .where(*scoped)
        )
        req_rows = (await self._session.execute(docs_hint_q)).scalars().all()
        doc_hint = _sum_document_ids(req_rows)

        cost = await self._cost_signals(user_id=user_id)

        return AnalyticsSummarySchema(
            projects=n_projects,
            pipeline_configs=n_configs,
            autopilot_builds=CountBreakdownSchema(counts=_sum_counts(ab_rows)),  # type: ignore[arg-type]
            evaluation_runs=CountBreakdownSchema(counts=_sum_counts(ev_rows)),  # type: ignore[arg-type]
            deployments=CountBreakdownSchema(counts=_sum_counts(dep_rows)),  # type: ignore[arg-type]
            documents_uploaded_recent_builds_hint=doc_hint,
            cost_signals=cost,
        )

    async def _cost_signals(self, *, user_id: uuid.UUID) -> CostSignalsSchema:
        scoped = _scoped_user(user_id)
        q = (
            select(AutopilotBuild.requirements, AutopilotBuild.result, AutopilotBuild.status)
            .join(Project, AutopilotBuild.project_id == Project.id)
            .where(*scoped)
        )
        rows = (await self._session.execute(q)).all()

        cost_samples: list[float] = []
        budget_samples: list[float] = []
        builds_with_budget = 0

        for requirements, result, status in rows:
            if isinstance(requirements, dict):
                raw_b = requirements.get("budget_constraint")
                if isinstance(raw_b, int | float) and raw_b > 0:
                    budget_samples.append(float(raw_b))
                    builds_with_budget += 1

            if status != "complete" or not isinstance(result, dict):
                continue

            cq = _extract_cost_per_query(result)
            if cq is not None:
                cost_samples.append(cq)

        avg_cost = sum(cost_samples) / len(cost_samples) if cost_samples else None
        avg_budget = sum(budget_samples) / len(budget_samples) if budget_samples else None

        return CostSignalsSchema(
            avg_cost_per_query_usd=_round_optional(avg_cost),
            builds_with_cost_sample=len(cost_samples),
            avg_budget_constraint_usd_per_1k_queries=_round_optional(avg_budget),
            builds_with_budget_sample=builds_with_budget,
        )


def _extract_cost_per_query(result: dict[str, Any]) -> float | None:
    metrics = result.get("metrics")
    if not isinstance(metrics, dict):
        return None
    raw = metrics.get("cost_per_query")
    if isinstance(raw, int | float) and raw >= 0:
        return float(raw)
    return None


def _sum_document_ids(requirements_payloads: Sequence[Any]) -> int:
    total = 0
    for payload in requirements_payloads:
        if not isinstance(payload, dict):
            continue
        ids = payload.get("document_ids")
        if isinstance(ids, list):
            total += len(ids)
    return total


def _round_optional(x: float | None) -> float | None:
    if x is None:
        return None
    return round(x, 6)
