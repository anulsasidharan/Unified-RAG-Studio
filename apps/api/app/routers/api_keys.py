"""API key management endpoints."""

from __future__ import annotations

import hashlib
import secrets
import uuid as uuid_lib

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select

from app.dependencies import CurrentPrincipal, DbSession
from app.models.api_key import APIKey
from app.schemas.api_key import (
    APIKeyResponse,
    APIKeysListResponse,
    CreateAPIKeyRequest,
    CreateAPIKeyResponse,
)

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _key_to_response(k: APIKey) -> APIKeyResponse:
    return APIKeyResponse(
        id=str(k.id),
        key_name=k.key_name,
        key_prefix=k.key_prefix,
        last_used=k.last_used,
        created_at=k.created_at,
        expires_at=k.expires_at,
        is_active=k.is_active,
    )


@router.get("", response_model=APIKeysListResponse, summary="List API keys for current user")
async def list_api_keys(principal: CurrentPrincipal, session: DbSession) -> APIKeysListResponse:
    result = await session.execute(
        select(APIKey)
        .where(APIKey.user_id == principal.user_id)
        .where(APIKey.is_active == True)  # noqa: E712
        .order_by(APIKey.created_at.desc())
    )
    keys = result.scalars().all()
    return APIKeysListResponse(api_keys=[_key_to_response(k) for k in keys])


@router.post(
    "",
    response_model=CreateAPIKeyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new API key",
)
async def create_api_key(
    body: CreateAPIKeyRequest,
    principal: CurrentPrincipal,
    session: DbSession,
) -> CreateAPIKeyResponse:
    raw_key = f"sk_{secrets.token_urlsafe(32)}"
    key_hash = _hash_key(raw_key)
    key_prefix = raw_key[:12]

    api_key = APIKey(
        user_id=principal.user_id,
        key_name=body.key_name,
        key_hash=key_hash,
        key_prefix=key_prefix,
        expires_at=body.expires_at,
        is_active=True,
    )
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)

    return CreateAPIKeyResponse(
        id=str(api_key.id),
        key_name=api_key.key_name,
        key_prefix=api_key.key_prefix,
        api_key=raw_key,
        last_used=None,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at,
        is_active=True,
    )


@router.delete(
    "/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Revoke an API key",
)
async def revoke_api_key(
    key_id: str,
    principal: CurrentPrincipal,
    session: DbSession,
) -> Response:
    try:
        key_uuid = uuid_lib.UUID(key_id)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid key ID"
        ) from err  # noqa: E501

    api_key = await session.get(APIKey, key_uuid)
    if api_key is None or api_key.user_id != principal.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")

    api_key.is_active = False
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
