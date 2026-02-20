from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import List

from database import db
from config import SUBSCRIPTION_TIERS
from middleware.auth import get_current_user
from models import SubscriptionResponse, SubscriptionUpgrade, InvoiceResponse, PaymentMethodUpdate

billing_router = APIRouter(prefix="/api/billing", tags=["Billing"])


@billing_router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(current_user: dict = Depends(get_current_user)):
    """Get the current tenant's subscription details."""
    tenant = await db.tenants.find_one({"id": current_user["tenant_id"]})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    subscription = tenant.get("subscription", {})
    tier_name = subscription.get("tier", "free")
    tier_config = SUBSCRIPTION_TIERS.get(tier_name, SUBSCRIPTION_TIERS.get("free", {}))
    quotas = tenant.get("quotas", {})

    return SubscriptionResponse(
        tier=tier_name,
        status=subscription.get("status", "active"),
        price=tier_config.get("price", 0),
        features=tier_config.get("features", []),
        current_period_end=subscription.get("current_period_end"),
        components_limit=quotas.get("components_per_month", tier_config.get("components_per_month", 100)),
        repositories_limit=quotas.get("max_repositories", tier_config.get("max_repositories", 5)),
        team_members_limit=quotas.get("max_team_members", tier_config.get("max_team_members", 1)),
    )


@billing_router.post("/subscription/upgrade", response_model=SubscriptionResponse)
async def upgrade_subscription(
    upgrade: SubscriptionUpgrade,
    current_user: dict = Depends(get_current_user),
):
    """Upgrade the tenant's subscription to a higher tier."""
    new_tier = upgrade.tier
    if new_tier not in SUBSCRIPTION_TIERS:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {new_tier}")

    tenant = await db.tenants.find_one({"id": current_user["tenant_id"]})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    current_tier_name = tenant.get("subscription", {}).get("tier", "free")
    current_tier_config = SUBSCRIPTION_TIERS.get(current_tier_name, {})
    new_tier_config = SUBSCRIPTION_TIERS[new_tier]

    if new_tier_config.get("price", 0) <= current_tier_config.get("price", 0):
        raise HTTPException(
            status_code=400,
            detail="New tier must have a higher price than the current tier. Use the downgrade endpoint instead.",
        )

    now = datetime.now(timezone.utc)
    period_end = (now + timedelta(days=30)).isoformat()

    update_fields = {
        "subscription.tier": new_tier,
        "subscription.status": "active",
        "subscription.current_period_end": period_end,
        "subscription.upgraded_at": now.isoformat(),
        "quotas": new_tier_config,
    }

    await db.tenants.update_one(
        {"id": current_user["tenant_id"]},
        {"$set": update_fields},
    )

    return SubscriptionResponse(
        tier=new_tier,
        status="active",
        price=new_tier_config.get("price", 0),
        features=new_tier_config.get("features", []),
        current_period_end=period_end,
        components_limit=new_tier_config.get("components_per_month", 100),
        repositories_limit=new_tier_config.get("max_repositories", 5),
        team_members_limit=new_tier_config.get("max_team_members", 1),
    )


@billing_router.post("/subscription/downgrade", response_model=SubscriptionResponse)
async def downgrade_subscription(
    downgrade: SubscriptionUpgrade,
    current_user: dict = Depends(get_current_user),
):
    """Downgrade the tenant's subscription to a lower tier."""
    new_tier = downgrade.tier
    if new_tier not in SUBSCRIPTION_TIERS:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {new_tier}")

    tenant = await db.tenants.find_one({"id": current_user["tenant_id"]})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    current_tier_name = tenant.get("subscription", {}).get("tier", "free")
    current_tier_config = SUBSCRIPTION_TIERS.get(current_tier_name, {})
    new_tier_config = SUBSCRIPTION_TIERS[new_tier]

    if new_tier_config.get("price", 0) >= current_tier_config.get("price", 0):
        raise HTTPException(
            status_code=400,
            detail="New tier must have a lower price than the current tier. Use the upgrade endpoint instead.",
        )

    now = datetime.now(timezone.utc)
    period_end = (now + timedelta(days=30)).isoformat()

    update_fields = {
        "subscription.tier": new_tier,
        "subscription.status": "active",
        "subscription.current_period_end": period_end,
        "subscription.downgraded_at": now.isoformat(),
        "quotas": new_tier_config,
    }

    await db.tenants.update_one(
        {"id": current_user["tenant_id"]},
        {"$set": update_fields},
    )

    return SubscriptionResponse(
        tier=new_tier,
        status="active",
        price=new_tier_config.get("price", 0),
        features=new_tier_config.get("features", []),
        current_period_end=period_end,
        components_limit=new_tier_config.get("components_per_month", 100),
        repositories_limit=new_tier_config.get("max_repositories", 5),
        team_members_limit=new_tier_config.get("max_team_members", 1),
    )


@billing_router.post("/subscription/cancel", response_model=SubscriptionResponse)
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Cancel the tenant's subscription. Features remain active until the current period ends."""
    tenant = await db.tenants.find_one({"id": current_user["tenant_id"]})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    subscription = tenant.get("subscription", {})
    if subscription.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Subscription is already cancelled")

    tier_name = subscription.get("tier", "free")
    if tier_name == "free":
        raise HTTPException(status_code=400, detail="Cannot cancel a free tier subscription")

    tier_config = SUBSCRIPTION_TIERS.get(tier_name, {})
    now = datetime.now(timezone.utc)

    # Keep the current period end so features remain available until then
    current_period_end = subscription.get(
        "current_period_end",
        (now + timedelta(days=30)).isoformat(),
    )

    await db.tenants.update_one(
        {"id": current_user["tenant_id"]},
        {"$set": {
            "subscription.status": "cancelled",
            "subscription.cancelled_at": now.isoformat(),
        }},
    )

    quotas = tenant.get("quotas", {})

    return SubscriptionResponse(
        tier=tier_name,
        status="cancelled",
        price=tier_config.get("price", 0),
        features=tier_config.get("features", []),
        current_period_end=current_period_end,
        components_limit=quotas.get("components_per_month", tier_config.get("components_per_month", 100)),
        repositories_limit=quotas.get("max_repositories", tier_config.get("max_repositories", 5)),
        team_members_limit=quotas.get("max_team_members", tier_config.get("max_team_members", 1)),
    )


@billing_router.get("/invoices", response_model=List[InvoiceResponse])
async def list_invoices(current_user: dict = Depends(get_current_user)):
    """List invoices for the current tenant (mocked data based on current tier)."""
    tenant = await db.tenants.find_one({"id": current_user["tenant_id"]})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    subscription = tenant.get("subscription", {})
    tier_name = subscription.get("tier", "free")
    tier_config = SUBSCRIPTION_TIERS.get(tier_name, {})
    price = tier_config.get("price", 0)

    if price == 0:
        return []

    # Generate mock invoices for the last 3 months
    now = datetime.now(timezone.utc)
    invoices = []
    for i in range(3):
        period_end = now - timedelta(days=30 * i)
        period_start = period_end - timedelta(days=30)
        invoices.append(
            InvoiceResponse(
                id=f"inv_{current_user['tenant_id'][:8]}_{i + 1:03d}",
                amount=float(price),
                status="paid" if i > 0 else "current",
                period_start=period_start.isoformat(),
                period_end=period_end.isoformat(),
                created_at=period_start.isoformat(),
            )
        )

    return invoices


@billing_router.get("/usage")
async def get_usage(current_user: dict = Depends(get_current_user)):
    """Get current billing period usage for the tenant."""
    tenant = await db.tenants.find_one({"id": current_user["tenant_id"]})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    usage = tenant.get("usage", {})
    quotas = tenant.get("quotas", {})
    subscription = tenant.get("subscription", {})
    tier_name = subscription.get("tier", "free")
    tier_config = SUBSCRIPTION_TIERS.get(tier_name, {})

    components_used = usage.get("components_used", 0)
    components_limit = quotas.get("components_per_month", tier_config.get("components_per_month", 100))
    repositories_used = usage.get("repositories_used", 0)
    repositories_limit = quotas.get("max_repositories", tier_config.get("max_repositories", 5))

    return {
        "components_used": components_used,
        "components_limit": components_limit,
        "repositories_used": repositories_used,
        "repositories_limit": repositories_limit,
        "billing_period_start": subscription.get("current_period_start"),
        "billing_period_end": subscription.get("current_period_end"),
        "tier": tier_name,
    }


@billing_router.post("/payment-method")
async def update_payment_method(
    payment: PaymentMethodUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update the tenant's payment method (stub implementation)."""
    if not payment.payment_method_id:
        raise HTTPException(status_code=400, detail="Payment method ID is required")

    await db.tenants.update_one(
        {"id": current_user["tenant_id"]},
        {"$set": {
            "payment_method_id": payment.payment_method_id,
            "payment_method_updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    return {"message": "Payment method updated successfully", "payment_method_id": payment.payment_method_id}
