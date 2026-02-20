from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from database import db
from middleware.auth import get_current_user
from models import RepositoryCreate, RepositoryResponse, WebhookConfig
from services.doc_service import fetch_github_repo_contents

repos_router = APIRouter(prefix="/api/repositories", tags=["Repositories"])


@repos_router.get("/", response_model=List[RepositoryResponse])
async def list_repositories(current_user: dict = Depends(get_current_user)):
    """List all repositories belonging to the current user's tenant."""
    tenant_id = current_user["tenant_id"]
    repos = await db.repositories.find({"tenant_id": tenant_id}).to_list(length=None)
    return repos


@repos_router.post("/", response_model=RepositoryResponse, status_code=201)
async def create_repository(repo_data: RepositoryCreate, current_user: dict = Depends(get_current_user)):
    """Create a new repository for the current user's tenant."""
    tenant_id = current_user["tenant_id"]
    repo_id = str(uuid.uuid4())

    repository = {
        "id": repo_id,
        "tenant_id": tenant_id,
        "name": repo_data.name,
        "repo_url": repo_data.repo_url,
        "provider": repo_data.provider,
        "branch": repo_data.branch,
        "language": repo_data.language,
        "status": "pending",
        "components_count": 0,
        "coverage_percentage": 0.0,
        "last_synced_at": None,
        "webhook_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }

    await db.repositories.insert_one(repository)
    return repository


@repos_router.get("/{repo_id}", response_model=RepositoryResponse)
async def get_repository(repo_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single repository by ID, scoped to the current user's tenant."""
    tenant_id = current_user["tenant_id"]
    repo = await db.repositories.find_one({"id": repo_id, "tenant_id": tenant_id})

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    return repo


@repos_router.put("/{repo_id}", response_model=RepositoryResponse)
async def update_repository(repo_id: str, repo_data: RepositoryCreate, current_user: dict = Depends(get_current_user)):
    """Update an existing repository."""
    tenant_id = current_user["tenant_id"]
    repo = await db.repositories.find_one({"id": repo_id, "tenant_id": tenant_id})

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    update_fields = {
        "name": repo_data.name,
        "repo_url": repo_data.repo_url,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    if hasattr(repo_data, "description") and repo_data.description is not None:
        update_fields["description"] = repo_data.description

    if hasattr(repo_data, "branch") and repo_data.branch is not None:
        update_fields["branch"] = repo_data.branch

    await db.repositories.update_one(
        {"id": repo_id, "tenant_id": tenant_id},
        {"$set": update_fields}
    )

    updated_repo = await db.repositories.find_one({"id": repo_id, "tenant_id": tenant_id})
    return updated_repo


@repos_router.delete("/{repo_id}")
async def delete_repository(repo_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a repository by ID."""
    tenant_id = current_user["tenant_id"]
    repo = await db.repositories.find_one({"id": repo_id, "tenant_id": tenant_id})

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    await db.repositories.delete_one({"id": repo_id, "tenant_id": tenant_id})

    return {"message": "Repository deleted successfully", "id": repo_id}


@repos_router.post("/{repo_id}/sync")
async def sync_repository(repo_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Sync a repository by fetching its contents from GitHub."""
    tenant_id = current_user["tenant_id"]
    repo = await db.repositories.find_one({"id": repo_id, "tenant_id": tenant_id})

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Update status to syncing
    await db.repositories.update_one(
        {"id": repo_id, "tenant_id": tenant_id},
        {"$set": {"status": "syncing", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    try:
        # Fetch repository contents from GitHub
        files = await fetch_github_repo_contents(repo["repo_url"], repo.get("branch", "main"))

        components_count = len(files) if files else 0
        now = datetime.now(timezone.utc).isoformat()

        # Update repository with sync results
        await db.repositories.update_one(
            {"id": repo_id, "tenant_id": tenant_id},
            {"$set": {
                "status": "synced",
                "components_count": components_count,
                "last_synced_at": now,
                "updated_at": now
            }}
        )

        return {
            "message": "Repository synced successfully",
            "id": repo_id,
            "components_count": components_count,
            "last_synced_at": now
        }

    except Exception as e:
        # Mark sync as failed
        await db.repositories.update_one(
            {"id": repo_id, "tenant_id": tenant_id},
            {"$set": {
                "status": "error",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        raise HTTPException(status_code=500, detail=f"Failed to sync repository: {str(e)}")


@repos_router.get("/{repo_id}/webhooks")
async def get_webhook_config(repo_id: str, current_user: dict = Depends(get_current_user)):
    """Get the webhook configuration for a repository."""
    tenant_id = current_user["tenant_id"]
    repo = await db.repositories.find_one({"id": repo_id, "tenant_id": tenant_id})

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    webhook_url = repo.get("webhook_url")

    if webhook_url:
        return {
            "url": webhook_url,
            "events": repo.get("webhook_events", ["push"]),
            "active": repo.get("webhook_active", True)
        }

    # Return empty config if no webhook is configured
    return {
        "url": None,
        "events": ["push"],
        "active": False
    }


@repos_router.post("/{repo_id}/webhooks")
async def create_or_update_webhook(repo_id: str, config: WebhookConfig, current_user: dict = Depends(get_current_user)):
    """Create or update the webhook configuration for a repository."""
    tenant_id = current_user["tenant_id"]
    repo = await db.repositories.find_one({"id": repo_id, "tenant_id": tenant_id})

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    await db.repositories.update_one(
        {"id": repo_id, "tenant_id": tenant_id},
        {"$set": {
            "webhook_url": config.url,
            "webhook_events": config.events,
            "webhook_active": config.active,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    return {
        "message": "Webhook configuration saved",
        "url": config.url,
        "events": config.events,
        "active": config.active
    }
