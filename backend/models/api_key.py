from pydantic import BaseModel
from typing import Optional, List


class ApiKeyCreate(BaseModel):
    name: str
    scopes: List[str] = ["read", "write"]


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    scopes: List[str] = []
    created_at: str
    last_used_at: Optional[str] = None
    is_active: bool = True


class ApiKeyCreatedResponse(BaseModel):
    id: str
    name: str
    key: str
    key_prefix: str
    scopes: List[str] = []
    created_at: str
