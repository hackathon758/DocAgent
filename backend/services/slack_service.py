"""
Slack integration service for DocAgent.
Handles Slack OAuth flow and message sending.
Falls back to mock mode when slack-sdk is not installed.
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

SLACK_CLIENT_ID = os.environ.get("SLACK_CLIENT_ID", "")
SLACK_CLIENT_SECRET = os.environ.get("SLACK_CLIENT_SECRET", "")
SLACK_REDIRECT_URI = os.environ.get("SLACK_REDIRECT_URI", "http://localhost:8001/api/integrations/slack/callback")

_slack_available = False
try:
    from slack_sdk.web.async_client import AsyncWebClient
    _slack_available = True
except ImportError:
    _slack_available = False
    logger.info("slack-sdk not installed. Slack integration will run in mock mode.")


def get_oauth_url() -> str:
    """Return the Slack OAuth authorization URL."""
    scopes = "chat:write,channels:read,users:read"
    if SLACK_CLIENT_ID:
        return (
            f"https://slack.com/oauth/v2/authorize"
            f"?client_id={SLACK_CLIENT_ID}"
            f"&scope={scopes}"
            f"&redirect_uri={SLACK_REDIRECT_URI}"
        )
    return f"https://slack.com/oauth/v2/authorize?client_id=mock_client_id&scope={scopes}"


async def exchange_code(code: str) -> dict:
    """Exchange an OAuth code for an access token."""
    if not _slack_available or not SLACK_CLIENT_ID:
        logger.info(f"[MOCK SLACK] OAuth code exchange: {code}")
        return {
            "ok": True,
            "access_token": "xoxb-mock-token",
            "team": {"id": "T_MOCK", "name": "Mock Workspace"},
            "incoming_webhook": {"channel": "#general", "url": "https://hooks.slack.com/mock"},
        }

    from slack_sdk.web.async_client import AsyncWebClient
    client = AsyncWebClient()
    response = await client.oauth_v2_access(
        client_id=SLACK_CLIENT_ID,
        client_secret=SLACK_CLIENT_SECRET,
        code=code,
        redirect_uri=SLACK_REDIRECT_URI,
    )
    return response.data


async def send_message(token: str, channel: str, text: str) -> bool:
    """Send a message to a Slack channel."""
    if not _slack_available or token.startswith("xoxb-mock"):
        logger.info(f"[MOCK SLACK] Sending to {channel}: {text}")
        return True

    try:
        from slack_sdk.web.async_client import AsyncWebClient
        client = AsyncWebClient(token=token)
        await client.chat_postMessage(channel=channel, text=text)
        return True
    except Exception as e:
        logger.error(f"Failed to send Slack message: {e}")
        return False


async def test_connection(token: str) -> dict:
    """Test the Slack connection by sending a test message."""
    if not _slack_available or token.startswith("xoxb-mock"):
        logger.info("[MOCK SLACK] Test connection successful")
        return {"ok": True, "message": "Mock Slack connection successful"}

    try:
        from slack_sdk.web.async_client import AsyncWebClient
        client = AsyncWebClient(token=token)
        response = await client.auth_test()
        return {"ok": True, "team": response.get("team"), "user": response.get("user")}
    except Exception as e:
        return {"ok": False, "error": str(e)}
