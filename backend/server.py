"""
DocAgent Backend - FastAPI Application Entry Point

Slim entry point that imports and registers all routers,
configures middleware, and handles startup/shutdown events.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from database import create_indexes, close_connection
from websocket import ws_manager
from middleware.rate_limit import RateLimitMiddleware

from routes.auth import auth_router
from routes.repositories import repos_router
from routes.documentation import docs_router
from routes.jobs import jobs_router
from routes.analytics import analytics_router
from routes.organizations import orgs_router
from routes.diagrams import diagrams_router
from routes.billing import billing_router
from routes.models_ai import models_router
from routes.repo_docs import repo_docs_router
from routes.webhooks import webhook_router
from routes.comments import comments_router
from routes.sharing import sharing_router
from routes.notifications import notifications_router
from routes.api_keys import api_keys_router
from routes.audit import audit_router
from routes.templates import templates_router
from routes.integrations import integrations_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Application lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Starting DocAgent backend...")
    await create_indexes()
    logger.info("Database indexes created.")

    # Start scheduler for scheduled doc regeneration
    from services.scheduler_service import start_scheduler, stop_scheduler
    await start_scheduler()

    logger.info("DocAgent backend is ready.")
    yield
    logger.info("Shutting down DocAgent backend...")
    await stop_scheduler()
    await close_connection()
    logger.info("Database connection closed.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="DocAgent API",
    description="Multi-agent AI-powered code documentation generation platform",
    version="2.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------

app.include_router(auth_router)
app.include_router(repos_router)
app.include_router(docs_router)
app.include_router(jobs_router)
app.include_router(analytics_router)
app.include_router(orgs_router)
app.include_router(diagrams_router)
app.include_router(billing_router)
app.include_router(models_router)
app.include_router(repo_docs_router)
app.include_router(webhook_router)
app.include_router(comments_router)
app.include_router(sharing_router)
app.include_router(notifications_router)
app.include_router(api_keys_router)
app.include_router(audit_router)
app.include_router(templates_router)
app.include_router(integrations_router)

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "DocAgent API", "version": "2.0.0"}


@app.get("/api/")
async def api_root():
    return {
        "service": "DocAgent API",
        "version": "2.0.0",
        "documentation": "/docs",
        "health": "/api/health",
    }


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await ws_manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "subscribe_job":
                job_id = data.get("job_id")
                if job_id:
                    ws_manager.subscribe_to_job(client_id, job_id)
                    await websocket.send_json({
                        "type": "subscribed",
                        "job_id": job_id
                    })
    except WebSocketDisconnect:
        ws_manager.disconnect(client_id)
    except Exception:
        ws_manager.disconnect(client_id)


# ---------------------------------------------------------------------------
# Run with uvicorn
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
