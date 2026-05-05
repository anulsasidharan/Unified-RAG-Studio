"""Usage and cost projection API (P11-3)."""

from __future__ import annotations

from fastapi import APIRouter

from app.dependencies import DbSession, RequestUserId
from app.schemas.analytics import AnalyticsSummarySchema
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _svc(session: DbSession) -> AnalyticsService:
    return AnalyticsService(session)


@router.get("/summary", response_model=AnalyticsSummarySchema, summary="Portfolio usage & cost signals")
async def analytics_summary(
    session: DbSession,
    user_id: RequestUserId,
) -> AnalyticsSummarySchema:
    """Aggregated counts for projects, configs, builds, evaluations, deployments, plus inferred cost."""
    return await _svc(session).summary_for_user(user_id)
