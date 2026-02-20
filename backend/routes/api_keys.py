from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime, timezone
import uuid
import secrets
import hashlib

from database import db
from middleware.auth import get_current_user
from models.api_key import ApiKeyCreate, ApiKeyResponse, ApiKeyCreatedResponse

api_keys_router = APIRouter(prefix="/api/api-keys", tags=["API Keys"])


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


@api_keys_router.post("/", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(data: ApiKeyCreate, current_user: dict = Depends(get_current_user)):
    """Create a new API key. The full key is only shown once."""
    key_id = str(uuid.uuid4())
    raw_key = f"da_{secrets.token_urlsafe(32)}"
    key_prefix = raw_key[:10] + "..."
    now = datetime.now(timezone.utc).isoformat()

    key_doc = {
        "id": key_id,
        "user_id": current_user["id"],
        "tenant_id": current_user["tenant_id"],
        "name": data.name,
        "key_hash": _hash_key(raw_key),
        "key_prefix": key_prefix,
        "scopes": data.scopes,
        "is_active": True,
        "created_at": now,
        "last_used_at": None,
    }
    await db.api_keys.insert_one(key_doc)

    return ApiKeyCreatedResponse(
        id=key_id,
        name=data.name,
        key=raw_key,
        key_prefix=key_prefix,
        scopes=data.scopes,
        created_at=now,
    )


@api_keys_router.get("/", response_model=list[ApiKeyResponse])
async def list_api_keys(current_user: dict = Depends(get_current_user)):
    """List all API keys for the current user (keys are masked)."""
    keys = await db.api_keys.find(
        {"user_id": current_user["id"], "is_active": True}
    ).to_list(100)

    return [
        ApiKeyResponse(
            id=k["id"],
            name=k["name"],
            key_prefix=k["key_prefix"],
            scopes=k.get("scopes", []),
            created_at=k["created_at"],
            last_used_at=k.get("last_used_at"),
            is_active=k["is_active"],
        )
        for k in keys
    ]


@api_keys_router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(key_id: str, current_user: dict = Depends(get_current_user)):
    """Revoke an API key."""
    result = await db.api_keys.update_one(
        {"id": key_id, "user_id": current_user["id"]},
        {"$set": {"is_active": False}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")


@api_keys_router.post("/{key_id}/rotate", response_model=ApiKeyCreatedResponse)
async def rotate_api_key(key_id: str, current_user: dict = Depends(get_current_user)):
    """Rotate an API key: deactivate old, create new with same name/scopes."""
    old_key = await db.api_keys.find_one({"id": key_id, "user_id": current_user["id"], "is_active": True})
    if not old_key:
        raise HTTPException(status_code=404, detail="API key not found")

    # Deactivate old key
    await db.api_keys.update_one({"id": key_id}, {"$set": {"is_active": False}})

    # Create new key with same metadata
    new_key_id = str(uuid.uuid4())
    raw_key = f"da_{secrets.token_urlsafe(32)}"
    key_prefix = raw_key[:10] + "..."
    now = datetime.now(timezone.utc).isoformat()

    new_key_doc = {
        "id": new_key_id,
        "user_id": current_user["id"],
        "tenant_id": current_user["tenant_id"],
        "name": old_key["name"],
        "key_hash": _hash_key(raw_key),
        "key_prefix": key_prefix,
        "scopes": old_key.get("scopes", ["read", "write"]),
        "is_active": True,
        "created_at": now,
        "last_used_at": None,
    }
    await db.api_keys.insert_one(new_key_doc)

    return ApiKeyCreatedResponse(
        id=new_key_id,
        name=old_key["name"],
        key=raw_key,
        key_prefix=key_prefix,
        scopes=old_key.get("scopes", ["read", "write"]),
        created_at=now,
    )
