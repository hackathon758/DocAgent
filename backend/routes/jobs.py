from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from database import db
from middleware.auth import get_current_user
from models import JobResponse

jobs_router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


@jobs_router.get("/")
async def list_jobs(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """List jobs, optionally filtered by status. Returns most recent 50 jobs."""
    tenant_id = user["tenant_id"]
    query = {"tenant_id": tenant_id}
    if status:
        query["status"] = status

    jobs = (
        await db.jobs.find(query)
        .sort("created_at", -1)
        .to_list(length=50)
    )

    for job in jobs:
        job.pop("_id", None)
    return jobs


@jobs_router.get("/{job_id}")
async def get_job(
    job_id: str,
    user: dict = Depends(get_current_user),
):
    """Retrieve a single job by id."""
    tenant_id = user["tenant_id"]
    job = await db.jobs.find_one({"id": job_id, "tenant_id": tenant_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.pop("_id", None)
    return job


@jobs_router.post("/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    user: dict = Depends(get_current_user),
):
    """Cancel a running or queued job.

    Only jobs with status 'queued' or 'processing' can be cancelled.
    Returns an error if the job has already completed, failed, or been cancelled.
    """
    tenant_id = user["tenant_id"]
    job = await db.jobs.find_one({"id": job_id, "tenant_id": tenant_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    current_status = job.get("status")
    if current_status not in ("queued", "processing"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job with status '{current_status}'. Only 'queued' or 'processing' jobs can be cancelled.",
        )

    now = datetime.now(timezone.utc).isoformat()
    await db.jobs.update_one(
        {"id": job_id, "tenant_id": tenant_id},
        {
            "$set": {
                "status": "cancelled",
                "stage": "cancelled",
                "updated_at": now,
                "completed_at": now,
            }
        },
    )

    return {"job_id": job_id, "status": "cancelled"}


@jobs_router.get("/{job_id}/logs")
async def get_job_logs(
    job_id: str,
    user: dict = Depends(get_current_user),
):
    """Retrieve execution logs for a specific job."""
    tenant_id = user["tenant_id"]

    # Verify the job exists and belongs to this tenant
    job = await db.jobs.find_one({"id": job_id, "tenant_id": tenant_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    logs = (
        await db.job_logs.find({"job_id": job_id})
        .sort("timestamp", 1)
        .to_list(length=None)
    )

    for log_entry in logs:
        log_entry.pop("_id", None)
    return logs
