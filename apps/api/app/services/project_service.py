"""Project CRUD — async SQLAlchemy; scoped by user and soft-delete."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.project import Project
from app.models.user import User
from app.schemas.project import (
    AutopilotBuildSummary,
    PaginatedProjectsResponse,
    PipelineConfigSummary,
    ProjectCreateRequest,
    ProjectDetailResponse,
    ProjectSummary,
    ProjectUpdateRequest,
)


class ProjectService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        user_id: uuid.UUID,
        body: ProjectCreateRequest,
    ) -> ProjectSummary:
        user = await self._session.get(User, user_id)
        if user is None:
            raise LookupError("user not found")

        if user.subscription_tier.lower() == "free":
            # Free tier: max 3 projects (active = not soft-deleted).
            count_q = (
                select(func.count())
                .select_from(Project)
                .where(Project.user_id == user_id)
                .where(Project.deleted_at.is_(None))
            )
            n = int((await self._session.execute(count_q)).scalar_one() or 0)
            if n >= 3:
                raise ValueError("Free tier limit reached (max 3 projects). Upgrade to create more.")

        proj = Project(
            user_id=user_id,
            name=body.name,
            description=body.description,
        )
        self._session.add(proj)
        await self._session.flush()
        await self._session.refresh(proj)
        return ProjectSummary.model_validate(proj)

    async def list_page(
        self,
        user_id: uuid.UUID,
        *,
        page: int,
        page_size: int,
    ) -> PaginatedProjectsResponse:
        base = (
            select(Project)
            .where(Project.user_id == user_id)
            .where(Project.deleted_at.is_(None))
            .order_by(Project.updated_at.desc())
        )
        count_q = (
            select(func.count())
            .select_from(Project)
            .where(Project.user_id == user_id)
            .where(Project.deleted_at.is_(None))
        )
        total = int((await self._session.execute(count_q)).scalar_one())

        offset = (page - 1) * page_size
        rows = (
            await self._session.execute(base.offset(offset).limit(page_size))
        ).scalars().all()

        items = [ProjectSummary.model_validate(r) for r in rows]
        return PaginatedProjectsResponse.from_rows(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_detail(self, project_id: uuid.UUID, user_id: uuid.UUID) -> ProjectDetailResponse | None:
        q = (
            select(Project)
            .where(Project.id == project_id)
            .where(Project.user_id == user_id)
            .where(Project.deleted_at.is_(None))
            .options(
                selectinload(Project.pipeline_configs),
                selectinload(Project.autopilot_builds),
            )
        )
        proj = (await self._session.execute(q)).scalar_one_or_none()
        if proj is None:
            return None

        configs = [
            PipelineConfigSummary(
                id=c.id,
                name=c.name,
                version=c.version,
                cloud_provider=c.cloud_provider,
                source=c.source,
                build_id=c.build_id,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in sorted(proj.pipeline_configs, key=lambda x: x.updated_at, reverse=True)
        ]
        builds = [
            AutopilotBuildSummary(
                id=b.id,
                status=b.status,
                progress=b.progress,
                current_stage=b.current_stage,
                iteration=b.iteration,
                created_at=b.created_at,
                updated_at=b.updated_at,
                completed_at=b.completed_at,
                error=b.error,
            )
            for b in sorted(proj.autopilot_builds, key=lambda x: x.updated_at, reverse=True)
        ]

        return ProjectDetailResponse(
            id=proj.id,
            user_id=proj.user_id,
            name=proj.name,
            description=proj.description,
            created_at=proj.created_at,
            updated_at=proj.updated_at,
            pipeline_configs=configs,
            autopilot_builds=builds,
        )

    async def update(
        self,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
        body: ProjectUpdateRequest,
    ) -> ProjectSummary | None:
        proj = await self._get_owned_active(project_id, user_id)
        if proj is None:
            return None
        if body.name is not None:
            proj.name = body.name
        if body.description is not None:
            proj.description = body.description
        await self._session.flush()
        await self._session.refresh(proj)
        return ProjectSummary.model_validate(proj)

    async def soft_delete(self, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        proj = await self._get_owned_active(project_id, user_id)
        if proj is None:
            return False
        proj.deleted_at = datetime.now(UTC)
        await self._session.flush()
        return True

    async def _get_owned_active(self, project_id: uuid.UUID, user_id: uuid.UUID) -> Project | None:
        q = (
            select(Project)
            .where(Project.id == project_id)
            .where(Project.user_id == user_id)
            .where(Project.deleted_at.is_(None))
        )
        return (await self._session.execute(q)).scalar_one_or_none()
