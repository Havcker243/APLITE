"""
Small encryption helpers for sensitive fields (at-rest protection).

Uses AES-GCM with a 256-bit key loaded from DATA_ENC_KEY (raw or base64).
If the key is missing, functions will raise to avoid silently storing plaintext.
"""

from __future__ import annotations

import base64
import os
import secrets
from typing import Tuple

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError as exc:  # pragma: no cover - dependency notice
    raise ImportError("cryptography is required for field encryption") from exc


DATA_KEY_ENV = "DATA_ENC_KEY"


def _load_key() -> bytes:
    key = os.getenv(DATA_KEY_ENV, "")
    if not key:
        raise RuntimeError(f"Missing encryption key; set {DATA_KEY_ENV} to a 32-byte base64 or raw key.")
    try:
        return base64.b64decode(key)
    except Exception:
        return key.encode("utf-8")


def encrypt_value(value: str) -> Tuple[str, str]:
    """
    Encrypt a string value, returning (nonce_b64, ciphertext_b64).
    """
    key = _load_key()
    aesgcm = AESGCM(key)
    nonce = secrets.token_bytes(12)
    ct = aesgcm.encrypt(nonce, value.encode("utf-8"), None)
    return base64.b64encode(nonce).decode("ascii"), base64.b64encode(ct).decode("ascii")


def decrypt_value(nonce_b64: str, ciphertext_b64: str) -> str:
    key = _load_key()
    aesgcm = AESGCM(key)
    nonce = base64.b64decode(nonce_b64)
    ct = base64.b64decode(ciphertext_b64)
    pt = aesgcm.decrypt(nonce, ct, None)
    return pt.decode("utf-8")
