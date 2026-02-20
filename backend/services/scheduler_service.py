"""
Scheduler service for DocAgent.
Handles scheduled documentation regeneration using APScheduler.
Falls back to a simple in-memory scheduler when APScheduler is not installed.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

_scheduler = None
_scheduler_available = False


def _get_scheduler():
    global _scheduler, _scheduler_available
    if _scheduler is not None:
        return _scheduler

    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        _scheduler = AsyncIOScheduler()
        _scheduler_available = True
        logger.info("APScheduler initialized successfully")
    except ImportError:
        _scheduler_available = False
        logger.warning("APScheduler not installed. Scheduled regeneration will be stored but not executed.")
        _scheduler = None

    return _scheduler


async def start_scheduler():
    """Start the scheduler on application startup."""
    scheduler = _get_scheduler()
    if scheduler and _scheduler_available:
        scheduler.start()
        logger.info("Scheduler started")
        # Load existing schedules from DB
        await _load_schedules_from_db()


async def stop_scheduler():
    """Shutdown the scheduler gracefully."""
    global _scheduler
    if _scheduler and _scheduler_available:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
        _scheduler = None


async def _load_schedules_from_db():
    """Load existing schedules from the database and register them."""
    from database import db

    schedules = await db.schedules.find({"is_active": True}).to_list(None)
    for schedule in schedules:
        try:
            await add_schedule_job(
                schedule_id=schedule["id"],
                interval=schedule["interval"],
                doc_id=schedule.get("documentation_id"),
                tenant_id=schedule["tenant_id"],
            )
        except Exception as e:
            logger.error(f"Failed to load schedule {schedule['id']}: {e}")

    logger.info(f"Loaded {len(schedules)} schedules from database")


async def add_schedule_job(
    schedule_id: str,
    interval: str,
    doc_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
):
    """Add a scheduled job for documentation regeneration."""
    if not _scheduler_available or not _scheduler:
        logger.info(f"Schedule {schedule_id} saved but scheduler not available")
        return

    interval_map = {
        "daily": {"days": 1},
        "weekly": {"weeks": 1},
        "monthly": {"weeks": 4},
    }

    kwargs = interval_map.get(interval, {"days": 1})

    _scheduler.add_job(
        _run_scheduled_generation,
        "interval",
        id=schedule_id,
        kwargs={"schedule_id": schedule_id, "doc_id": doc_id, "tenant_id": tenant_id},
        replace_existing=True,
        **kwargs,
    )
    logger.info(f"Scheduled job {schedule_id} with interval {interval}")


async def remove_schedule_job(schedule_id: str):
    """Remove a scheduled job."""
    if _scheduler_available and _scheduler:
        try:
            _scheduler.remove_job(schedule_id)
        except Exception:
            pass


async def _run_scheduled_generation(schedule_id: str, doc_id: str = None, tenant_id: str = None):
    """Execute a scheduled documentation regeneration."""
    from database import db

    logger.info(f"Running scheduled regeneration for schedule {schedule_id}")

    if not doc_id or not tenant_id:
        schedule = await db.schedules.find_one({"id": schedule_id})
        if not schedule:
            return
        doc_id = schedule.get("documentation_id")
        tenant_id = schedule.get("tenant_id")

    doc = await db.documentation.find_one({"id": doc_id, "tenant_id": tenant_id})
    if not doc:
        logger.warning(f"Documentation {doc_id} not found for scheduled regeneration")
        return

    # Create a regeneration job
    import uuid
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    job_record = {
        "id": job_id,
        "tenant_id": tenant_id,
        "type": "scheduled_regenerate",
        "status": "queued",
        "progress": 0,
        "stage": "queued",
        "documentation_id": doc_id,
        "schedule_id": schedule_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.jobs.insert_one(job_record)

    # Update schedule last_run
    await db.schedules.update_one(
        {"id": schedule_id},
        {"$set": {"last_run_at": now}}
    )

    logger.info(f"Created regeneration job {job_id} for schedule {schedule_id}")
