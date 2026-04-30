"""Pydantic schemas for Deployment API endpoints.

These schemas handle:
  POST   /api/deployment/deploy           — deploy a pipeline config
  GET    /api/deployment/{id}/status      — check deployment status
  GET    /api/deployment/deployments      — list deployments for a project
  DELETE /api/deployment/{id}             — tear down a deployment
"""

from typing import Literal

from pydantic import Field

from app.schemas.pipeline import RAGBaseModel


# ─── Deploy Request ───────────────────────────────────────────────────────────


DeploymentProvider = Literal["docker", "aws", "gcp", "azure", "kubernetes"]
DeploymentEnvironment = Literal["staging", "production"]
DeploymentStatus = Literal["deploying", "deployed", "failed", "teardown"]


class DeployRequest(RAGBaseModel):
    """Body for POST /api/deployment/deploy."""

    config_id: str
    provider: DeploymentProvider
    environment: DeploymentEnvironment = "staging"
    # Cloud-specific: AWS region, GCP project region, Azure location, etc.
    region: str | None = None
    # Override the Docker image tag (defaults to short git SHA set by CD pipeline)
    image_tag: str | None = None


# ─── Deploy Response ──────────────────────────────────────────────────────────


class DeployResponse(RAGBaseModel):
    """Response from POST /api/deployment/deploy.

    The deployment runs asynchronously — poll GET /api/deployment/{id}/status
    until status='deployed' or status='failed'.
    """

    deployment_id: str
    config_id: str
    provider: DeploymentProvider
    environment: DeploymentEnvironment
    status: DeploymentStatus
    message: str


# ─── Deployment Status ────────────────────────────────────────────────────────


class DeploymentStatusResponse(RAGBaseModel):
    """Response for GET /api/deployment/{id}/status."""

    deployment_id: str
    config_id: str
    provider: DeploymentProvider
    environment: DeploymentEnvironment
    status: DeploymentStatus
    endpoint: str | None = None
    health_check_url: str | None = None
    docker_image_tag: str | None = None
    deployed_at: str | None = None
    error: str | None = None


# ─── Deployment List ──────────────────────────────────────────────────────────


class DeploymentListItem(RAGBaseModel):
    """Lightweight summary used in list responses."""

    deployment_id: str
    config_id: str
    provider: DeploymentProvider
    environment: DeploymentEnvironment
    status: DeploymentStatus
    endpoint: str | None = None
    deployed_at: str | None = None


class DeploymentListResponse(RAGBaseModel):
    """Response for GET /api/deployment/deployments?project_id=."""

    items: list[DeploymentListItem]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
