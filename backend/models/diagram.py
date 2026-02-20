from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class DiagramRequest(BaseModel):
    component_data: Dict[str, Any]
    diagram_type: Optional[str] = None


class DiagramCreate(BaseModel):
    documentation_id: Optional[str] = None
    repository_id: Optional[str] = None
    source_code: str
    diagram_type: Optional[str] = None


class DiagramResponse(BaseModel):
    id: str
    tenant_id: str
    documentation_id: Optional[str] = None
    repository_id: Optional[str] = None
    diagram_type: str
    mermaid_code: str
    description: Optional[str] = None
    validation_status: str = "valid"
    created_at: datetime
    updated_at: Optional[datetime] = None


class DiagramUpdate(BaseModel):
    mermaid_code: Optional[str] = None
    diagram_type: Optional[str] = None
    description: Optional[str] = None
