from pydantic import BaseModel
from typing import Optional, Dict, Any, List


class WebhookPayload(BaseModel):
    ref: Optional[str] = None
    repository: Optional[Dict[str, Any]] = None
    commits: Optional[List[Dict[str, Any]]] = None


class GitLabWebhookPayload(BaseModel):
    ref: Optional[str] = None
    project: Optional[Dict[str, Any]] = None
    commits: Optional[List[Dict[str, Any]]] = None


class BitbucketWebhookPayload(BaseModel):
    push: Optional[Dict[str, Any]] = None
    repository: Optional[Dict[str, Any]] = None
