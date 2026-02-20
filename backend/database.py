import logging
from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URL, DB_NAME

logger = logging.getLogger(__name__)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


async def create_indexes():
    """Create database indexes on startup."""
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("tenant_id")
        await db.tenants.create_index("subdomain", unique=True)
        await db.repositories.create_index([("tenant_id", 1), ("name", 1)])
        await db.repositories.create_index([("tenant_id", 1), ("repo_url", 1)])
        await db.documentation.create_index([("tenant_id", 1), ("repository_id", 1)])
        await db.documentation.create_index([("tenant_id", 1), ("component_path", 1)])
        await db.jobs.create_index([("tenant_id", 1), ("status", 1)])
        await db.jobs.create_index([("tenant_id", 1), ("created_at", -1)])
        await db.diagrams.create_index([("tenant_id", 1), ("documentation_id", 1)])
        await db.diagrams.create_index([("tenant_id", 1), ("repository_id", 1)])
        await db.blacklisted_tokens.create_index("expires_at", expireAfterSeconds=0)
        await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
        await db.job_logs.create_index([("job_id", 1), ("timestamp", 1)])

        # Primary key lookups (queried on every authenticated request)
        await db.users.create_index("id", unique=True)
        await db.tenants.create_index("id", unique=True)
        await db.blacklisted_tokens.create_index("token", unique=True)
        await db.password_reset_tokens.create_index("token", unique=True)

        # Composite lookups by (id, tenant_id)
        await db.repositories.create_index([("id", 1), ("tenant_id", 1)])
        await db.jobs.create_index([("id", 1), ("tenant_id", 1)])
        await db.documentation.create_index([("id", 1), ("tenant_id", 1)])
        await db.diagrams.create_index([("id", 1), ("tenant_id", 1)])

        # Analytics time-series queries
        await db.documentation.create_index([("tenant_id", 1), ("created_at", -1)])

        # Version history lookups
        await db.doc_versions.create_index([("documentation_id", 1), ("tenant_id", 1)])

        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")


async def close_connection():
    """Close the MongoDB connection."""
    client.close()
