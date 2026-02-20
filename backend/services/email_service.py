"""
Email service for DocAgent.
Sends transactional emails using SMTP.
Falls back to logging when SMTP is not configured (development mode).
"""

import os
import logging
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

# Email configuration from environment
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "noreply@docagent.dev")
APP_URL = os.environ.get("APP_URL", "http://localhost:3000")


def _is_smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


async def _send_email(to: str, subject: str, html_body: str):
    """Send an email via SMTP or log it in dev mode."""
    if not _is_smtp_configured():
        logger.info(f"[DEV EMAIL] To: {to} | Subject: {subject}")
        logger.info(f"[DEV EMAIL] Body preview: {html_body[:200]}...")
        return

    try:
        import aiosmtplib

        message = MIMEMultipart("alternative")
        message["From"] = SMTP_FROM
        message["To"] = to
        message["Subject"] = subject
        message.attach(MIMEText(html_body, "html"))

        await aiosmtplib.send(
            message,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASS,
            use_tls=True,
        )
        logger.info(f"Email sent to {to}: {subject}")
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")


async def send_verification_email(to: str, name: str, token: str):
    """Send email verification link."""
    verify_url = f"{APP_URL}/verify-email?token={token}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Welcome to DocAgent!</h2>
        <p>Hi {name},</p>
        <p>Please verify your email address by clicking the button below:</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{verify_url}"
               style="background-color: #6366f1; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
                Verify Email
            </a>
        </p>
        <p style="color: #666; font-size: 14px;">
            Or copy this link: {verify_url}
        </p>
        <p style="color: #666; font-size: 12px;">This link expires in 24 hours.</p>
    </div>
    """
    await _send_email(to, "Verify your DocAgent email", html)


async def send_password_reset_email(to: str, name: str, token: str):
    """Send password reset link."""
    reset_url = f"{APP_URL}/reset-password?token={token}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Password Reset</h2>
        <p>Hi {name},</p>
        <p>We received a request to reset your password. Click below to set a new password:</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{reset_url}"
               style="background-color: #6366f1; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
                Reset Password
            </a>
        </p>
        <p style="color: #666; font-size: 14px;">
            Or copy this link: {reset_url}
        </p>
        <p style="color: #666; font-size: 12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    </div>
    """
    await _send_email(to, "Reset your DocAgent password", html)


async def send_invitation_email(to: str, inviter_name: str, org_name: str, token: str):
    """Send team member invitation."""
    invite_url = f"{APP_URL}/accept-invite?token={token}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">You're Invited!</h2>
        <p>{inviter_name} has invited you to join <strong>{org_name}</strong> on DocAgent.</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{invite_url}"
               style="background-color: #6366f1; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
                Accept Invitation
            </a>
        </p>
        <p style="color: #666; font-size: 12px;">This invitation expires in 7 days.</p>
    </div>
    """
    await _send_email(to, f"Join {org_name} on DocAgent", html)


async def send_doc_generation_complete_email(to: str, name: str, component_path: str, quality_score: float):
    """Notify user that documentation generation is complete."""
    dashboard_url = f"{APP_URL}/documentation"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Documentation Ready!</h2>
        <p>Hi {name},</p>
        <p>Documentation for <code>{component_path}</code> has been generated successfully.</p>
        <p><strong>Quality Score:</strong> {quality_score:.0f}/100</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{dashboard_url}"
               style="background-color: #6366f1; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Documentation
            </a>
        </p>
    </div>
    """
    await _send_email(to, f"Documentation generated for {component_path}", html)


async def send_subscription_change_email(to: str, name: str, new_tier: str, action: str):
    """Notify user of subscription changes."""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Subscription {action.title()}</h2>
        <p>Hi {name},</p>
        <p>Your DocAgent subscription has been {action}d to the <strong>{new_tier.title()}</strong> plan.</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{APP_URL}/settings"
               style="background-color: #6366f1; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Subscription
            </a>
        </p>
    </div>
    """
    await _send_email(to, f"Subscription {action}d - DocAgent", html)
