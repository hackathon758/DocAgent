from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class DocumentationCreate(BaseModel):
    repository_id: str
    component_path: str
    source_code: str
    component_type: str = "function"
    language: str = "python"


class DocumentationResponse(BaseModel):
    id: str
    tenant_id: str
    repository_id: str
    component_path: str
    component_type: str
    language: str
    docstring: Optional[str] = None
    markdown: Optional[str] = None
    diagrams: List[Dict[str, Any]] = []
    quality_score: float = 0.0
    version: int = 1
    generated_at: Optional[datetime] = None
    created_at: datetime


class DocumentationUpdate(BaseModel):
    docstring: Optional[str] = None
    markdown: Optional[str] = None


class GenerateDocsRequest(BaseModel):
    repository_id: str
    component_path: str
    source_code: str
    language: str = "python"
    style: str = "google"


class RepoDocumentationRequest(BaseModel):
    repo_url: str
    branch: str = "main"
    github_token: Optional[str] = None


class BatchExportRequest(BaseModel):
    doc_ids: List[str]
    format: str = "markdown"
