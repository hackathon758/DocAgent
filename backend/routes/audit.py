from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from database import db
from middleware.auth import get_current_user
from models.audit import AuditLogResponse, AuditLogListResponse

audit_router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])


async def log_audit_event(
    tenant_id: str,
    user_id: str,
    action: str,
    resource_type: str = None,
    resource_id: str = None,
    metadata: dict = None,
    ip_address: str = None,
):
    """Helper to create an audit log entry. Called from other routes/middleware."""
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "user_id": user_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "metadata": metadata or {},
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


@audit_router.get("/", response_model=AuditLogListResponse)
async def list_audit_logs(
    page: int = 1,
    page_size: int = 50,
    action: str = None,
    user_id: str = None,
    current_user: dict = Depends(get_current_user),
):
    """List audit logs for the organization (owner/admin only)."""
    if current_user.get("role") not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can view audit logs")

    query = {"tenant_id": current_user["tenant_id"]}
    if action:
        query["action"] = action
    if user_id:
        query["user_id"] = user_id

    total = await db.audit_logs.count_documents(query)
    skip = (page - 1) * page_size

    logs = await db.audit_logs.find(query).sort("created_at", -1).skip(skip).limit(page_size).to_list(page_size)

    # Fetch user emails for display
    user_ids = list(set(log["user_id"] for log in logs))
    users = await db.users.find({"id": {"$in": user_ids}}).to_list(len(user_ids))
    user_map = {u["id"]: u.get("email", "") for u in users}

    return AuditLogListResponse(
        logs=[
            AuditLogResponse(
                id=log["id"],
                user_id=log["user_id"],
                user_email=user_map.get(log["user_id"]),
                action=log["action"],
                resource_type=log.get("resource_type"),
                resource_id=log.get("resource_id"),
                metadata=log.get("metadata"),
                ip_address=log.get("ip_address"),
                created_at=log["created_at"],
            )
            for log in logs
        ],
        total=total,
        page=page,
        page_size=page_size,
    )
