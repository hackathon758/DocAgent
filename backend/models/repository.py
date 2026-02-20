from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RepositoryCreate(BaseModel):
    name: str
    repo_url: str
    provider: str = "github"
    branch: str = "main"
    language: str = "python"


class RepositoryResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    provider: str
    repo_url: str
    branch: str
    language: str
    last_synced_at: Optional[datetime] = None
    components_count: int = 0
    coverage_percentage: float = 0.0
    created_at: datetime


class WebhookConfig(BaseModel):
    url: str
    secret: Optional[str] = None
    events: list = ["push"]
    active: bool = True
