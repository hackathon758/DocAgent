from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime


class TenantCreate(BaseModel):
    name: str
    subdomain: str


class TenantResponse(BaseModel):
    id: str
    name: str
    subdomain: str
    subscription: Dict[str, Any]
    quotas: Dict[str, int]
    usage: Dict[str, Any]
    created_at: datetime


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    subdomain: Optional[str] = None


class MemberInvite(BaseModel):
    email: str
    role: str = "member"


class MemberRoleUpdate(BaseModel):
    role: str
