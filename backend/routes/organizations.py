from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import List
import uuid

from database import db
from config import SUBSCRIPTION_TIERS
from middleware.auth import get_current_user
from models import TenantCreate, TenantResponse, TenantUpdate, MemberInvite, MemberRoleUpdate
from services.org_service import (
    create_tenant,
    get_tenant_members,
    invite_member,
    remove_member,
    update_member_role,
)

orgs_router = APIRouter(prefix="/api/organizations", tags=["Organizations"])


@orgs_router.get("/subscription-tiers")
async def get_subscription_tiers(current_user: dict = Depends(get_current_user)):
    """Get all available subscription tiers and their details."""
    return {"tiers": SUBSCRIPTION_TIERS}


@orgs_router.get("/current", response_model=TenantResponse)
async def get_current_organization(current_user: dict = Depends(get_current_user)):
    """Get the current user's organization."""
    tenant_id = current_user["tenant_id"]
    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Organization not found")

    return TenantResponse(
        id=tenant["id"],
        name=tenant["name"],
        subdomain=tenant.get("subdomain", ""),
        subscription=tenant.get("subscription", {}),
        quotas=tenant.get("quotas", {}),
        usage=tenant.get("usage", {}),
        created_at=tenant.get("created_at", datetime.now(timezone.utc)),
    )


@orgs_router.post("/", response_model=TenantResponse)
async def create_organization(
    tenant_data: TenantCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new organization."""
    tenant = await create_tenant(
        name=tenant_data.name,
        subdomain=tenant_data.subdomain,
        owner_id=current_user["id"],
    )

    return TenantResponse(
        id=tenant["id"],
        name=tenant["name"],
        subdomain=tenant.get("subdomain", ""),
        subscription=tenant.get("subscription", {}),
        quotas=tenant.get("quotas", {}),
        usage=tenant.get("usage", {}),
        created_at=tenant.get("created_at", datetime.now(timezone.utc)),
    )


@orgs_router.put("/{org_id}", response_model=TenantResponse)
async def update_organization(
    org_id: str,
    update_data: TenantUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an organization. Only the owner can update."""
    tenant = await db.tenants.find_one({"id": org_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Organization not found")

    if tenant.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the organization owner can update settings")

    update_fields = {}
    if update_data.name is not None:
        update_fields["name"] = update_data.name
    if update_data.subdomain is not None:
        # Check subdomain uniqueness
        existing = await db.tenants.find_one({
            "subdomain": update_data.subdomain,
            "id": {"$ne": org_id},
        })
        if existing:
            raise HTTPException(status_code=409, detail="Subdomain already in use")
        update_fields["subdomain"] = update_data.subdomain

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields["updated_at"] = datetime.now(timezone.utc)
    await db.tenants.update_one({"id": org_id}, {"$set": update_fields})

    updated_tenant = await db.tenants.find_one({"id": org_id})
    return TenantResponse(
        id=updated_tenant["id"],
        name=updated_tenant["name"],
        subdomain=updated_tenant.get("subdomain", ""),
        subscription=updated_tenant.get("subscription", {}),
        quotas=updated_tenant.get("quotas", {}),
        usage=updated_tenant.get("usage", {}),
        created_at=updated_tenant.get("created_at", datetime.now(timezone.utc)),
    )


@orgs_router.delete("/{org_id}")
async def delete_organization(
    org_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete an organization. Only the owner can delete."""
    tenant = await db.tenants.find_one({"id": org_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Organization not found")

    if tenant.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the organization owner can delete the organization")

    # Clean up all tenant data
    await db.documentation.delete_many({"tenant_id": org_id})
    await db.repositories.delete_many({"tenant_id": org_id})
    await db.jobs.delete_many({"tenant_id": org_id})
    await db.users.update_many(
        {"tenant_id": org_id},
        {"$unset": {"tenant_id": ""}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )
    await db.tenants.delete_one({"id": org_id})

    return {"message": "Organization deleted successfully"}


@orgs_router.get("/{org_id}/members")
async def list_members(
    org_id: str,
    current_user: dict = Depends(get_current_user),
):
    """List all members of an organization."""
    tenant = await db.tenants.find_one({"id": org_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Organization not found")

    if current_user["tenant_id"] != org_id:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    members = await get_tenant_members(org_id)
    return {"members": members}


@orgs_router.post("/{org_id}/members")
async def invite_organization_member(
    org_id: str,
    invite_data: MemberInvite,
    current_user: dict = Depends(get_current_user),
):
    """Invite a new member to the organization."""
    tenant = await db.tenants.find_one({"id": org_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Organization not found")

    if current_user["tenant_id"] != org_id:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    # Check role permissions: only owner or admin can invite
    user_role = current_user.get("role", "member")
    if user_role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can invite members")

    result = await invite_member(
        tenant_id=org_id,
        email=invite_data.email,
        role=invite_data.role,
    )

    return result


@orgs_router.delete("/{org_id}/members/{user_id}")
async def remove_organization_member(
    org_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove a member from the organization. Only owner or admin can remove."""
    tenant = await db.tenants.find_one({"id": org_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Organization not found")

    if current_user["tenant_id"] != org_id:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    user_role = current_user.get("role", "member")
    if user_role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can remove members")

    # Prevent removing the owner
    if tenant.get("owner_id") == user_id:
        raise HTTPException(status_code=400, detail="Cannot remove the organization owner")

    # Prevent non-owners from removing admins
    if user_role == "admin":
        target_user = await db.users.find_one({"id": user_id, "tenant_id": org_id})
        if target_user and target_user.get("role") == "admin":
            raise HTTPException(status_code=403, detail="Admins cannot remove other admins")

    await remove_member(tenant_id=org_id, user_id=user_id)
    return {"message": "Member removed successfully"}


@orgs_router.put("/{org_id}/members/{user_id}/role")
async def update_organization_member_role(
    org_id: str,
    user_id: str,
    role_data: MemberRoleUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a member's role. Only owner or admin can update roles."""
    tenant = await db.tenants.find_one({"id": org_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Organization not found")

    if current_user["tenant_id"] != org_id:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    user_role = current_user.get("role", "member")
    if user_role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can update member roles")

    # Prevent changing the owner's role
    if tenant.get("owner_id") == user_id:
        raise HTTPException(status_code=400, detail="Cannot change the owner's role")

    valid_roles = ("member", "admin", "viewer")
    if role_data.role not in valid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}",
        )

    await update_member_role(tenant_id=org_id, user_id=user_id, new_role=role_data.role)
    return {"message": f"Member role updated to {role_data.role}"}


@orgs_router.post("/upgrade")
async def upgrade_subscription(
    tier: str = Query(..., description="The subscription tier to upgrade to"),
    current_user: dict = Depends(get_current_user),
):
    """Upgrade the organization's subscription tier."""
    tenant_id = current_user["tenant_id"]
    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Organization not found")

    if tenant.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the organization owner can upgrade the subscription")

    if tier not in SUBSCRIPTION_TIERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier. Available tiers: {', '.join(SUBSCRIPTION_TIERS.keys())}",
        )

    current_tier = tenant.get("subscription", {}).get("tier", "free")
    if current_tier == tier:
        raise HTTPException(status_code=400, detail="Already on this subscription tier")

    tier_config = SUBSCRIPTION_TIERS[tier]
    now = datetime.now(timezone.utc)

    await db.tenants.update_one(
        {"id": tenant_id},
        {
            "$set": {
                "subscription.tier": tier,
                "subscription.updated_at": now,
                "subscription.started_at": now,
                "subscription.expires_at": now + timedelta(days=30),
                "quotas": tier_config,
                "updated_at": now,
            }
        },
    )

    updated_tenant = await db.tenants.find_one({"id": tenant_id})
    return {
        "message": f"Subscription upgraded to {tier}",
        "subscription": updated_tenant.get("subscription", {}),
        "quotas": updated_tenant.get("quotas", {}),
    }
