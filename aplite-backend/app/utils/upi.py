"""
Helpers for generating and validating UPI values.
"""

from __future__ import annotations

import random
import string
from typing import NamedTuple

ALPHABET = string.ascii_uppercase + string.digits
CORE_SEGMENT_LENGTH = 4
CHECKSUM_LENGTH = 2
PAYMENT_INDEX_LENGTH = 2
UPI_LENGTH = CHECKSUM_LENGTH + CORE_SEGMENT_LENGTH + PAYMENT_INDEX_LENGTH


class ParsedUPI(NamedTuple):
    checksum: str
    core_entity_id: str
    payment_index: int


def generate_core_entity_id() -> str:
    """Return a pseudo-unique core entity id for the MVP."""
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


def _compute_checksum(core_segment: str, payment_index: int) -> str:
    payload = f"{core_segment}{payment_index:02d}"
    total = sum(ord(ch) for ch in payload)
    first = ALPHABET[total % len(ALPHABET)]
    second = ALPHABET[(total // len(ALPHABET)) % len(ALPHABET)]
    return f"{first}{second}"


def generate_upi(core_entity_id: str, payment_index: int) -> str:
    """
    Generate a short UPI string with checksum protection.
    """
    core_segment = _extract_core_segment(core_entity_id)
    checksum = _compute_checksum(core_segment, payment_index)
    return f"{checksum}{core_segment}{payment_index:02d}"


def validate_upi_format(upi: str) -> bool:
    return len(upi) == UPI_LENGTH and all(ch in ALPHABET for ch in upi)


def parse_upi(upi: str) -> ParsedUPI:
    if not validate_upi_format(upi):
        raise ValueError("Invalid UPI format")

    checksum = upi[:CHECKSUM_LENGTH]
    core_segment = upi[CHECKSUM_LENGTH:-PAYMENT_INDEX_LENGTH]
    try:
        payment_index = int(upi[-PAYMENT_INDEX_LENGTH:])
    except ValueError as exc:
        raise ValueError("Invalid UPI format") from exc

    expected = _compute_checksum(core_segment, payment_index)
    if checksum != expected:
        raise ValueError("Invalid UPI checksum")

    core_entity_id = f"CORE-{core_segment}"
    return ParsedUPI(checksum=checksum, core_entity_id=core_entity_id, payment_index=payment_index)
