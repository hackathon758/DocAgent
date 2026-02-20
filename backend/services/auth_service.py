import re
import uuid
import bcrypt
import jwt
import logging
from datetime import datetime, timezone, timedelta
from config import JWT_SECRET, JWT_ALGORITHM, JWT_ACCESS_TOKEN_EXPIRE_MINUTES, JWT_REFRESH_TOKEN_EXPIRE_DAYS
from database import db

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def validate_password_strength(password: str) -> str | None:
    """Validate password meets strength requirements. Returns error message or None."""
    if len(password) < 8:
        return "Password must be at least 8 characters long"
    if not re.search(r'[A-Z]', password):
        return "Password must contain at least one uppercase letter"
    if not re.search(r'[0-9]', password):
        return "Password must contain at least one number"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return "Password must contain at least one special character"
    return None


def create_access_token(user_id: str, tenant_id: str) -> str:
    payload = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, tenant_id: str) -> str:
    payload = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def blacklist_token(token: str, expires_at: datetime):
    """Add a token to the blacklist."""
    await db.blacklisted_tokens.insert_one({
        "token": token,
        "blacklisted_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at
    })


async def create_password_reset_token(user_id: str) -> str:
    """Create a password reset token."""
    token = str(uuid.uuid4())
    await db.password_reset_tokens.insert_one({
        "user_id": user_id,
        "token": token,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return token


async def validate_reset_token(token: str):
    """Validate a password reset token. Returns user_id or None."""
    record = await db.password_reset_tokens.find_one({
        "token": token,
        "used": False,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    if record:
        return record["user_id"]
    return None


async def consume_reset_token(token: str):
    """Mark a reset token as used."""
    await db.password_reset_tokens.update_one(
        {"token": token},
        {"$set": {"used": True}}
    )
