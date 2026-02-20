import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from database import db
from config import SUBSCRIPTION_TIERS

logger = logging.getLogger(__name__)


async def create_tenant(name: str, subdomain: str, owner_id: str) -> Dict[str, Any]:
    """Create a new tenant/organization."""
    tenant_id = str(uuid.uuid4())
    tenant = {
        "id": tenant_id,
        "owner_id": owner_id,
        "name": name,
        "subdomain": subdomain,
        "subscription": {
            "tier": "free",
            "status": "active",
            "current_period_end": None
        },
        "quotas": SUBSCRIPTION_TIERS["free"],
        "usage": {"components_this_month": 0, "last_reset_date": datetime.now(timezone.utc).isoformat()},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tenants.insert_one(tenant)
    return tenant


async def get_tenant_members(tenant_id: str):
    """Get all members of a tenant."""
    members = await db.users.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    return members


async def invite_member(tenant_id: str, email: str, role: str = "member"):
    """Invite a user to a tenant by email."""
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        if existing.get("tenant_id") == tenant_id:
            return {"error": "User is already a member"}
        await db.users.update_one(
            {"email": email},
            {"$set": {"tenant_id": tenant_id, "role": role}}
        )
        return {"status": "added", "user_id": existing["id"]}
    return {"status": "invited", "email": email}


async def remove_member(tenant_id: str, user_id: str):
    """Remove a member from a tenant."""
    result = await db.users.update_one(
        {"id": user_id, "tenant_id": tenant_id, "role": {"$ne": "owner"}},
        {"$set": {"tenant_id": None, "role": "member"}}
    )
    return result.modified_count > 0


async def update_member_role(tenant_id: str, user_id: str, new_role: str):
    """Update a member's role."""
    result = await db.users.update_one(
        {"id": user_id, "tenant_id": tenant_id},
        {"$set": {"role": new_role}}
    )
    return result.modified_count > 0
