"""Designer cost estimation service (P4-3)."""

from __future__ import annotations

from app.config import Settings
from app.schemas.designer import CostRequest
from app.schemas.pipeline import CostEstimateSchema
from app.utils.cost_calculator import CostEstimator, load_pricing


class CostService:
    """Wraps the pricing catalog and :class:`~app.utils.cost_calculator.CostEstimator`."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def estimate(self, body: CostRequest) -> CostEstimateSchema:
        pricing = load_pricing(self._settings)
        return CostEstimator(pricing).estimate(body)


def estimate_cost_or_raise(settings: Settings, body: CostRequest) -> CostEstimateSchema:
    """Load pricing and return estimate; raises :class:`PricingLoadError` if catalog missing."""
    return CostService(settings).estimate(body)
