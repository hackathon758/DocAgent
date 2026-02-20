from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from database import db
from middleware.auth import get_current_user
from services.slack_service import get_oauth_url, exchange_code, test_connection

integrations_router = APIRouter(prefix="/api/integrations", tags=["Integrations"])


@integrations_router.get("/")
async def list_integrations(current_user: dict = Depends(get_current_user)):
    """List all active integrations for the current tenant."""
    integrations = await db.integrations.find(
        {"tenant_id": current_user["tenant_id"]}
    ).to_list(20)

    return [
        {
            "id": i["id"],
            "type": i["type"],
            "name": i.get("name", i["type"].title()),
            "status": i.get("status", "connected"),
            "metadata": i.get("metadata", {}),
            "connected_at": i.get("connected_at"),
        }
        for i in integrations
    ]


@integrations_router.get("/slack/connect")
async def slack_connect(current_user: dict = Depends(get_current_user)):
    """Return the Slack OAuth authorization URL."""
    return {"url": get_oauth_url()}


@integrations_router.get("/slack/callback")
async def slack_callback(code: str, current_user: dict = Depends(get_current_user)):
    """Handle Slack OAuth callback. Exchange code for token and store integration."""
    result = await exchange_code(code)

    if not result.get("ok", True):
        raise HTTPException(status_code=400, detail="Slack OAuth failed")

    integration_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    integration = {
        "id": integration_id,
        "tenant_id": current_user["tenant_id"],
        "type": "slack",
        "name": "Slack",
        "status": "connected",
        "access_token": result.get("access_token", ""),
        "metadata": {
            "team_id": result.get("team", {}).get("id", ""),
            "team_name": result.get("team", {}).get("name", ""),
            "channel": result.get("incoming_webhook", {}).get("channel", "#general"),
        },
        "connected_at": now,
        "connected_by": current_user["id"],
    }

    # Upsert: remove old slack integration for this tenant
    await db.integrations.delete_many({
        "tenant_id": current_user["tenant_id"],
        "type": "slack"
    })
    await db.integrations.insert_one(integration)

    return {
        "message": "Slack connected successfully",
        "team_name": integration["metadata"]["team_name"],
    }


@integrations_router.post("/slack/disconnect")
async def slack_disconnect(current_user: dict = Depends(get_current_user)):
    """Disconnect Slack integration."""
    result = await db.integrations.delete_many({
        "tenant_id": current_user["tenant_id"],
        "type": "slack"
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No Slack integration found")

    return {"message": "Slack disconnected"}


@integrations_router.post("/slack/test")
async def slack_test(current_user: dict = Depends(get_current_user)):
    """Send a test message to verify the Slack connection."""
    integration = await db.integrations.find_one({
        "tenant_id": current_user["tenant_id"],
        "type": "slack",
    })
    if not integration:
        raise HTTPException(status_code=404, detail="Slack not connected")

    result = await test_connection(integration.get("access_token", ""))
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Connection test failed"))

    return {"message": "Test message sent successfully", "details": result}
