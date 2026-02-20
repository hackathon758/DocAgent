import time
import logging
from collections import defaultdict
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from config import SUBSCRIPTION_TIERS
from database import db

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.requests = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for non-API routes and health checks
        if not request.url.path.startswith("/api") or request.url.path in ("/api/health", "/api/"):
            return await call_next(request)

        # Get client identifier
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            client_id = auth_header[7:20]  # Use token prefix as identifier
        else:
            client_id = request.client.host if request.client else "unknown"

        # Determine rate limit (default to free tier)
        rate_limit = SUBSCRIPTION_TIERS["free"]["rate_limit_per_min"]

        # Clean old entries (older than 60 seconds)
        now = time.time()
        self.requests[client_id] = [t for t in self.requests[client_id] if now - t < 60]

        # Check rate limit
        if len(self.requests[client_id]) >= rate_limit:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Maximum {rate_limit} requests per minute."
            )

        self.requests[client_id].append(now)
        return await call_next(request)
