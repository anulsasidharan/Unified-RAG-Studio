"""Designer pipeline configuration persistence (P4-2)."""

from __future__ import annotations

from datetime import datetime
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pipeline_config import PipelineConfig
from app.models.project import Project
from app.schemas.designer import (
    ConfigListItem,
    ConfigListResponse,
    SaveConfigRequest,
    SaveConfigResponse,
    UpdateDesignerConfigRequest,
)
from app.schemas.pipeline import PipelineConfigurationSchema


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def row_to_save_response(row: PipelineConfig) -> SaveConfigResponse:
    """Merge DB row timestamps into stored JSON and validate as ``PipelineConfigurationSchema``."""
    cfg_dict = dict(row.config)
    meta = dict(cfg_dict.get("metadata") or {})
    meta["created_at"] = _iso(row.created_at)
    meta["updated_at"] = _iso(row.updated_at)
    meta.setdefault("version", row.version)
    if meta.get("source") is None:
        meta["source"] = "designer"
    cfg_dict["metadata"] = meta
    cfg_dict["id"] = str(row.id)
    cfg_dict["name"] = row.name
    parsed = PipelineConfigurationSchema.model_validate(cfg_dict)
    return SaveConfigResponse(
        id=str(row.id),
        name=row.name,
        project_id=str(row.project_id),
        description=parsed.description,
        config=parsed,
        created_at=_iso(row.created_at),
        updated_at=_iso(row.updated_at),
    )


class DesignerService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _owned_project(self, user_id: uuid.UUID, project_id: uuid.UUID) -> Project | None:
        q = (
            select(Project)
            .where(Project.id == project_id)
            .where(Project.user_id == user_id)
            .where(Project.deleted_at.is_(None))
        )
        return (await self._session.execute(q)).scalar_one_or_none()

    async def _owned_config(
        self, user_id: uuid.UUID, config_id: uuid.UUID
    ) -> PipelineConfig | None:
        q = (
            select(PipelineConfig)
            .join(Project, PipelineConfig.project_id == Project.id)
            .where(PipelineConfig.id == config_id)
            .where(PipelineConfig.user_id == user_id)
            .where(Project.user_id == user_id)
            .where(Project.deleted_at.is_(None))
        )
        return (await self._session.execute(q)).scalar_one_or_none()

    def _prepare_new_config(
        self, body: SaveConfigRequest, row_id: uuid.UUID
    ) -> PipelineConfigurationSchema:
        desc = body.description if body.description is not None else body.config.description
        md = body.config.metadata.model_copy(
            update={
                "version": body.config.metadata.version or "1.0.0",
                "source": body.config.metadata.source or "designer",
            }
        )
        return body.config.model_copy(
            update={
                "id": str(row_id),
                "name": body.name,
                "description": desc,
                "metadata": md,
            }
        )

    async def save_config(
        self, user_id: uuid.UUID, body: SaveConfigRequest
    ) -> SaveConfigResponse | None:
        """Create a new ``PipelineConfig`` row scoped to an owned project."""
        if await self._owned_project(user_id, body.project_id) is None:
            return None
        row_id = uuid.uuid4()
        schema = self._prepare_new_config(body, row_id)
        cfg_dict = schema.model_dump(mode="json")
        row = PipelineConfig(
            id=row_id,
            user_id=user_id,
            project_id=body.project_id,
            name=body.name,
            version=schema.metadata.version,
            cloud_provider=str(schema.cloud_provider),
            config=cfg_dict,
            source=str(schema.metadata.source) if schema.metadata.source else "designer",
            build_id=schema.metadata.build_id,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return row_to_save_response(row)

    async def load_config(
        self, user_id: uuid.UUID, config_id: uuid.UUID
    ) -> SaveConfigResponse | None:
        row = await self._owned_config(user_id, config_id)
        if row is None:
            return None
        return row_to_save_response(row)

    async def update_config(
        self,
        user_id: uuid.UUID,
        config_id: uuid.UUID,
        body: UpdateDesignerConfigRequest,
    ) -> SaveConfigResponse | None:
        row = await self._owned_config(user_id, config_id)
        if row is None:
            return None

        cfg_dict = dict(row.config)
        current = PipelineConfigurationSchema.model_validate(cfg_dict)

        new_name = body.name if body.name is not None else row.name
        new_desc = body.description if body.description is not None else current.description

        if body.config is not None:
            merged = body.config.model_copy(
                update={
                    "id": str(row.id),
                    "name": new_name,
                    "description": new_desc,
                    "metadata": body.config.metadata.model_copy(
                        update={
                            "source": body.config.metadata.source or "designer",
                        }
                    ),
                }
            )
        else:
            merged = current.model_copy(update={"name": new_name, "description": new_desc})

        row.name = new_name
        row.cloud_provider = str(merged.cloud_provider)
        row.version = merged.metadata.version
        row.source = str(merged.metadata.source) if merged.metadata.source else row.source
        row.build_id = merged.metadata.build_id
        row.config = merged.model_dump(mode="json")

        await self._session.flush()
        await self._session.refresh(row)
        return row_to_save_response(row)

    async def list_for_project(
        self,
        user_id: uuid.UUID,
        project_id: uuid.UUID,
        *,
        page: int,
        page_size: int,
    ) -> ConfigListResponse | None:
        if await self._owned_project(user_id, project_id) is None:
            return None

        base = (
            select(PipelineConfig)
            .where(PipelineConfig.project_id == project_id)
            .where(PipelineConfig.user_id == user_id)
            .order_by(PipelineConfig.updated_at.desc())
        )
        count_q = (
            select(func.count())
            .select_from(PipelineConfig)
            .where(PipelineConfig.project_id == project_id)
            .where(PipelineConfig.user_id == user_id)
        )
        total = int((await self._session.execute(count_q)).scalar_one())
        offset = (page - 1) * page_size
        rows = (await self._session.execute(base.offset(offset).limit(page_size))).scalars().all()

        items: list[ConfigListItem] = []
        for r in rows:
            cfg = r.config or {}
            desc = cfg.get("description") if isinstance(cfg.get("description"), str) else None
            items.append(
                ConfigListItem(
                    id=str(r.id),
                    name=r.name,
                    description=desc,
                    cloud_provider=r.cloud_provider,
                    source=r.source,
                    created_at=_iso(r.created_at),
                    updated_at=_iso(r.updated_at),
                )
            )
        return ConfigListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def delete_config(self, user_id: uuid.UUID, config_id: uuid.UUID) -> bool:
        row = await self._owned_config(user_id, config_id)
        if row is None:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True
