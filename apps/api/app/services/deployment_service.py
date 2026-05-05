"""Deployment HTTP API backing — P8-4.

Creates ``deployments`` rows, enqueues Celery ``run_deployment``, and serves
status / project-scoped listing / teardown for owned pipeline configs.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deployment import Deployment
from app.models.pipeline_config import PipelineConfig
from app.models.project import Project
from app.schemas.deployment import (
    DeployRequest,
    DeployResponse,
    DeploymentListItem,
    DeploymentListResponse,
    DeploymentStatusResponse,
)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


class DeploymentService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _owned_config(self, user_id: uuid.UUID, config_id: uuid.UUID) -> PipelineConfig | None:
        q = (
            select(PipelineConfig)
            .join(Project, PipelineConfig.project_id == Project.id)
            .where(PipelineConfig.id == config_id)
            .where(PipelineConfig.user_id == user_id)
            .where(Project.user_id == user_id)
            .where(Project.deleted_at.is_(None))
        )
        return (await self._session.execute(q)).scalar_one_or_none()

    async def _owned_project(self, user_id: uuid.UUID, project_id: uuid.UUID) -> Project | None:
        q = (
            select(Project)
            .where(Project.id == project_id)
            .where(Project.user_id == user_id)
            .where(Project.deleted_at.is_(None))
        )
        return (await self._session.execute(q)).scalar_one_or_none()

    async def _owned_deployment(
        self, user_id: uuid.UUID, deployment_id: uuid.UUID
    ) -> Deployment | None:
        q = (
            select(Deployment)
            .join(PipelineConfig, Deployment.config_id == PipelineConfig.id)
            .join(Project, PipelineConfig.project_id == Project.id)
            .where(Deployment.id == deployment_id)
            .where(Deployment.user_id == user_id)
            .where(PipelineConfig.user_id == user_id)
            .where(Project.user_id == user_id)
            .where(Project.deleted_at.is_(None))
        )
        return (await self._session.execute(q)).scalar_one_or_none()

    def _row_to_status(self, row: Deployment) -> DeploymentStatusResponse:
        info = dict(row.deployment_info or {})
        err = info.get("error") if row.status == "failed" else None
        st = row.status
        if st not in ("deploying", "deployed", "failed", "teardown"):
            st = "failed"

        return DeploymentStatusResponse(
            deployment_id=str(row.id),
            config_id=str(row.config_id),
            provider=row.provider,  # type: ignore[arg-type]
            environment=row.environment,  # type: ignore[arg-type]
            status=st,  # type: ignore[arg-type]
            endpoint=row.endpoint,
            health_check_url=row.health_check_url,
            docker_image_tag=row.docker_image_tag,
            deployed_at=_iso(row.deployed_at) if row.deployed_at else None,
            error=err if isinstance(err, str) else None,
        )

    async def trigger_deploy(self, user_id: uuid.UUID, body: DeployRequest) -> DeployResponse | None:
        try:
            cfg_uuid = uuid.UUID(body.config_id.strip())
        except ValueError:
            return None

        p_row = await self._owned_config(user_id, cfg_uuid)
        if p_row is None:
            return None

        dep_info: dict = {}
        if body.region:
            dep_info["region"] = body.region

        row = Deployment(
            user_id=user_id,
            config_id=p_row.id,
            provider=body.provider,
            environment=body.environment,
            status="deploying",
            endpoint=None,
            health_check_url=None,
            docker_image_tag=body.image_tag,
            deployment_info=dep_info or None,
            deployed_at=None,
        )
        self._session.add(row)
        await self._session.flush()

        dep_id = str(row.id)
        cfg_id = str(p_row.id)

        # Commit before Celery so the worker never races an open transaction.
        await self._session.commit()

        from app.worker import tasks as worker_tasks

        worker_tasks.run_deployment.delay(dep_id)

        return DeployResponse(
            deployment_id=dep_id,
            config_id=cfg_id,
            provider=body.provider,
            environment=body.environment,
            status="deploying",
            message="Deployment queued. Poll GET /api/deployment/{id}/status until status is deployed, failed, or teardown.",
        )

    async def get_status(self, user_id: uuid.UUID, deployment_id: uuid.UUID) -> DeploymentStatusResponse | None:
        row = await self._owned_deployment(user_id, deployment_id)
        if row is None:
            return None
        return self._row_to_status(row)

    async def list_for_project(
        self,
        user_id: uuid.UUID,
        project_id: uuid.UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> DeploymentListResponse | None:
        owner = await self._owned_project(user_id, project_id)
        if owner is None:
            return None

        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        offset = (page - 1) * page_size

        q = (
            select(Deployment)
            .where(Deployment.user_id == user_id)
            .where(
                Deployment.config_id.in_(
                    select(PipelineConfig.id)
                    .join(Project, PipelineConfig.project_id == Project.id)
                    .where(PipelineConfig.project_id == project_id)
                    .where(PipelineConfig.user_id == user_id)
                    .where(Project.user_id == user_id)
                    .where(Project.deleted_at.is_(None))
                )
            )
            .order_by(Deployment.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        rows = list((await self._session.execute(q)).scalars().all())

        cq = (
            select(func.count())
            .select_from(Deployment)
            .where(Deployment.user_id == user_id)
            .where(
                Deployment.config_id.in_(
                    select(PipelineConfig.id)
                    .join(Project, PipelineConfig.project_id == Project.id)
                    .where(PipelineConfig.project_id == project_id)
                    .where(PipelineConfig.user_id == user_id)
                    .where(Project.user_id == user_id)
                    .where(Project.deleted_at.is_(None))
                )
            )
        )
        total = int((await self._session.execute(cq)).scalar_one())

        items: list[DeploymentListItem] = []
        for r in rows:
            st = r.status if r.status in ("deploying", "deployed", "failed", "teardown") else "failed"
            items.append(
                DeploymentListItem(
                    deployment_id=str(r.id),
                    config_id=str(r.config_id),
                    provider=r.provider,  # type: ignore[arg-type]
                    environment=r.environment,  # type: ignore[arg-type]
                    status=st,  # type: ignore[arg-type]
                    endpoint=r.endpoint,
                    deployed_at=_iso(r.deployed_at) if r.deployed_at else None,
                )
            )

        return DeploymentListResponse(items=items, total=total, page=page, page_size=page_size)

    async def teardown(self, user_id: uuid.UUID, deployment_id: uuid.UUID) -> DeploymentStatusResponse | None:
        row = await self._owned_deployment(user_id, deployment_id)
        if row is None:
            return None

        row.status = "teardown"
        row.endpoint = None
        row.health_check_url = None
        info = dict(row.deployment_info or {})
        info["teardown_at"] = _iso(datetime.now(UTC))
        row.deployment_info = info

        await self._session.flush()
        return self._row_to_status(row)
