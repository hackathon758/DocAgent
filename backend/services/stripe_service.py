"""
Stripe payment integration service for DocAgent.
Handles checkout sessions, customer portal, and webhook events.
Falls back to mock mode when STRIPE_SECRET_KEY is not configured.
"""

import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
APP_URL = os.environ.get("APP_URL", "http://localhost:3000")

# Stripe price IDs for each tier (configure in Stripe Dashboard)
STRIPE_PRICE_IDS = {
    "starter": os.environ.get("STRIPE_PRICE_STARTER", ""),
    "professional": os.environ.get("STRIPE_PRICE_PROFESSIONAL", ""),
    "team": os.environ.get("STRIPE_PRICE_TEAM", ""),
}


def _is_stripe_configured() -> bool:
    return bool(STRIPE_SECRET_KEY)


def _get_stripe():
    """Get configured stripe module."""
    import stripe
    stripe.api_key = STRIPE_SECRET_KEY
    return stripe


async def create_customer(email: str, name: str, tenant_id: str) -> Optional[str]:
    """Create a Stripe customer and return the customer ID."""
    if not _is_stripe_configured():
        logger.info(f"[DEV STRIPE] Would create customer for {email}")
        return f"cus_mock_{tenant_id[:8]}"

    try:
        stripe = _get_stripe()
        customer = stripe.Customer.create(
            email=email,
            name=name,
            metadata={"tenant_id": tenant_id},
        )
        return customer.id
    except Exception as e:
        logger.error(f"Failed to create Stripe customer: {e}")
        return None


async def create_checkout_session(
    customer_id: str, tier: str, tenant_id: str
) -> Optional[Dict[str, Any]]:
    """Create a Stripe Checkout session for subscription."""
    if not _is_stripe_configured():
        logger.info(f"[DEV STRIPE] Would create checkout for {tier}")
        return {
            "id": f"cs_mock_{tenant_id[:8]}",
            "url": f"{APP_URL}/settings?mock_checkout=true&tier={tier}",
        }

    price_id = STRIPE_PRICE_IDS.get(tier)
    if not price_id:
        logger.error(f"No Stripe price ID configured for tier: {tier}")
        return None

    try:
        stripe = _get_stripe()
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=f"{APP_URL}/settings?checkout=success",
            cancel_url=f"{APP_URL}/settings?checkout=cancelled",
            metadata={"tenant_id": tenant_id, "tier": tier},
        )
        return {"id": session.id, "url": session.url}
    except Exception as e:
        logger.error(f"Failed to create checkout session: {e}")
        return None


async def create_portal_session(customer_id: str) -> Optional[str]:
    """Create a Stripe Customer Portal session URL."""
    if not _is_stripe_configured():
        logger.info(f"[DEV STRIPE] Would create portal session for {customer_id}")
        return f"{APP_URL}/settings?mock_portal=true"

    try:
        stripe = _get_stripe()
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{APP_URL}/settings",
        )
        return session.url
    except Exception as e:
        logger.error(f"Failed to create portal session: {e}")
        return None


def verify_webhook_signature(payload: bytes, sig_header: str) -> Optional[Dict]:
    """Verify and parse a Stripe webhook event."""
    if not _is_stripe_configured() or not STRIPE_WEBHOOK_SECRET:
        logger.info("[DEV STRIPE] Would verify webhook signature")
        return None

    try:
        stripe = _get_stripe()
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
        return event
    except Exception as e:
        logger.error(f"Webhook signature verification failed: {e}")
        return None
