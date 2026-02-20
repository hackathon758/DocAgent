from pydantic import BaseModel
from typing import Optional, List


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    language: Optional[str] = None
    content: str
    sections: List[str] = ["overview", "parameters", "returns", "examples"]


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None
    content: Optional[str] = None
    sections: Optional[List[str]] = None


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    language: Optional[str] = None
    content: str
    sections: List[str] = []
    is_default: bool = False
    tenant_id: str
    created_by: str
    created_at: str
    updated_at: Optional[str] = None
