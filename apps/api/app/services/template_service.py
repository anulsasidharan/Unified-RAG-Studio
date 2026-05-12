"""Load pipeline templates from ``data/templates.json`` and apply to projects (P4-5)."""

from __future__ import annotations

import json
import uuid
from functools import lru_cache
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.schemas.designer import SaveConfigRequest
from app.schemas.templates import (
    ApplyTemplateRequest,
    ApplyTemplateResponse,
    PipelineTemplate,
    TemplatesCatalogResponse,
)
from app.services.designer_service import DesignerService


class TemplatesCatalogError(OSError):
    """Raised when no templates catalog file can be resolved."""


def _resolver_paths(settings: Settings) -> list[Path]:
    if settings.templates_catalog_path.strip():
        return [Path(settings.templates_catalog_path).expanduser().resolve()]
    pkg_api = Path(__file__).resolve().parents[2]
    return [
        pkg_api / "catalogs" / "templates.json",
        pkg_api.parent.parent / "data" / "templates.json",
    ]


@lru_cache(maxsize=8)
def _load_catalog_raw(path_str: str) -> dict[str, object]:
    with Path(path_str).open(encoding="utf-8") as fh:
        return json.load(fh)


def load_templates_catalog(settings: Settings | None = None) -> TemplatesCatalogResponse:
    """Parse and validate ``templates.json`` from configured path or default search order."""
    cfg = settings or get_settings()
    for candidate in _resolver_paths(cfg):
        try:
            if candidate.is_file():
                raw = _load_catalog_raw(str(candidate.resolve()))
                return TemplatesCatalogResponse.model_validate(raw)
        except OSError:
            continue
    raise TemplatesCatalogError(
        "templates.json not found — set TEMPLATES_CATALOG_PATH "
        "or keep data/templates.json at repo root",
    )


def invalidate_templates_cache() -> None:
    _load_catalog_raw.cache_clear()


class TemplateService:
    """Catalog reads (no DB) and ``apply`` which persists via ``DesignerService``."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @classmethod
    def list_templates(cls, settings: Settings) -> TemplatesCatalogResponse:
        return load_templates_catalog(settings)

    @classmethod
    def get_template(cls, settings: Settings, template_id: str) -> PipelineTemplate | None:
        catalog = cls.list_templates(settings)
        for t in catalog.templates:
            if t.id == template_id:
                return t
        return None

    async def apply(
        self,
        user_id: uuid.UUID,
        template_id: str,
        body: ApplyTemplateRequest,
        settings: Settings,
    ) -> ApplyTemplateResponse | None:
        """Create a new ``PipelineConfig`` row from a catalog template.

        Returns ``None`` if the template or project is missing.
        """
        entry = self.get_template(settings, template_id)
        if entry is None:
            return None

        designer = DesignerService(self._session)
        req = SaveConfigRequest(
            name=body.name or entry.name,
            project_id=body.project_id,
            description=body.description if body.description is not None else entry.description,
            config=entry.config,
        )
        saved = await designer.save_config(user_id, req)
        if saved is None:
            return None
        dumped = saved.model_dump()
        return ApplyTemplateResponse(template_id=template_id, **dumped)
