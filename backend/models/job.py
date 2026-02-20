from pydantic import BaseModel
from typing import Optional, Dict, Any


class JobCreate(BaseModel):
    repository_id: str
    component_path: Optional[str] = None
    type: str = "generate"


class JobResponse(BaseModel):
    id: str
    tenant_id: str
    type: str
    status: str
    progress: int = 0
    stage: Optional[str] = None
    repository_id: Optional[str] = None
    component_path: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None


class AgentProgressResponse(BaseModel):
    job_id: str
    status: str
    current_agent: str
    agents: Dict[str, Dict[str, Any]]
    files_processed: int
    total_files: int
    overall_progress: int
