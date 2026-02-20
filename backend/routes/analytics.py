from fastapi import APIRouter, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import Optional

from database import db
from middleware.auth import get_current_user

analytics_router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@analytics_router.get("/overview")
async def get_analytics_overview(current_user: dict = Depends(get_current_user)):
    """Get analytics overview with real counts from the database."""
    tenant_id = current_user["tenant_id"]

    total_repositories = await db.repositories.count_documents({"tenant_id": tenant_id})
    total_documentation = await db.documentation.count_documents({"tenant_id": tenant_id})
    total_jobs = await db.jobs.count_documents({"tenant_id": tenant_id})

    # Average quality score via aggregation
    quality_pipeline = [
        {"$match": {"tenant_id": tenant_id, "metadata.quality_score": {"$exists": True}}},
        {"$group": {"_id": None, "avg_score": {"$avg": "$metadata.quality_score"}}},
    ]
    quality_result = await db.documentation.aggregate(quality_pipeline).to_list(1)
    average_quality_score = round(quality_result[0]["avg_score"], 2) if quality_result else 0.0

    # Recent 5 jobs
    recent_jobs_cursor = db.jobs.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "job_id": 1, "status": 1, "created_at": 1, "repository": 1, "type": 1},
    ).sort("created_at", -1).limit(5)
    recent_jobs = await recent_jobs_cursor.to_list(5)
    for job in recent_jobs:
        if "created_at" in job and isinstance(job["created_at"], datetime):
            job["created_at"] = job["created_at"].isoformat()

    # Components documented this month
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    components_documented_this_month = await db.documentation.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": start_of_month},
    })

    # Coverage percentage: documented components / total components tracked
    total_components = await db.documentation.count_documents({"tenant_id": tenant_id})
    coverage_pipeline = [
        {"$match": {"tenant_id": tenant_id, "metadata.quality_score": {"$gte": 50}}},
        {"$count": "covered"},
    ]
    coverage_result = await db.documentation.aggregate(coverage_pipeline).to_list(1)
    covered = coverage_result[0]["covered"] if coverage_result else 0
    coverage_percentage = round((covered / total_components) * 100, 2) if total_components > 0 else 0.0

    return {
        "total_repositories": total_repositories,
        "total_documentation": total_documentation,
        "total_jobs": total_jobs,
        "average_quality_score": average_quality_score,
        "recent_jobs": recent_jobs,
        "components_documented_this_month": components_documented_this_month,
        "coverage_percentage": coverage_percentage,
    }


@analytics_router.get("/coverage")
async def get_coverage_stats(current_user: dict = Depends(get_current_user)):
    """Get documentation coverage statistics broken down by language, repository, and weekly trend."""
    tenant_id = current_user["tenant_id"]

    # Aggregate docs by language
    lang_pipeline = [
        {"$match": {"tenant_id": tenant_id, "language": {"$exists": True}}},
        {"$group": {"_id": "$language", "count": {"$sum": 1}}},
    ]
    lang_results = await db.documentation.aggregate(lang_pipeline).to_list(None)
    by_language = {item["_id"]: item["count"] for item in lang_results if item["_id"]}

    # Aggregate docs by repository
    repo_pipeline = [
        {"$match": {"tenant_id": tenant_id, "repository_id": {"$exists": True}}},
        {
            "$lookup": {
                "from": "repositories",
                "localField": "repository_id",
                "foreignField": "id",
                "as": "repo_info",
            }
        },
        {"$unwind": {"path": "$repo_info", "preserveNullAndEmptyArrays": True}},
        {
            "$group": {
                "_id": "$repository_id",
                "repo_name": {"$first": {"$ifNull": ["$repo_info.name", "$repository_id"]}},
                "doc_count": {"$sum": 1},
            }
        },
    ]
    repo_results = await db.documentation.aggregate(repo_pipeline).to_list(None)
    by_repository = [
        {"repository": item["repo_name"], "doc_count": item["doc_count"]}
        for item in repo_results
    ]

    # Trend: last 4 weeks of doc creation counts
    now = datetime.now(timezone.utc)
    trend = []
    for weeks_ago in range(3, -1, -1):
        week_start = now - timedelta(weeks=weeks_ago + 1)
        week_end = now - timedelta(weeks=weeks_ago)
        count = await db.documentation.count_documents({
            "tenant_id": tenant_id,
            "created_at": {"$gte": week_start, "$lt": week_end},
        })
        trend.append({
            "week_start": week_start.strftime("%Y-%m-%d"),
            "week_end": week_end.strftime("%Y-%m-%d"),
            "count": count,
        })

    return {
        "by_language": by_language,
        "by_repository": by_repository,
        "trend": trend,
    }


@analytics_router.get("/quality")
async def get_quality_distribution(current_user: dict = Depends(get_current_user)):
    """Get quality score distribution across documentation."""
    tenant_id = current_user["tenant_id"]

    # Bucket quality scores into ranges
    bucket_pipeline = [
        {"$match": {"tenant_id": tenant_id, "metadata.quality_score": {"$exists": True}}},
        {
            "$bucket": {
                "groupBy": "$metadata.quality_score",
                "boundaries": [0, 20, 40, 60, 80, 100.01],
                "default": "other",
                "output": {"count": {"$sum": 1}},
            }
        },
    ]
    bucket_results = await db.documentation.aggregate(bucket_pipeline).to_list(None)

    bucket_labels = {0: "0-20", 20: "20-40", 40: "40-60", 60: "60-80", 80: "80-100"}
    distribution = {label: 0 for label in bucket_labels.values()}
    for item in bucket_results:
        label = bucket_labels.get(item["_id"])
        if label:
            distribution[label] = item["count"]

    # Aggregate min, max, avg quality scores
    stats_pipeline = [
        {"$match": {"tenant_id": tenant_id, "metadata.quality_score": {"$exists": True}}},
        {
            "$group": {
                "_id": None,
                "average": {"$avg": "$metadata.quality_score"},
                "min": {"$min": "$metadata.quality_score"},
                "max": {"$max": "$metadata.quality_score"},
            }
        },
    ]
    stats_result = await db.documentation.aggregate(stats_pipeline).to_list(1)

    if stats_result:
        average = round(stats_result[0]["average"], 2)
        min_score = round(stats_result[0]["min"], 2)
        max_score = round(stats_result[0]["max"], 2)
    else:
        average = 0.0
        min_score = 0.0
        max_score = 0.0

    return {
        "distribution": distribution,
        "average": average,
        "min": min_score,
        "max": max_score,
    }


@analytics_router.get("/usage")
async def get_usage_tracking(current_user: dict = Depends(get_current_user)):
    """Get usage and quota tracking for the current tenant."""
    tenant_id = current_user["tenant_id"]

    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        return {"error": "Tenant not found"}

    quotas = tenant.get("quotas", {})
    subscription = tenant.get("subscription", {})
    subscription_tier = subscription.get("tier", "free")

    components_used = await db.documentation.count_documents({"tenant_id": tenant_id})
    repositories_used = await db.repositories.count_documents({"tenant_id": tenant_id})
    team_members = await db.users.count_documents({"tenant_id": tenant_id})

    components_limit = quotas.get("components_per_month", 0)
    repositories_limit = quotas.get("max_repositories", 0)
    team_members_limit = quotas.get("max_team_members", 0)

    return {
        "components_used": components_used,
        "components_limit": components_limit,
        "repositories_used": repositories_used,
        "repositories_limit": repositories_limit,
        "team_members": team_members,
        "team_members_limit": team_members_limit,
        "subscription_tier": subscription_tier,
    }


@analytics_router.get("/trends")
async def get_historical_trends(current_user: dict = Depends(get_current_user)):
    """Get historical trends for documentation and jobs over the last 30 days."""
    tenant_id = current_user["tenant_id"]
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # Documentation creation trends grouped by day
    doc_trend_pipeline = [
        {
            "$match": {
                "tenant_id": tenant_id,
                "created_at": {"$gte": thirty_days_ago},
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    doc_trend_results = await db.documentation.aggregate(doc_trend_pipeline).to_list(None)
    documentation_trends = [
        {"date": item["_id"], "count": item["count"]}
        for item in doc_trend_results
    ]

    # Job trends grouped by day
    job_trend_pipeline = [
        {
            "$match": {
                "tenant_id": tenant_id,
                "created_at": {"$gte": thirty_days_ago},
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    job_trend_results = await db.jobs.aggregate(job_trend_pipeline).to_list(None)
    job_trends = [
        {"date": item["_id"], "count": item["count"]}
        for item in job_trend_results
    ]

    return {
        "documentation_trends": documentation_trends,
        "job_trends": job_trends,
    }


@analytics_router.get("/generation-trends")
async def get_generation_trends(
    days: int = Query(default=30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    """Get average generation time per day from completed jobs."""
    tenant_id = current_user["tenant_id"]
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    pipeline = [
        {
            "$match": {
                "tenant_id": tenant_id,
                "status": "completed",
                "created_at": {"$gte": cutoff},
                "completed_at": {"$exists": True},
            }
        },
        {
            "$addFields": {
                "created_dt": {"$dateFromString": {"dateString": "$created_at", "onError": "$created_at"}},
                "completed_dt": {"$dateFromString": {"dateString": "$completed_at", "onError": "$completed_at"}},
            }
        },
        {
            "$addFields": {
                "duration_ms": {"$subtract": ["$completed_dt", "$created_dt"]}
            }
        },
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_dt"}},
                "avg_duration_ms": {"$avg": "$duration_ms"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]

    results = await db.jobs.aggregate(pipeline).to_list(None)

    return {
        "trends": [
            {
                "date": item["_id"],
                "avg_duration_seconds": round((item["avg_duration_ms"] or 0) / 1000, 2),
                "job_count": item["count"],
            }
            for item in results
        ]
    }


@analytics_router.get("/module-coverage")
async def get_module_coverage(
    language: Optional[str] = None,
    quality_min: Optional[float] = Query(default=None, ge=0, le=100),
    current_user: dict = Depends(get_current_user),
):
    """Get documentation coverage by module/component, sorted by quality score."""
    tenant_id = current_user["tenant_id"]

    match_stage = {"tenant_id": tenant_id}
    if language:
        match_stage["language"] = language
    if quality_min is not None:
        match_stage["metadata.quality_score"] = {"$gte": quality_min}

    pipeline = [
        {"$match": match_stage},
        {
            "$project": {
                "component_path": 1,
                "language": 1,
                "quality_score": {"$ifNull": ["$metadata.quality_score", 0]},
                "updated_at": 1,
            }
        },
        {"$sort": {"quality_score": -1}},
        {"$limit": 50},
    ]

    results = await db.documentation.aggregate(pipeline).to_list(None)

    return {
        "modules": [
            {
                "component_path": r.get("component_path", ""),
                "language": r.get("language", ""),
                "quality_score": r.get("quality_score", 0),
                "updated_at": r.get("updated_at", ""),
            }
            for r in results
        ],
        "total": len(results),
    }
