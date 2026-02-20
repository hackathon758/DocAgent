from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from database import db
from middleware.auth import get_current_user
from models.notification import NotificationResponse, NotificationCountResponse

notifications_router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


async def create_notification(user_id: str, tenant_id: str, type: str, title: str, message: str, metadata: dict = None):
    """Helper to create a notification. Called from other routes."""
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "tenant_id": tenant_id,
        "type": type,
        "title": title,
        "message": message,
        "read": False,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


@notifications_router.get("/", response_model=list[NotificationResponse])
async def list_notifications(skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """List notifications for the current user."""
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return [
        NotificationResponse(
            id=n["id"],
            user_id=n["user_id"],
            type=n["type"],
            title=n["title"],
            message=n["message"],
            read=n.get("read", False),
            metadata=n.get("metadata"),
            created_at=n["created_at"],
        )
        for n in notifications
    ]


@notifications_router.get("/unread-count", response_model=NotificationCountResponse)
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get the count of unread notifications."""
    count = await db.notifications.count_documents(
        {"user_id": current_user["id"], "read": False}
    )
    return NotificationCountResponse(unread_count=count)


@notifications_router.put("/{notification_id}/read")
async def mark_as_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read."""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}


@notifications_router.put("/read-all")
async def mark_all_as_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read."""
    await db.notifications.update_many(
        {"user_id": current_user["id"], "read": False},
        {"$set": {"read": True}},
    )
    return {"message": "All notifications marked as read"}
