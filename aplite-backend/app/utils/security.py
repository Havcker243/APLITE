"""
Password hashing and session token helpers for the auth layer.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from typing import Tuple

HASH_ITERATIONS = 120_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, HASH_ITERATIONS)
    return f"{salt.hex()}:{digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split(":", 1)
    except ValueError:
        return False

    salt = bytes.fromhex(salt_hex)
    expected = bytes.fromhex(digest_hex)
    computed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, HASH_ITERATIONS)
    return secrets.compare_digest(computed, expected)


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def _load_session_hmac_key() -> bytes:
    """
    Load a server-side key used to hash session tokens at rest.

    Prefers SESSION_TOKEN_HMAC_KEY; falls back to UPI_SECRET_KEY or ENCRYPTION_KEY for MVP simplicity.
    """
    raw = os.getenv("SESSION_TOKEN_HMAC_KEY") or os.getenv("UPI_SECRET_KEY") or os.getenv("ENCRYPTION_KEY") or ""
    if not raw:
        raise RuntimeError("Missing SESSION_TOKEN_HMAC_KEY (or UPI_SECRET_KEY / ENCRYPTION_KEY) for session token hashing.")
    try:
        return base64.b64decode(raw)
    except Exception:
        return raw.encode("utf-8")


def hash_session_token(token: str) -> str:
    """
    Return a deterministic, non-reversible representation of a session token for DB storage.
    """
    key = _load_session_hmac_key()
    digest = hmac.new(key, token.encode("utf-8"), hashlib.sha256).hexdigest()
    return digest
