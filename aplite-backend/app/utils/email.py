"""
Email helper for OTP and notifications.

Uses SendGrid if SENDGRID_API_KEY and SENDGRID_FROM_EMAIL are set; otherwise
falls back to logging/printing for local development.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

logger = logging.getLogger(__name__)


def send_email(to_address: str, subject: str, body: str, *, html: Optional[str] = None) -> None:
    """
    Send an email via SendGrid when configured; otherwise log/print.
    """
    api_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("SENDGRID_FROM_EMAIL")

    if not api_key or not from_email:
        logger.info("Email (stub) to=%s | %s\n%s", to_address, subject, body)
        print(f"[email] to={to_address} | subject={subject}\n{body}")
        return

    message = Mail(
        from_email=from_email,
        to_emails=to_address,
        subject=subject,
        html_content=html or body,
        plain_text_content=body,
    )
    try:
        sg = SendGridAPIClient(api_key)
        sg.send(message)
    except Exception as exc:
        logger.exception("Failed to send email via SendGrid: %s", exc)
        # Fallback to stdout so we still see the code in dev
        print(f"[email-fallback] to={to_address} | subject={subject}\n{body}")


def send_onboarding_submitted(to_address: str, first_name: str, legal_name: str) -> None:
    subject = "Your Aplite verification has been submitted"
    body = (
        f"Hi {first_name},\n\n"
        f"We've received your verification application for {legal_name}. "
        f"Our team will review it and get back to you within 1-2 business days.\n\n"
        f"You can check your status any time by logging in to your dashboard.\n\n"
        f"The Aplite team"
    )
    html = (
        f"<p>Hi {first_name},</p>"
        f"<p>We've received your verification application for <strong>{legal_name}</strong>. "
        f"Our team will review it and get back to you within 1-2 business days.</p>"
        f"<p>You can check your status any time by logging in to your dashboard.</p>"
        f"<p>The Aplite team</p>"
    )
    send_email(to_address, subject, body, html=html)


def send_onboarding_approved(to_address: str, first_name: str, legal_name: str, upi: str) -> None:
    subject = "Your Aplite verification is approved"
    body = (
        f"Hi {first_name},\n\n"
        f"Great news - {legal_name} has been verified on Aplite.\n\n"
        f"Your UPI: {upi}\n\n"
        f"Log in to start issuing child UPIs and sharing your payment identity securely.\n\n"
        f"The Aplite team"
    )
    html = (
        f"<p>Hi {first_name},</p>"
        f"<p>Great news - <strong>{legal_name}</strong> has been verified on Aplite.</p>"
        f"<p><strong>Your UPI:</strong> {upi}</p>"
        f"<p>Log in to start issuing child UPIs and sharing your payment identity securely.</p>"
        f"<p>The Aplite team</p>"
    )
    send_email(to_address, subject, body, html=html)


def send_onboarding_rejected(to_address: str, first_name: str, legal_name: str, reason: str) -> None:
    subject = "Update on your Aplite verification"
    body = (
        f"Hi {first_name},\n\n"
        f"After reviewing your application for {legal_name}, we were unable to approve it at this time.\n\n"
        f"Reason: {reason}\n\n"
        f"You can log in to update your details and resubmit your application.\n\n"
        f"The Aplite team"
    )
    html = (
        f"<p>Hi {first_name},</p>"
        f"<p>After reviewing your application for <strong>{legal_name}</strong>, "
        f"we were unable to approve it at this time.</p>"
        f"<p><strong>Reason:</strong> {reason}</p>"
        f"<p>You can log in to update your details and resubmit your application.</p>"
        f"<p>The Aplite team</p>"
    )
    send_email(to_address, subject, body, html=html)
