"""
Helpers for generating and validating UPI values.

New format (14 chars):
  NS(2) + PI(2) + CORE(4) + SIG(6)
    NS: namespace derived from user_id and secret
    PI: zero-padded payment index (hidden but still present)
    CORE: truncated core entity segment
    SIG: HMAC-SHA256 over namespace+core+pi, base32-encoded, truncated to 6 chars
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import random
import string
from typing import NamedTuple

ALPHABET = string.ascii_uppercase + string.digits
CORE_SEGMENT_LENGTH = 4
NAMESPACE_LENGTH = 2
PAYMENT_INDEX_LENGTH = 2
SIGNATURE_LENGTH = 6
UPI_LENGTH = NAMESPACE_LENGTH + PAYMENT_INDEX_LENGTH + CORE_SEGMENT_LENGTH + SIGNATURE_LENGTH

SECRET_ENV_VAR = "UPI_SECRET_KEY"


class ParsedUPI(NamedTuple):
    namespace: str
    core_entity_id: str
    payment_index: int
    signature: str


def generate_core_entity_id() -> str:
    """Return a pseudo-unique core entity id."""
    core_segment = "".join(random.choices(ALPHABET, k=CORE_SEGMENT_LENGTH))
    return f"CORE-{core_segment}"


def _extract_core_segment(core_entity_id: str) -> str:
    segment = core_entity_id.split("-", 1)[-1].upper()
    segment = "".join(ch for ch in segment if ch in ALPHABET)
    if len(segment) < CORE_SEGMENT_LENGTH:
        segment = segment.ljust(CORE_SEGMENT_LENGTH, "0")
    else:
        segment = segment[:CORE_SEGMENT_LENGTH]
    return segment


def _load_secret() -> bytes:
    secret = os.getenv(SECRET_ENV_VAR, "")
    if not secret:
        raise RuntimeError(f"Missing secret key for UPI generation. Set {SECRET_ENV_VAR}.")
    # Accept raw or base64
    try:
        return base64.b64decode(secret)
    except Exception:
        return secret.encode("utf-8")


def _namespace_for_user(user_id: int, secret: bytes) -> str:
    digest = hmac.new(secret, str(user_id).encode("utf-8"), hashlib.sha256).digest()
    return base64.b32encode(digest).decode("ascii").rstrip("=").upper()[:NAMESPACE_LENGTH]


def _signature(namespace: str, core_segment: str, payment_index: int, secret: bytes) -> str:
    payload = f"{namespace}{core_segment}{payment_index:02d}".encode("utf-8")
    digest = hmac.new(secret, payload, hashlib.sha256).digest()
    return base64.b32encode(digest).decode("ascii").rstrip("=").upper()[:SIGNATURE_LENGTH]


def generate_upi(core_entity_id: str, payment_index: int, user_id: int) -> str:
    """
    Generate a UPI string with HMAC protection and user namespace.
    """
    # Namespace ties UPIs to a user without revealing user_id in the identifier.
    secret = _load_secret()
    namespace = _namespace_for_user(user_id, secret)
    core_segment = _extract_core_segment(core_entity_id)
    signature = _signature(namespace, core_segment, payment_index, secret)
    return f"{namespace}{payment_index:02d}{core_segment}{signature}"


def validate_upi_format(upi: str) -> bool:
    return len(upi) == UPI_LENGTH and all(ch in ALPHABET for ch in upi)


def parse_upi(upi: str) -> ParsedUPI:
    if not validate_upi_format(upi):
        raise ValueError("Invalid UPI format")

    namespace = upi[:NAMESPACE_LENGTH]
    try:
        payment_index = int(upi[NAMESPACE_LENGTH : NAMESPACE_LENGTH + PAYMENT_INDEX_LENGTH])
    except ValueError as exc:
        raise ValueError("Invalid UPI format") from exc

    core_segment_start = NAMESPACE_LENGTH + PAYMENT_INDEX_LENGTH
    core_segment_end = core_segment_start + CORE_SEGMENT_LENGTH
    core_segment = upi[core_segment_start:core_segment_end]
    signature = upi[core_segment_end:]
    core_entity_id = f"CORE-{core_segment}"

    return ParsedUPI(namespace=namespace, core_entity_id=core_entity_id, payment_index=payment_index, signature=signature)


def verify_upi(upi: str, user_id: int) -> bool:
    """
    Verify the UPI signature for the given user namespace.
    """
    try:
        parsed = parse_upi(upi)
    except ValueError:
        return False
    secret = _load_secret()
    expected_ns = _namespace_for_user(user_id, secret)
    if parsed.namespace != expected_ns:
        return False
    core_segment = _extract_core_segment(parsed.core_entity_id)
    expected_sig = _signature(parsed.namespace, core_segment, parsed.payment_index, secret)
    return hmac.compare_digest(expected_sig, parsed.signature)
