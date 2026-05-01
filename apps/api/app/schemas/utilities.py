"""Schemas for utility endpoints (P2-9)."""

from typing import Annotated, Any

from pydantic import Field

from app.schemas.pipeline import RAGBaseModel


class InfoResponse(RAGBaseModel):
    service: Annotated[str, Field(description="Logical service identifier")]
    version: Annotated[str, Field(description="API semver")]
    environment: Annotated[str, Field(description="APP_ENV value")]
    python_version: Annotated[str, Field(description="Interpreter version string")]


class ValidatePipelineResponse(RAGBaseModel):
    valid: bool
    errors: list[Any] = Field(default_factory=list)
