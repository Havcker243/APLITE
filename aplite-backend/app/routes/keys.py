"""API key management routes.

Partners use API keys to authenticate resolve requests without user sessions.
Keys are scoped to 'resolve' by default. The raw key is shown once on creation
and never stored — only a SHA256 hash is persisted.
"""

from __future__ import annotations

import hashlib
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.db import queries
from app.routes.auth import get_current_user

router = APIRouter()
logger = logging.getLogger("aplite")


class CreateKeyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


@router.post("/api/keys")
def create_api_key(payload: CreateKeyRequest, user=Depends(get_current_user)):
    """Generate a new API key for the authenticated user.

    The full key is returned exactly once. Store it securely — it cannot be
    retrieved again.
    """
    if not queries.is_user_verified(int(user.get("id", 0) or 0)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verification required to create API keys.",
        )

    raw_key = "ak_" + secrets.token_hex(32)
    key_prefix = raw_key[:11]
    key_hash = _hash_key(raw_key)

    record = queries.create_api_key(
        user_id=int(user["id"]),
        name=payload.name.strip(),
        key_hash=key_hash,
        key_prefix=key_prefix,
        scopes=["resolve"],
    )

    return {
        "id": str(record["id"]),
        "name": record["name"],
        "key": raw_key,
        "key_prefix": record["key_prefix"],
        "scopes": record["scopes"],
        "created_at": record["created_at"],
        "warning": "Save this key now. It will not be shown again.",
    }


@router.get("/api/keys")
def list_api_keys(user=Depends(get_current_user)):
    """List all API keys for the authenticated user."""
    rows = queries.list_api_keys(int(user.get("id", 0) or 0))
    return [
        {
            "id": str(r["id"]),
            "name": r["name"],
            "key_prefix": r["key_prefix"],
            "scopes": r["scopes"],
            "last_used_at": r["last_used_at"],
            "revoked_at": r["revoked_at"],
            "created_at": r["created_at"],
            "active": r["revoked_at"] is None,
        }
        for r in rows
    ]


@router.delete("/api/keys/{key_id}")
def revoke_api_key(key_id: str, user=Depends(get_current_user)):
    """Revoke an API key. Resolves using it will immediately fail."""
    revoked = queries.revoke_api_key(
        key_id=key_id,
        user_id=int(user.get("id", 0) or 0),
    )
    if not revoked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found or already revoked.",
        )
    logger.info("api key revoked", extra={"key_id": key_id, "user_id": user.get("id")})
    return {"status": "revoked", "key_id": key_id}
