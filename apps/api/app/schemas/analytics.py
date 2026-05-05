"""Usage and cost projection aggregates for analytics API (P11-3)."""

from __future__ import annotations

from pydantic import Field

from app.schemas.pipeline import RAGBaseModel


class CountBreakdownSchema(RAGBaseModel):
    """Counts keyed by status or category string."""

    counts: dict[str, int] = Field(default_factory=dict)


class CostSignalsSchema(RAGBaseModel):
    """Lightweight spend signals inferred from persisted Autopilot rows."""

    avg_cost_per_query_usd: float | None = None
    builds_with_cost_sample: int = Field(ge=0, default=0)
    avg_budget_constraint_usd_per_1k_queries: float | None = None
    builds_with_budget_sample: int = Field(ge=0, default=0)


class AnalyticsSummarySchema(RAGBaseModel):
    """Portfolio-level usage snapshot for dashboards."""

    projects: int = Field(ge=0)
    pipeline_configs: int = Field(ge=0)
    autopilot_builds: CountBreakdownSchema
    evaluation_runs: CountBreakdownSchema
    deployments: CountBreakdownSchema
    documents_uploaded_recent_builds_hint: int = Field(
        ge=0,
        description=(
            "Sum of ``len(document_ids)`` from autopilot_builds.requirements for the scoped user — "
            "best-effort usage proxy, not S3 billing."
        ),
    )
    cost_signals: CostSignalsSchema
