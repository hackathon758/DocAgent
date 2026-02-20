from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
import uuid
import jwt
import secrets
import logging
import httpx
from urllib.parse import urlencode

from database import db
from config import SUBSCRIPTION_TIERS, JWT_SECRET, JWT_ALGORITHM, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
from middleware.auth import get_current_user, security
from services.auth_service import (
    hash_password, verify_password, validate_password_strength,
    create_access_token, create_refresh_token, blacklist_token,
    create_password_reset_token, validate_reset_token, consume_reset_token
)
from services.email_service import send_verification_email
from models import (
    UserCreate, UserLogin, UserResponse, TokenResponse,
    UserUpdate, ChangePassword, ForgotPasswordRequest, ResetPasswordRequest,
    GitHubCallbackRequest
)

logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@auth_router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    """Register a new user with email and password."""
    # Validate password strength
    password_error = validate_password_strength(user_data.password)
    if password_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=password_error
        )

    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists"
        )

    # Create user ID first (needed for tenant owner_id)
    user_id = str(uuid.uuid4())

    # Create tenant with free tier
    tenant_id = str(uuid.uuid4())
    subdomain = tenant_id[:8]  # Use first 8 chars of UUID as unique subdomain
    tenant = {
        "id": tenant_id,
        "name": f"{user_data.name}'s Workspace",
        "subdomain": subdomain,
        "owner_id": user_id,
        "subscription": {"tier": "free", "status": "active", "current_period_end": None},
        "quotas": SUBSCRIPTION_TIERS["free"],
        "usage": {"components_this_month": 0, "last_reset_date": datetime.now(timezone.utc).isoformat()},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tenants.insert_one(tenant)

    # Create user
    user = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hash_password(user_data.password),
        "tenant_id": tenant_id,
        "role": "owner",
        "email_verified": False,
        "two_factor_enabled": False,
        "two_factor_secret": None,
        "backup_codes": [],
        "onboarding_completed": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "last_login": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)

    # Generate email verification token
    verification_token = str(uuid.uuid4())
    await db.email_verifications.insert_one({
        "user_id": user_id,
        "token": verification_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=24),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Send verification email (non-blocking, logs in dev mode)
    try:
        await send_verification_email(user_data.email, user_data.name, verification_token)
    except Exception as e:
        logger.warning(f"Failed to send verification email: {e}")

    # Generate tokens
    access_token = create_access_token(user_id=user_id, tenant_id=tenant_id)
    refresh_token = create_refresh_token(user_id=user_id, tenant_id=tenant_id)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            tenant_id=tenant_id,
            role="owner",
            subscription_tier="free",
            created_at=user["created_at"]
        )
    )


@auth_router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Authenticate user and return access and refresh tokens."""
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Check 2FA if enabled
    if user.get("two_factor_enabled"):
        totp_code = getattr(credentials, "totp_code", None)
        if not totp_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="2FA code required"
            )
        try:
            import pyotp
            totp = pyotp.TOTP(user["two_factor_secret"])
            if not totp.verify(totp_code):
                # Check backup codes as fallback
                backup_codes = user.get("backup_codes", [])
                if totp_code in backup_codes:
                    backup_codes.remove(totp_code)
                    await db.users.update_one(
                        {"id": user["id"]},
                        {"$set": {"backup_codes": backup_codes}}
                    )
                else:
                    raise HTTPException(status_code=401, detail="Invalid 2FA code")
        except ImportError:
            pass  # pyotp not installed, skip 2FA check

    # Update last login timestamp
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )

    # Get tenant for subscription tier
    tenant = await db.tenants.find_one({"id": user["tenant_id"]})
    subscription_tier = tenant.get("subscription", {}).get("tier", "free") if tenant else "free"

    # Generate tokens
    access_token = create_access_token(user_id=user["id"], tenant_id=user["tenant_id"])
    refresh_token = create_refresh_token(user_id=user["id"], tenant_id=user["tenant_id"])

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            tenant_id=user["tenant_id"],
            role=user.get("role", "member"),
            subscription_tier=subscription_tier,
            created_at=user["created_at"]
        )
    )


@auth_router.get("/me", response_model=UserResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    tenant = await db.tenants.find_one({"id": current_user["tenant_id"]})
    subscription_tier = tenant.get("subscription", {}).get("tier", "free") if tenant else "free"

    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        tenant_id=current_user["tenant_id"],
        role=current_user.get("role", "member"),
        subscription_tier=subscription_tier,
        created_at=current_user["created_at"]
    )


@auth_router.put("/me", response_model=UserResponse)
async def update_profile(updates: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update the current user's profile (name and/or email)."""
    update_fields = {}

    if updates.name is not None:
        update_fields["name"] = updates.name

    if updates.email is not None:
        # Check if the new email is already taken by another user
        existing = await db.users.find_one({"email": updates.email, "id": {"$ne": current_user["id"]}})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists"
            )
        update_fields["email"] = updates.email

    if not update_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_fields}
    )

    # Fetch and return updated user
    updated_user = await db.users.find_one({"id": current_user["id"]})
    tenant = await db.tenants.find_one({"id": updated_user["tenant_id"]})
    subscription_tier = tenant.get("subscription", {}).get("tier", "free") if tenant else "free"

    return UserResponse(
        id=updated_user["id"],
        email=updated_user["email"],
        name=updated_user["name"],
        tenant_id=updated_user["tenant_id"],
        role=updated_user.get("role", "member"),
        subscription_tier=subscription_tier,
        created_at=updated_user["created_at"]
    )


@auth_router.put("/change-password")
async def change_password(data: ChangePassword, current_user: dict = Depends(get_current_user)):
    """Change the current user's password."""
    # Verify current password
    if not verify_password(data.current_password, current_user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )

    # Validate new password strength
    validate_password_strength(data.new_password)

    # Update password hash
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "password_hash": hash_password(data.new_password),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    return {"message": "Password changed successfully"}


@auth_router.get("/oauth/github")
async def github_oauth_url():
    """Return the GitHub OAuth authorization URL."""
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GitHub OAuth is not configured")

    params = {
        "client_id": GITHUB_CLIENT_ID,
        "scope": "read:user user:email",
        "state": secrets.token_urlsafe(32),
    }
    query = urlencode(params)
    url = f"https://github.com/login/oauth/authorize?{query}"
    return {"url": url}


@auth_router.post("/oauth/github/callback", response_model=TokenResponse)
async def github_oauth_callback(request: GitHubCallbackRequest):
    """Exchange GitHub OAuth code for access token, fetch profile, and login/register."""
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GitHub OAuth is not configured")

    # Exchange code for GitHub access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": request.code,
            },
            headers={"Accept": "application/json"},
            timeout=15,
        )

    if token_response.status_code != 200:
        logger.error(f"GitHub token exchange failed: {token_response.text}")
        raise HTTPException(status_code=502, detail="Failed to exchange GitHub code")

    token_data = token_response.json()
    gh_access_token = token_data.get("access_token")
    if not gh_access_token:
        error = token_data.get("error_description", token_data.get("error", "Unknown error"))
        raise HTTPException(status_code=400, detail=f"GitHub OAuth error: {error}")

    # Fetch GitHub user profile
    gh_headers = {"Authorization": f"Bearer {gh_access_token}", "Accept": "application/json"}
    async with httpx.AsyncClient() as client:
        profile_response = await client.get("https://api.github.com/user", headers=gh_headers, timeout=10)
        emails_response = await client.get("https://api.github.com/user/emails", headers=gh_headers, timeout=10)

    if profile_response.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch GitHub profile")

    gh_profile = profile_response.json()
    gh_id = str(gh_profile.get("id", ""))
    gh_name = gh_profile.get("name") or gh_profile.get("login", "GitHub User")
    gh_avatar = gh_profile.get("avatar_url", "")

    # Get primary verified email from GitHub
    gh_email = gh_profile.get("email")
    if emails_response.status_code == 200:
        for email_entry in emails_response.json():
            if email_entry.get("primary") and email_entry.get("verified"):
                gh_email = email_entry["email"]
                break

    if not gh_email:
        raise HTTPException(
            status_code=400,
            detail="Could not retrieve email from GitHub. Make sure your email is public or grant the user:email scope."
        )

    # Look up existing user by github_id or email
    user = await db.users.find_one({"github_id": gh_id})
    if not user:
        user = await db.users.find_one({"email": gh_email})

    if user:
        # Existing user — update last login and github_id if missing
        update_fields = {"last_login": datetime.now(timezone.utc).isoformat()}
        if not user.get("github_id"):
            update_fields["github_id"] = gh_id
            update_fields["auth_provider"] = "github"
        await db.users.update_one({"id": user["id"]}, {"$set": update_fields})
        user_id = user["id"]
        tenant_id = user["tenant_id"]
    else:
        # New user — create tenant and user
        user_id = str(uuid.uuid4())
        tenant_id = str(uuid.uuid4())

        tenant = {
            "id": tenant_id,
            "name": f"{gh_name}'s Workspace",
            "subdomain": tenant_id[:8],
            "owner_id": user_id,
            "subscription": {"tier": "free", "status": "active", "current_period_end": None},
            "quotas": SUBSCRIPTION_TIERS["free"],
            "usage": {"components_this_month": 0, "last_reset_date": datetime.now(timezone.utc).isoformat()},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.tenants.insert_one(tenant)

        user = {
            "id": user_id,
            "email": gh_email,
            "name": gh_name,
            "password_hash": "",
            "tenant_id": tenant_id,
            "role": "owner",
            "auth_provider": "github",
            "github_id": gh_id,
            "avatar_url": gh_avatar,
            "email_verified": True,
            "two_factor_enabled": False,
            "two_factor_secret": None,
            "backup_codes": [],
            "onboarding_completed": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "last_login": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)

    tenant = await db.tenants.find_one({"id": tenant_id})
    subscription_tier = tenant.get("subscription", {}).get("tier", "free") if tenant else "free"

    access_token = create_access_token(user_id=user_id, tenant_id=tenant_id)
    refresh_token = create_refresh_token(user_id=user_id, tenant_id=tenant_id)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token,
        user=UserResponse(
            id=user_id,
            email=user.get("email", gh_email),
            name=user.get("name", gh_name),
            tenant_id=tenant_id,
            role=user.get("role", "owner"),
            subscription_tier=subscription_tier,
            created_at=user["created_at"],
        ),
    )


@auth_router.post("/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Logout the current user by blacklisting their token."""
    token = credentials.credentials

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        await blacklist_token(token, expires_at)
    except jwt.PyJWTError:
        # Even if token is invalid, return success for idempotency
        pass

    return {"message": "Successfully logged out"}


@auth_router.post("/refresh", response_model=TokenResponse)
async def refresh_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Refresh access and refresh tokens using a valid refresh token."""
    token = credentials.credentials

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired"
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    # Verify this is a refresh token
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type. Expected a refresh token"
        )

    user_id = payload.get("user_id")
    tenant_id = payload.get("tenant_id")

    # Verify user still exists
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists"
        )

    tenant = await db.tenants.find_one({"id": tenant_id})
    subscription_tier = tenant.get("subscription", {}).get("tier", "free") if tenant else "free"

    # Generate new token pair
    new_access_token = create_access_token(user_id=user_id, tenant_id=tenant_id)
    new_refresh_token = create_refresh_token(user_id=user_id, tenant_id=tenant_id)

    # Blacklist the old refresh token
    expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    await blacklist_token(token, expires_at)

    return TokenResponse(
        access_token=new_access_token,
        token_type="bearer",
        refresh_token=new_refresh_token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            tenant_id=user["tenant_id"],
            role=user.get("role", "member"),
            subscription_tier=subscription_tier,
            created_at=user["created_at"]
        )
    )


@auth_router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Request a password reset token. Always returns success to prevent email enumeration."""
    user = await db.users.find_one({"email": request.email})

    response = {"message": "If an account with that email exists, a password reset link has been sent."}

    if user:
        reset_token = await create_password_reset_token(user["id"])
        # In production, this token would be emailed to the user.
        # For development, include it in the response.
        response["reset_token"] = reset_token

    return response


@auth_router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset a user's password using a valid reset token."""
    # Validate the reset token
    token_data = await validate_reset_token(request.token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    # Validate new password strength
    validate_password_strength(request.new_password)

    # Update the user's password
    user_id = token_data["user_id"]
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "password_hash": hash_password(request.new_password),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    # Consume (invalidate) the reset token so it cannot be reused
    await consume_reset_token(request.token)

    return {"message": "Password has been reset successfully"}


# ---------------------------------------------------------------------------
# Email Verification
# ---------------------------------------------------------------------------

@auth_router.get("/verify-email")
async def verify_email(token: str):
    """Verify a user's email address using the token sent via email."""
    record = await db.email_verifications.find_one({
        "token": token,
        "expires_at": {"$gt": datetime.now(timezone.utc)},
    })
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )

    await db.users.update_one(
        {"id": record["user_id"]},
        {"$set": {"email_verified": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Remove used token
    await db.email_verifications.delete_one({"token": token})

    return {"message": "Email verified successfully"}


@auth_router.post("/resend-verification")
async def resend_verification(current_user: dict = Depends(get_current_user)):
    """Resend email verification link."""
    if current_user.get("email_verified"):
        return {"message": "Email is already verified"}

    # Remove old tokens
    await db.email_verifications.delete_many({"user_id": current_user["id"]})

    verification_token = str(uuid.uuid4())
    await db.email_verifications.insert_one({
        "user_id": current_user["id"],
        "token": verification_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=24),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    try:
        await send_verification_email(current_user["email"], current_user["name"], verification_token)
    except Exception as e:
        logger.warning(f"Failed to send verification email: {e}")

    return {"message": "Verification email sent"}


# ---------------------------------------------------------------------------
# Two-Factor Authentication (2FA)
# ---------------------------------------------------------------------------

@auth_router.get("/2fa/status")
async def get_2fa_status(current_user: dict = Depends(get_current_user)):
    """Check if 2FA is enabled for the current user."""
    return {"enabled": current_user.get("two_factor_enabled", False)}


@auth_router.post("/2fa/setup")
async def setup_2fa(current_user: dict = Depends(get_current_user)):
    """Generate a TOTP secret and provisioning URI for 2FA setup."""
    try:
        import pyotp
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="2FA is not available. Install pyotp: pip install pyotp"
        )

    if current_user.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA is already enabled")

    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=current_user["email"],
        issuer_name="DocAgent"
    )

    # Store secret temporarily (not yet enabled)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"two_factor_secret": secret, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {
        "secret": secret,
        "provisioning_uri": provisioning_uri,
        "message": "Scan the QR code with your authenticator app, then verify with /2fa/enable"
    }


@auth_router.post("/2fa/enable")
async def enable_2fa(code: str, current_user: dict = Depends(get_current_user)):
    """Verify the TOTP code and enable 2FA. Returns backup codes."""
    try:
        import pyotp
    except ImportError:
        raise HTTPException(status_code=501, detail="pyotp not installed")

    secret = current_user.get("two_factor_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="Run /2fa/setup first")

    totp = pyotp.TOTP(secret)
    if not totp.verify(code):
        raise HTTPException(status_code=400, detail="Invalid verification code")

    # Generate backup codes
    backup_codes = [secrets.token_hex(4) for _ in range(8)]

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "two_factor_enabled": True,
            "backup_codes": backup_codes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    return {
        "message": "2FA enabled successfully",
        "backup_codes": backup_codes,
    }


@auth_router.post("/2fa/disable")
async def disable_2fa(password: str, current_user: dict = Depends(get_current_user)):
    """Disable 2FA. Requires password confirmation."""
    if not verify_password(password, current_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid password")

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "two_factor_enabled": False,
            "two_factor_secret": None,
            "backup_codes": [],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    return {"message": "2FA disabled successfully"}
