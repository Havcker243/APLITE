"""
Simple password hashing and token helpers for the MVP auth layer.
"""

from __future__ import annotations

import hashlib
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
