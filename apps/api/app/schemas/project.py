"""HTTP schemas for the Projects API (P4-1)."""

from __future__ import annotations

import math
import uuid
from datetime import datetime

from pydantic import Field, field_validator

from app.schemas.pipeline import RAGBaseModel


class ProjectCreateRequest(RAGBaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be blank")
        return v.strip()


class ProjectUpdateRequest(RAGBaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if not v.strip():
            raise ValueError("name must not be blank")
        return v.strip()


class ProjectSummary(RAGBaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class PipelineConfigSummary(RAGBaseModel):
    id: uuid.UUID
    name: str
    version: str
    cloud_provider: str
    source: str | None = None
    build_id: str | None = None
    created_at: datetime
    updated_at: datetime


class AutopilotBuildSummary(RAGBaseModel):
    id: uuid.UUID
    status: str
    progress: int
    current_stage: str
    iteration: int
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    error: str | None = None


class ProjectDetailResponse(RAGBaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    pipeline_configs: list[PipelineConfigSummary]
    autopilot_builds: list[AutopilotBuildSummary]


class PaginatedProjectsResponse(RAGBaseModel):
    items: list[ProjectSummary]
    total: int
    page: int
    page_size: int
    pages: int

    @classmethod
    def from_rows(
        cls,
        *,
        items: list[ProjectSummary],
        total: int,
        page: int,
        page_size: int,
    ) -> PaginatedProjectsResponse:
        if total == 0:
            pages = 0
        elif page_size <= 0:
            pages = 1
        else:
            pages = max(1, math.ceil(total / page_size))
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )
