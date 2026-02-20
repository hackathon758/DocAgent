from pydantic import BaseModel
from typing import Optional, Dict, Any


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    read: bool = False
    metadata: Optional[Dict[str, Any]] = None
    created_at: str


class NotificationCountResponse(BaseModel):
    unread_count: int
