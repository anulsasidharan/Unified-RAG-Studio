"""Autopilot build persistence and ownership checks (P6-9)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.agents.state import AUTOPILOT_STAGE_ORDER
from app.models.build_history import AutopilotBuild
from app.models.project import Project
from app.schemas.autopilot import StartBuildRequest


def _iso_now() -> str:
    return datetime.now(UTC).isoformat()


def initial_stage_map() -> dict[str, dict[str, str | None]]:
    return {
        k: {
            "status": "pending",
            "started_at": None,
            "completed_at": None,
            "message": None,
        }
        for k in AUTOPILOT_STAGE_ORDER
    }


class AutopilotBuildService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_owned(self, build_id: uuid.UUID, user_id: uuid.UUID) -> AutopilotBuild | None:
        q = (
            select(AutopilotBuild)
            .join(Project, AutopilotBuild.project_id == Project.id)
            .where(AutopilotBuild.id == build_id)
            .where(Project.user_id == user_id)
            .where(Project.deleted_at.is_(None))
        )
        return (await self._session.execute(q)).scalar_one_or_none()

    async def create_pending_build(self, user_id: uuid.UUID, body: StartBuildRequest) -> AutopilotBuild:
        try:
            pid = uuid.UUID(body.project_id.strip())
        except ValueError as exc:
            raise ValueError("invalid project_id") from exc

        proj = await self._session.get(Project, pid)
        if proj is None or proj.user_id != user_id or proj.deleted_at is not None:
            raise LookupError("project not found")

        requirements: dict = body.requirements.model_dump(mode="json")
        requirements["document_ids"] = [str(x) for x in body.document_ids]
        if body.base_config is not None:
            requirements["base_config"] = body.base_config.model_dump(mode="json")

        build = AutopilotBuild(
            project_id=pid,
            status="pending",
            progress=0,
            current_stage="queued",
            iteration=0,
            requirements=requirements,
            stages=initial_stage_map(),
            messages=[
                {
                    "timestamp": _iso_now(),
                    "text": "Autopilot build created and queued.",
                    "type": "info",
                    "agent": "api",
                },
            ],
            result=None,
            error=None,
        )
        self._session.add(build)
        await self._session.flush()
        await self._session.refresh(build)
        return build

    async def attach_celery_task_id(self, build_id: uuid.UUID, celery_task_id: str) -> None:
        row = await self._session.get(AutopilotBuild, build_id)
        if row is None:
            return
        req = dict(row.requirements or {})
        req["_celery_task_id"] = celery_task_id
        row.requirements = req
        await self._session.flush()

    async def mark_cancelled(self, build_id: uuid.UUID) -> AutopilotBuild | None:
        row = await self._session.get(AutopilotBuild, build_id)
        if row is None:
            return None
        row.status = "cancelled"
        row.completed_at = datetime.now(UTC)
        row.error = None
        await self._session.flush()
        return row
