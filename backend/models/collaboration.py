from pydantic import BaseModel
from typing import Optional


class CommentCreate(BaseModel):
    content: str
    section_id: Optional[str] = None


class CommentUpdate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    documentation_id: str
    content: str
    section_id: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None


class ShareLinkCreate(BaseModel):
    expires_in_days: Optional[int] = None


class ShareLinkResponse(BaseModel):
    id: str
    token: str
    documentation_id: str
    created_by: str
    expires_at: Optional[str] = None
    created_at: str
    is_active: bool = True
