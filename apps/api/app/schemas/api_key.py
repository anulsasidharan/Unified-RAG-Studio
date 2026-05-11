"""API key schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CreateAPIKeyRequest(BaseModel):
    key_name: str = Field(min_length=1, max_length=100)
    expires_at: Optional[datetime] = None


class APIKeyResponse(BaseModel):
    id: str
    key_name: str
    key_prefix: str
    last_used: Optional[datetime] = None
    created_at: datetime
    expires_at: Optional[datetime] = None
    is_active: bool


class CreateAPIKeyResponse(APIKeyResponse):
    api_key: str


class APIKeysListResponse(BaseModel):
    api_keys: list[APIKeyResponse]
