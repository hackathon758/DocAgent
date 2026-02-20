"""
Webhook routes – handles push events from GitHub, GitLab, and Bitbucket to
trigger automatic documentation regeneration.
Extracted from server.py lines 2580-2644, with new GitLab and Bitbucket support.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from datetime import datetime, timezone
from typing import Dict, Any
import uuid
import re
import logging

from database import db
from models import WebhookPayload, GitLabWebhookPayload, BitbucketWebhookPayload
from routes.repo_docs import active_doc_jobs, process_repo_documentation

logger = logging.getLogger(__name__)
webhook_router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])


# ---------------------------------------------------------------------------
# Shared helper
# ---------------------------------------------------------------------------

async def _trigger_doc_regeneration(
    repo_url: str,
    branch: str,
    source: str,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """Common logic shared by all webhook handlers.

    Looks up the most recent documentation job for the repo and, if found,
    queues a regeneration job.
    """
    from services.doc_service import fetch_github_repo_contents

    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Attempt to fetch files from the repo
    try:
        files = await fetch_github_repo_contents(repo_url, branch)
    except Exception as e:
        logger.error(f"[{source} webhook] Failed to fetch repo contents for {repo_url}: {e}")
        raise HTTPException(status_code=502, detail=f"Could not fetch repository contents: {e}")

    if not files:
        raise HTTPException(status_code=404, detail="No processable files found in the repository")

    active_doc_jobs[job_id] = {
        "job_id": job_id,
        "repo_url": repo_url,
        "branch": branch,
        "user_id": f"webhook-{source}",
        "status": "starting",
        "total_files": len(files),
        "files_completed": 0,
        "current_file": None,
        "current_file_index": 0,
        "progress": 0,
        "file_results": [],
        "error": None,
        "created_at": now,
        "completed_at": None,
    }

    background_tasks.add_task(
        process_repo_documentation,
        job_id,
        files,
        repo_url,
        branch,
        f"webhook-{source}",
    )

    return {
        "job_id": job_id,
        "status": "started",
        "total_files": len(files),
        "source": source,
        "repo_url": repo_url,
        "branch": branch,
        "message": f"Documentation regeneration triggered by {source} webhook",
    }


# ---------------------------------------------------------------------------
# GitHub webhook
# ---------------------------------------------------------------------------

@webhook_router.post("/github")
async def github_webhook(payload: WebhookPayload, background_tasks: BackgroundTasks):
    """Handle a GitHub push webhook event.

    Extracts the repository URL and branch from the payload, then triggers
    documentation regeneration.
    """
    repo_url = payload.repository.get("html_url") if payload.repository else None
    if not repo_url:
        raise HTTPException(status_code=400, detail="Missing repository URL in webhook payload")

    branch = "main"
    if payload.ref:
        branch = payload.ref.replace("refs/heads/", "")

    logger.info(f"GitHub webhook received for {repo_url} branch={branch}")

    # Check if documentation exists for this repo
    try:
        existing = await db.repo_documentation.find_one({"repo_url": repo_url})
        if not existing:
            logger.info(f"No existing documentation found for {repo_url}, skipping regeneration")
            return {
                "status": "skipped",
                "message": "No existing documentation found for this repository",
                "repo_url": repo_url,
            }
    except Exception as e:
        logger.warning(f"Database lookup failed, proceeding anyway: {e}")

    return await _trigger_doc_regeneration(repo_url, branch, "github", background_tasks)


# ---------------------------------------------------------------------------
# GitLab webhook
# ---------------------------------------------------------------------------

@webhook_router.post("/gitlab")
async def gitlab_webhook(payload: GitLabWebhookPayload, background_tasks: BackgroundTasks):
    """Handle a GitLab push webhook event.

    GitLab payloads use `project.web_url` for the repository URL and `ref`
    for the branch reference.
    """
    # Extract repo URL from project.web_url
    repo_url = None
    if payload.project:
        repo_url = payload.project.get("web_url")
    if not repo_url:
        raise HTTPException(status_code=400, detail="Missing project.web_url in GitLab webhook payload")

    # Extract branch
    branch = "main"
    if payload.ref:
        branch = payload.ref.replace("refs/heads/", "")

    logger.info(f"GitLab webhook received for {repo_url} branch={branch}")

    # Check for existing documentation
    try:
        existing = await db.repo_documentation.find_one({"repo_url": repo_url})
        if not existing:
            logger.info(f"No existing documentation found for {repo_url}, skipping regeneration")
            return {
                "status": "skipped",
                "message": "No existing documentation found for this repository",
                "repo_url": repo_url,
            }
    except Exception as e:
        logger.warning(f"Database lookup failed, proceeding anyway: {e}")

    return await _trigger_doc_regeneration(repo_url, branch, "gitlab", background_tasks)


# ---------------------------------------------------------------------------
# Bitbucket webhook
# ---------------------------------------------------------------------------

@webhook_router.post("/bitbucket")
async def bitbucket_webhook(payload: BitbucketWebhookPayload, background_tasks: BackgroundTasks):
    """Handle a Bitbucket push webhook event.

    Bitbucket payloads use `repository.links.html.href` for the repo URL and
    `push.changes[].new.name` for the branch name.
    """
    # Extract repo URL
    repo_url = None
    if payload.repository:
        links = payload.repository.get("links", {})
        html_link = links.get("html", {})
        repo_url = html_link.get("href") if isinstance(html_link, dict) else None
    if not repo_url:
        raise HTTPException(status_code=400, detail="Missing repository URL in Bitbucket webhook payload")

    # Extract branch from push changes
    branch = "main"
    if payload.push:
        changes = payload.push.get("changes", [])
        if changes and isinstance(changes, list):
            first_change = changes[0]
            new_ref = first_change.get("new", {})
            if new_ref and isinstance(new_ref, dict):
                branch = new_ref.get("name", "main")

    logger.info(f"Bitbucket webhook received for {repo_url} branch={branch}")

    # Check for existing documentation
    try:
        existing = await db.repo_documentation.find_one({"repo_url": repo_url})
        if not existing:
            logger.info(f"No existing documentation found for {repo_url}, skipping regeneration")
            return {
                "status": "skipped",
                "message": "No existing documentation found for this repository",
                "repo_url": repo_url,
            }
    except Exception as e:
        logger.warning(f"Database lookup failed, proceeding anyway: {e}")

    return await _trigger_doc_regeneration(repo_url, branch, "bitbucket", background_tasks)
