"""
JSON-backed data helpers for the onboarding service.

Stores business and payment account data inside data/store.json so that
records persist across restarts.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TypedDict

from app.db.connection import get_connection
from app.utils import crypto


class BusinessRecord(TypedDict, total=False):
    id: int
    user_id: int
    parent_upi: str
    upi: str
    payment_account_id: int
    rails: List[str]
    core_entity_id: str
    legal_name: str
    ein: str
    business_type: str
    website: Optional[str]
    address: str
    country: str
    verification_status: str
    created_at: str
    status: str


class PaymentAccountRecord(TypedDict, total=False):
    id: int
    user_id: int
    business_id: int
    payment_index: int
    rail: str
    bank_name: str
    account_name: str
    ach_routing: Optional[str]
    ach_account: Optional[str]
    wire_routing: Optional[str]
    wire_account: Optional[str]
    bank_address: Optional[str]
    swift_bic: Optional[str]
    iban: Optional[str]
    bank_country: Optional[str]
    bank_city: Optional[str]
    enc: Dict[str, Dict[str, str]]


class UserRecord(TypedDict, total=False):
    id: int
    first_name: str
    last_name: str
    email: str
    company: str
    company_name: str
    summary: str
    established_year: Optional[int]
    state: Optional[str]
    country: Optional[str]
    password_hash: str
    master_upi: str
    created_at: str


class SessionRecord(TypedDict, total=False):
    token: str
    user_id: int
    created_at: str


class OtpRecord(TypedDict, total=False):
    id: str
    user_id: int
    digest: str
    salt: str
    expires_at: str
    consumed: bool


def _next_payment_index_for_user(user_id: int) -> int:
    """Return the next payment_index for a user's accounts."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select coalesce(max(payment_index), 0) as max_pi from payment_accounts where user_id = %s", (user_id,))
            row = cur.fetchone()
            current = int(row["max_pi"] or 0) if row else 0
            return current + 1


def _decrypt_payment_account(row: Optional[PaymentAccountRecord]) -> Optional[PaymentAccountRecord]:
    if not row:
        return row
    if "enc" not in row or not isinstance(row.get("enc"), dict):
        return row
    decrypted: PaymentAccountRecord = dict(row)
    enc_block = row.get("enc", {})
    for field, blob in enc_block.items():
        try:
            decrypted[field] = crypto.decrypt_value(blob["n"], blob["c"])
        except Exception:
            continue
    decrypted.pop("enc", None)
    return decrypted


def create_business(**payload: Any) -> int:
    """Persist a business row and return its ID."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into businesses
                (user_id, parent_upi, upi, payment_account_id, rails, core_entity_id, legal_name, ein, business_type,
                 website, address, country, verification_status, status, created_at)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
                returning id
                """,
                (
                    payload["user_id"],
                    payload["parent_upi"],
                    payload["upi"],
                    payload["payment_account_id"],
                    payload.get("rails", []),
                    payload["core_entity_id"],
                    payload["legal_name"],
                    payload["ein"],
                    payload["business_type"],
                    payload.get("website"),
                    payload["address"],
                    payload["country"],
                    payload["verification_status"],
                    payload.get("status", "active"),
                ),
            )
            conn.commit()
            row = cur.fetchone()
            return int(row["id"])


def update_business_status(business_id: int, *, status: str) -> Optional[BusinessRecord]:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "update businesses set status = %s where id = %s returning *",
                (status, business_id),
            )
            conn.commit()
            return cur.fetchone()


def create_payment_account(**payload: Any) -> int:
    """Persist a payment account row and return its ID."""
    if "user_id" not in payload:
        raise ValueError("user_id is required for payment accounts")
    if "payment_index" not in payload:
        payload["payment_index"] = _next_payment_index_for_user(payload["user_id"])

    sensitive_fields = [
        "ach_routing",
        "ach_account",
        "wire_routing",
        "wire_account",
        "bank_address",
        "swift_bic",
        "iban",
        "bank_country",
        "bank_city",
    ]
    enc: Dict[str, Dict[str, str]] = {}
    for field in sensitive_fields:
        value = payload.pop(field, None)
        if value:
            nonce, ciphertext = crypto.encrypt_value(str(value))
            enc[field] = {"n": nonce, "c": ciphertext}
    if enc:
        payload["enc"] = enc

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into payment_accounts
                (user_id, business_id, payment_index, rail, bank_name, account_name, enc, created_at)
                values (%s,%s,%s,%s,%s,%s,%s, now())
                returning id
                """,
                (
                    payload["user_id"],
                    payload.get("business_id"),
                    payload["payment_index"],
                    payload["rail"],
                    payload["bank_name"],
                    payload.get("account_name"),
                    json.dumps(payload.get("enc", {})),
                ),
            )
            conn.commit()
            row = cur.fetchone()
            return int(row["id"])


def list_businesses() -> List[BusinessRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from businesses order by id desc")
            return cur.fetchall()


def list_businesses_for_user(user_id: int) -> List[BusinessRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from businesses where user_id = %s order by id desc", (user_id,))
            return cur.fetchall()


def get_business_by_upi(upi: str) -> Optional[BusinessRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from businesses where upi = %s", (upi,))
            return cur.fetchone()


def get_user_business_by_upi(user_id: int, upi: str) -> Optional[BusinessRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from businesses where user_id = %s and upi = %s", (user_id, upi))
            return cur.fetchone()


def get_business_by_ein(ein: str) -> Optional[BusinessRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from businesses where ein = %s", (ein,))
            return cur.fetchone()


def get_user_business_by_ein(user_id: int, ein: str) -> Optional[BusinessRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from businesses where user_id = %s and ein = %s", (user_id, ein))
            return cur.fetchone()


def get_business_by_core_entity_id(core_entity_id: str) -> Optional[BusinessRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from businesses where core_entity_id = %s", (core_entity_id,))
            return cur.fetchone()


def get_payment_account(
    *, business_id: int, payment_index: int, rail: str
) -> Optional[PaymentAccountRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select * from payment_accounts
                where business_id = %s and payment_index = %s and rail = %s
                """,
                (business_id, payment_index, rail),
            )
            row = cur.fetchone()
            return _decrypt_payment_account(row) if row else None


def list_payment_accounts_for_user(user_id: int) -> List[PaymentAccountRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from payment_accounts where user_id = %s order by id desc", (user_id,))
            rows = cur.fetchall()
            return [_decrypt_payment_account(row) for row in rows]


def get_payment_account_by_id(account_id: int) -> Optional[PaymentAccountRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from payment_accounts where id = %s", (account_id,))
            row = cur.fetchone()
            return _decrypt_payment_account(row) if row else None


def update_payment_account(account_id: int, **fields: Any) -> Optional[PaymentAccountRecord]:
    # simplistic partial update for business_id
    set_fields = []
    params: List[Any] = []
    for key, value in fields.items():
        set_fields.append(f"{key} = %s")
        params.append(value)
    if not set_fields:
        return get_payment_account_by_id(account_id)
    params.append(account_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"update payment_accounts set {', '.join(set_fields)} where id = %s returning *", params)
            conn.commit()
            row = cur.fetchone()
            return _decrypt_payment_account(row) if row else None


def create_user(**payload: Any) -> int:
    """Persist a user row and return its ID."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into users
                (first_name, last_name, email, company, company_name, summary, established_year, state, country, password_hash, master_upi, created_at)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
                returning id
                """,
                (
                    payload["first_name"],
                    payload["last_name"],
                    payload["email"],
                    payload.get("company", ""),
                    payload.get("company_name", payload.get("company", "")),
                    payload.get("summary", ""),
                    payload.get("established_year"),
                    payload.get("state"),
                    payload.get("country"),
                    payload["password_hash"],
                    payload["master_upi"],
                ),
            )
            conn.commit()
            row = cur.fetchone()
            return int(row["id"])


def update_user_master_upi(user_id: int, master_upi: str) -> Optional[UserRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("update users set master_upi = %s where id = %s returning *", (master_upi, user_id))
            conn.commit()
            return cur.fetchone()


def get_user_by_email(email: str) -> Optional[UserRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from users where email = %s", (email,))
            return cur.fetchone()


def get_user_by_id(user_id: int) -> Optional[UserRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from users where id = %s", (user_id,))
            return cur.fetchone()


def get_business_by_id(business_id: int) -> Optional[BusinessRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from businesses where id = %s", (business_id,))
            return cur.fetchone()


def update_user_profile(user_id: int, **fields: Any) -> Optional[UserRecord]:
    assignments = []
    params: List[Any] = []
    for key in ["company_name", "summary", "established_year", "state", "country"]:
        if key in fields:
            assignments.append(f"{key} = %s")
            params.append(fields[key])
    if not assignments:
        return get_user_by_id(user_id)
    params.append(user_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"update users set {', '.join(assignments)} where id = %s returning *", params)
            conn.commit()
            return cur.fetchone()


def create_session(token: str, user_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "insert into sessions (token, user_id, created_at) values (%s,%s, now())",
                (token, user_id),
            )
            conn.commit()


def get_session(token: str) -> Optional[SessionRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from sessions where token = %s", (token,))
            return cur.fetchone()


def create_otp(record_id: str, user_id: int, code: str, expires_at: datetime) -> None:
    salt = os.urandom(16).hex()
    digest = hmac.new(salt.encode("utf-8"), code.encode("utf-8"), hashlib.sha256).hexdigest()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into otps (id, user_id, digest, salt, expires_at, consumed)
                values (%s,%s,%s,%s,%s,false)
                """,
                (record_id, user_id, digest, salt, expires_at),
            )
            conn.commit()


def get_otp(record_id: str) -> Optional[OtpRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from otps where id = %s", (record_id,))
            return cur.fetchone()


def consume_otp(record_id: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("update otps set consumed = true where id = %s", (record_id,))
            conn.commit()
