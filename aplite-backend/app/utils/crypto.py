"""Symmetric encryption helpers for sensitive banking fields.

Wraps AES-GCM for encrypting account numbers and routing details before
they are persisted. Uses a single service key loaded from the environment.
"""

import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv
import secrets

load_dotenv()

_RAW_KEY = os.getenv("ENCRYPTION_KEY")

if not _RAW_KEY:
    raise RuntimeError("ENCRYPTION_KEY is not set")

key = _RAW_KEY.encode("utf-8")

if len(key) not in (16, 24, 32):
    raise RuntimeError("ENCRYPTION_KEY must be 16, 24, or 32 bytes long")


def encrypt_value(value: str):
    aesgcm = AESGCM(key)
    nonce = secrets.token_bytes(12)
    ciphertext = aesgcm.encrypt(nonce, value.encode(), None)
    return nonce.hex(), ciphertext.hex()


def decrypt_value(nonce_hex: str, ciphertext_hex: str) -> str:
    aesgcm = AESGCM(key)
    nonce = bytes.fromhex(nonce_hex)
    ciphertext = bytes.fromhex(ciphertext_hex)
    return aesgcm.decrypt(nonce, ciphertext, None).decode()
