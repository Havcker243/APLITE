"""
Lightweight email helper used for sending OTP codes during login.

This is a stub implementation that logs the email contents to stdout so
development and testing can proceed without an SMTP provider.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def send_email(to_address: str, subject: str, body: str) -> None:
    """
    Log an email payload. Replace this with a real SMTP or API integration.
    """
    logger.info("Sending email to %s | %s\n%s", to_address, subject, body)
    # Also echo to stdout for local development visibility.
    print(f"[email] to={to_address} | subject={subject}\n{body}")
