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
