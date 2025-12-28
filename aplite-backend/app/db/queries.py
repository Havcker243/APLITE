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
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TypedDict

import psycopg2

from app.db.connection import get_connection, transaction
from app.utils import crypto
from app.utils.email import send_email
from app.utils.security import hash_session_token
from app.utils.upi import generate_core_entity_id, generate_upi

"""
This module is the MVP data-access layer.

It is intentionally "flat" (one file) for MVP speed, and contains:
- User + session helpers
- OTP helpers
- Businesses + payment accounts
- Onboarding/KYB flow persistence
- File metadata helpers for onboarding uploads

As the project grows, these functions should be split into smaller modules
(e.g. `auth_queries.py`, `business_queries.py`, `onboarding_queries.py`)
while keeping `queries.py` as a compatibility re-export.
"""


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
    org_id: str
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
    status: str


class ChildUpiRecord(TypedDict, total=False):
    id: str
    org_id: str
    payment_account_id: int
    upi: str
    status: str
    created_at: str
    disabled_at: Optional[str]


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


class OrganizationRecord(TypedDict, total=False):
    id: str
    user_id: int
    legal_name: str
    dba: Optional[str]
    ein: str
    formation_date: str
    formation_state: str
    entity_type: str
    address: Dict[str, Any]
    industry: str
    website: Optional[str]
    description: Optional[str]
    issued_upi: Optional[str]
    created_at: str
    updated_at: str


class OnboardingSessionRecord(TypedDict, total=False):
    id: str
    org_id: str
    user_id: int
    state: str
    current_step: int
    step_statuses: Dict[str, Any]
    risk_level: str
    address_locked: bool
    last_saved_at: str
    completed_at: Optional[str]
    last_saved_at: str
    completed_at: Optional[str]


class VerificationAttemptRecord(TypedDict, total=False):
    id: str
    session_id: str
    org_id: str
    user_id: int
    method: str
    destination: Optional[str]
    status: str
    otp_id: Optional[str]
    attempts: int
    resend_count: int
    created_at: str
    verified_at: Optional[str]


def _next_payment_index_for_org(org_id: str, *, conn: psycopg2.extensions.connection | None = None) -> int:
    """Return the next payment_index for an org's accounts."""
    params = (str(org_id),)
    if conn is None:
        with get_connection() as conn_local:
            with conn_local.cursor() as cur:
                cur.execute("select coalesce(max(payment_index), 0) as max_pi from payment_accounts where org_id = %s", params)
                row = cur.fetchone()
                current = int(row["max_pi"] or 0) if row else 0
                return current + 1

    with conn.cursor() as cur:
        cur.execute("select coalesce(max(payment_index), 0) as max_pi from payment_accounts where org_id = %s", params)
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


def create_business(*, conn: psycopg2.extensions.connection | None = None, commit: bool = True, **payload: Any) -> int:
    """Persist a business row and return its ID."""
    def _insert(target_conn: psycopg2.extensions.connection) -> int:
        with target_conn.cursor() as cur:
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
            row = cur.fetchone()
            return int(row["id"])

    if conn is None:
        with get_connection() as conn_local:
            business_id = _insert(conn_local)
            conn_local.commit()
            return business_id

    business_id = _insert(conn)
    if commit:
        conn.commit()
    return business_id


def update_business_status(business_id: int, *, status: str) -> Optional[BusinessRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("update businesses set status = %s where id = %s returning *", (status, business_id))
            conn.commit()
            return cur.fetchone()


def create_payment_account(*, conn: psycopg2.extensions.connection | None = None, commit: bool = True, **payload: Any) -> int:
    """Persist a payment account row and return its ID."""
    if "user_id" not in payload:
        raise ValueError("user_id is required for payment accounts")
    if "org_id" not in payload:
        raise ValueError("org_id is required for payment accounts")
    if "payment_index" not in payload:
        payload["payment_index"] = _next_payment_index_for_org(str(payload["org_id"]), conn=conn)

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

    def _insert(target_conn: psycopg2.extensions.connection) -> int:
        with target_conn.cursor() as cur:
            cur.execute(
                """
                insert into payment_accounts
                (org_id, user_id, payment_index, rail, bank_name, account_name, enc, status, created_at)
                values (%s,%s,%s,%s,%s,%s,%s,%s, now())
                returning id
                """,
                (
                    payload["org_id"],
                    payload["user_id"],
                    payload["payment_index"],
                    payload["rail"],
                    payload["bank_name"],
                    payload.get("account_name"),
                    json.dumps(payload.get("enc", {})),
                    payload.get("status", "active"),
                ),
            )
            row = cur.fetchone()
            return int(row["id"])

    if conn is None:
        with get_connection() as conn_local:
            account_id = _insert(conn_local)
            conn_local.commit()
            return account_id

    account_id = _insert(conn)
    if commit:
        conn.commit()
    return account_id


def update_payment_account_details(
    *,
    account_id: int,
    user_id: int,
    bank_name: str | None = None,
    account_name: str | None = None,
    ach_routing: str | None = None,
    ach_account: str | None = None,
    wire_routing: str | None = None,
    wire_account: str | None = None,
    bank_address: str | None = None,
    swift_bic: str | None = None,
    iban: str | None = None,
    bank_country: str | None = None,
    bank_city: str | None = None,
) -> Optional[PaymentAccountRecord]:
    # Only updates provided fields; sensitive values are re-encrypted into `enc`.
    updates: list[str] = []
    params: list[Any] = []

    if bank_name is not None:
        updates.append("bank_name = %s")
        params.append(bank_name)
    if account_name is not None:
        updates.append("account_name = %s")
        params.append(account_name)

    sensitive = {
        "ach_routing": ach_routing,
        "ach_account": ach_account,
        "wire_routing": wire_routing,
        "wire_account": wire_account,
        "bank_address": bank_address,
        "swift_bic": swift_bic,
        "iban": iban,
        "bank_country": bank_country,
        "bank_city": bank_city,
    }
    enc_updates: Dict[str, Dict[str, str]] = {}
    for field, value in sensitive.items():
        if value is None:
            continue
        nonce, ciphertext = crypto.encrypt_value(str(value))
        enc_updates[field] = {"n": nonce, "c": ciphertext}

    if enc_updates:
        updates.append("enc = enc || %s::jsonb")
        params.append(json.dumps(enc_updates))

    if not updates:
        return get_payment_account_by_id(account_id)

    params.extend([int(account_id), int(user_id)])
    sql = f"update payment_accounts set {', '.join(updates)} where id = %s and user_id = %s returning *"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            row = cur.fetchone()
            conn.commit()
            return _decrypt_payment_account(row) if row else None


def list_businesses() -> List[BusinessRecord]:
    """Return all businesses (newest first)."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from businesses order by id desc")
            return cur.fetchall()

def _table_exists(table_name: str) -> bool:
    """
    Best-effort check for whether a table exists in the current database.

    This allows the MVP to run against older schemas that may not include newer tables yet.
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select to_regclass(%s) is not null as ok", (table_name,))
            row = cur.fetchone() or {}
            return bool(row.get("ok"))


def _list_public_clients_sql_verified_users(*, search: Optional[str], limit: int) -> List[Dict[str, Any]]:
    """
    Public directory of verified orgs.
    """
    search_value = (search or "").strip()
    search_like = f"%{search_value.lower()}%" if search_value else None

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select
                    o.id,
                    o.legal_name,
                    coalesce(nullif(u.company_name,''), nullif(u.company,''), o.legal_name) as company_name,
                    coalesce(o.address->>'country', u.country) as country,
                    u.state,
                    u.summary,
                    u.established_year,
                    o.status,
                    o.website,
                    o.industry,
                    o.description
                from organizations o
                join users u on u.id = o.user_id
                where (o.status is null or o.status <> 'deactivated')
                  and (o.verification_status = 'verified')
                  and (%s is null or lower(coalesce(nullif(u.company_name,''), nullif(u.company,''), o.legal_name)) like %s)
                order by o.created_at desc
                limit %s
                """,
                (search_like, search_like, int(limit)),
            )
            return cur.fetchall()

def _list_public_clients_sql_verified_businesses(*, search: Optional[str], limit: int) -> List[Dict[str, Any]]:
    # Legacy path unused in org-centric model; fall back to org query.
    return _list_public_clients_sql_verified_users(search=search, limit=limit)

def list_public_clients(*, search: Optional[str], limit: int) -> List[Dict[str, Any]]:
    """
    Return a public directory of verified clients (companies).

    Primary implementation uses a single SQL query for performance.
    If anything goes wrong (schema drift during MVP development, etc.),
    it falls back to a slower Python loop to avoid hard 500s.
    """
    try:
        if _table_exists("onboarding_sessions"):
            return _list_public_clients_sql_verified_users(search=search, limit=limit)
        return _list_public_clients_sql_verified_businesses(search=search, limit=limit)
    except Exception:
        # Ensure the failed transaction doesn't poison the connection before fallback.
        try:
            with get_connection() as conn:
                conn.rollback()
        except Exception:
            pass
        results: List[Dict[str, Any]] = []
        for biz in list_businesses():
            if biz.get("status") == "deactivated":
                continue
            owner = get_user_by_id(biz.get("user_id")) or {}
            verified = False
            if owner.get("id"):
                try:
                    verified = is_user_verified(int(owner["id"]))
                except Exception:
                    verified = False
            if owner.get("id") and not verified:
                continue
            display_name = owner.get("company_name") or biz.get("legal_name") or ""
            if search and search.lower() not in display_name.lower():
                continue
            results.append(
                {
                    "id": biz.get("id"),
                    "legal_name": biz.get("legal_name"),
                    "company_name": display_name,
                    "country": biz.get("country"),
                    "state": owner.get("state"),
                    "summary": owner.get("summary") or "",
                    "established_year": owner.get("established_year"),
                    "status": biz.get("status", "active"),
                    "website": biz.get("website"),
                    "industry": None,
                    "description": None,
                }
            )
            if len(results) >= int(limit):
                break
        return results


def list_businesses_for_user(user_id: int, *, limit: int | None = None, before_id: int | None = None) -> List[BusinessRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            params: list[Any] = [user_id]
            where = "where user_id = %s"
            if before_id is not None:
                where += " and id < %s"
                params.append(int(before_id))

            sql = f"select * from businesses {where} order by id desc"
            if limit is not None:
                sql += " limit %s"
                params.append(int(limit))
            cur.execute(sql, tuple(params))
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


def list_payment_accounts_for_owner(user_id: int) -> List[PaymentAccountRecord]:
    """
    Return payment accounts for orgs owned by the user.
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select pa.*
                from payment_accounts pa
                join organizations o on o.id = pa.org_id
                where o.user_id = %s or pa.user_id = %s
                order by pa.id desc
                """,
                (user_id, user_id),
            )
            rows = cur.fetchall()
            return [_decrypt_payment_account(row) for row in rows]


def list_payment_accounts_for_org(org_id: str) -> List[PaymentAccountRecord]:
    """
    Return payment accounts for a specific org.
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select * from payment_accounts where org_id = %s and status <> 'disabled' order by created_at desc",
                (str(org_id),),
            )
            rows = cur.fetchall()
            return [_decrypt_payment_account(row) for row in rows]


def payment_account_has_child_upis(account_id: int) -> bool:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select 1 from child_upis where payment_account_id = %s limit 1",
                (int(account_id),),
            )
            return cur.fetchone() is not None


def payment_account_used_for_org_upi(account: dict) -> bool:
    """
    Determine if the payment account was used for the org's primary UPI.

    Uses the onboarding session's stored payment_account_id instead of
    inferring from payment_index, avoiding false positives.
    """
    org_id = account.get("org_id")
    if not org_id:
        return False
    session = get_latest_onboarding_session_by_org(str(org_id))
    if not session:
        return False
    account_id = get_onboarding_payment_account(uuid.UUID(str(session.get("id"))))
    if not account_id:
        return False
    return int(account_id) == int(account.get("id", 0) or 0)


def get_payment_account_by_id(account_id: int) -> Optional[PaymentAccountRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from payment_accounts where id = %s", (account_id,))
            row = cur.fetchone()
            return _decrypt_payment_account(row) if row else None


def get_payment_account_by_org_and_index(org_id: str, payment_index: int, rail: str) -> Optional[PaymentAccountRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select * from payment_accounts where org_id = %s and payment_index = %s and rail = %s and status <> 'disabled'",
                (str(org_id), int(payment_index), rail),
            )
            row = cur.fetchone()
            return _decrypt_payment_account(row) if row else None


def create_child_upi(
    *,
    org_id: str,
    payment_account_id: int,
    upi: str,
    status: str = "active",
) -> str:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into child_upis (org_id, payment_account_id, upi, status)
                values (%s, %s, %s, %s)
                returning id
                """,
                (str(org_id), int(payment_account_id), upi, status),
            )
            row = cur.fetchone() or {}
            conn.commit()
            return str(row.get("id"))


def get_child_upi_by_value(upi: str) -> Optional[ChildUpiRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select * from child_upis where upi = %s",
                (upi,),
            )
            return cur.fetchone()


def get_child_upi_by_id(child_upi_id: str) -> Optional[ChildUpiRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select * from child_upis where id = %s",
                (str(child_upi_id),),
            )
            return cur.fetchone()


def list_child_upis_for_org(
    org_id: str,
    *,
    limit: int | None = None,
    before: datetime | None = None,
) -> List[Dict[str, Any]]:
    # Cursor-based pagination using created_at; caller controls `limit` + `before`.
    with get_connection() as conn:
        with conn.cursor() as cur:
            params: list[Any] = [str(org_id)]
            where = "where cu.org_id = %s"
            if before is not None:
                where += " and cu.created_at < %s"
                params.append(before)

            sql = f"""
                select
                  cu.id as child_upi_id,
                  cu.upi,
                  cu.status,
                  cu.created_at,
                  cu.disabled_at,
                  pa.id as payment_account_id,
                  pa.rail,
                  pa.bank_name
                from child_upis cu
                join payment_accounts pa on pa.id = cu.payment_account_id
                {where}
                order by cu.created_at desc
            """
            if limit is not None:
                sql += " limit %s"
                params.append(int(limit))

            cur.execute(sql, tuple(params))
            return cur.fetchall()


def _set_child_upi_status(child_upi_id: str, *, status: str) -> Optional[ChildUpiRecord]:
    disabled_at_sql = "now()" if status == "disabled" else "null"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                update child_upis
                set status = %s,
                    disabled_at = {disabled_at_sql}
                where id = %s
                returning *
                """,
                (status, str(child_upi_id)),
            )
            row = cur.fetchone()
            conn.commit()
            return row


def disable_child_upi(child_upi_id: str) -> Optional[ChildUpiRecord]:
    return _set_child_upi_status(child_upi_id, status="disabled")


def reactivate_child_upi(child_upi_id: str) -> Optional[ChildUpiRecord]:
    return _set_child_upi_status(child_upi_id, status="active")


def update_payment_account(account_id: int, *, conn: psycopg2.extensions.connection | None = None, commit: bool = True, **fields: Any) -> Optional[PaymentAccountRecord]:
    # simplistic partial update for business_id
    set_fields = []
    params: List[Any] = []
    for key, value in fields.items():
        set_fields.append(f"{key} = %s")
        params.append(value)
    if not set_fields:
        if conn is None:
            return get_payment_account_by_id(account_id)
        with conn.cursor() as cur:
            cur.execute("select * from payment_accounts where id = %s", (account_id,))
            row = cur.fetchone()
            return _decrypt_payment_account(row) if row else None

    params.append(account_id)

    def _update(target_conn: psycopg2.extensions.connection) -> Optional[PaymentAccountRecord]:
        with target_conn.cursor() as cur:
            cur.execute(f"update payment_accounts set {', '.join(set_fields)} where id = %s returning *", params)
            row = cur.fetchone()
            return _decrypt_payment_account(row) if row else None

    if conn is None:
        with get_connection() as conn_local:
            updated = _update(conn_local)
            conn_local.commit()
            return updated

    updated = _update(conn)
    if commit:
        conn.commit()
    return updated


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


def get_user_by_master_upi(upi: str) -> Optional[UserRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from users where master_upi = %s", (upi,))
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
    """Create a new session token for the given user."""
    token_hash = hash_session_token(token)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "insert into sessions (token, user_id, created_at) values (%s,%s, now())",
                (token_hash, user_id),
            )
            conn.commit()


def get_session(token: str) -> Optional[SessionRecord]:
    """Fetch an active session by token."""
    token_hash = hash_session_token(token)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from sessions where token = %s", (token_hash,))
            row = cur.fetchone()
            if row:
                return row

            # Backwards-compat: accept legacy plaintext tokens and upgrade on first use.
            cur.execute("select * from sessions where token = %s", (token,))
            row = cur.fetchone()
            if not row:
                return None
            try:
                cur.execute("update sessions set token = %s where token = %s", (token_hash, token))
                conn.commit()
            except Exception:
                # Best-effort; still treat the session as valid for this request.
                try:
                    conn.rollback()
                except Exception:
                    pass
            return row


def delete_session(token: str) -> None:
    """Invalidate a session token (logout)."""
    token_hash = hash_session_token(token)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("delete from sessions where token = %s or token = %s", (token_hash, token))
            conn.commit()


def create_otp(record_id: str, user_id: int, code: str, expires_at: datetime) -> None:
    """Store a one-time code as a salted HMAC digest with an expiry timestamp."""
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


def get_active_onboarding_session(user_id: int) -> Optional[OnboardingSessionRecord]:
    if not _table_exists("onboarding_sessions"):
        return None
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select * from onboarding_sessions
                where user_id = %s and completed_at is null
                order by last_saved_at desc
                limit 1
                """,
                (user_id,),
            )
            return cur.fetchone()


def reset_active_onboarding(user_id: int) -> bool:
    """
    Delete any in-progress onboarding session (and its org) for the user.

    Used to ensure a clean restart when a user begins onboarding again.
    """
    if not _table_exists("onboarding_sessions"):
        return False
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select * from onboarding_sessions
                where user_id = %s and completed_at is null
                order by last_saved_at desc
                limit 1
                """,
                (user_id,),
            )
            session = cur.fetchone()
            if not session:
                return False
            if str(session.get("state")) == "VERIFIED":
                return False
            org_id = session.get("org_id")

            cur.execute("delete from onboarding_sessions where id = %s", (str(session["id"]),))
            if org_id:
                cur.execute("delete from organizations where id = %s and user_id = %s", (str(org_id), user_id))
            conn.commit()
            return True


def get_latest_onboarding_session(user_id: int) -> Optional[OnboardingSessionRecord]:
    """Return the most recently saved onboarding session for a user (active or completed)."""
    if not _table_exists("onboarding_sessions"):
        return None
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select *
                from onboarding_sessions
                where user_id = %s
                order by last_saved_at desc
                limit 1
                """,
                (user_id,),
            )
            return cur.fetchone()


def get_latest_onboarding_session_by_org(org_id: str) -> Optional[OnboardingSessionRecord]:
    """Return the most recently saved onboarding session for an org."""
    if not _table_exists("onboarding_sessions"):
        return None
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select *
                from onboarding_sessions
                where org_id = %s
                order by last_saved_at desc
                limit 1
                """,
                (str(org_id),),
            )
            return cur.fetchone()

def get_user_stats(user_id: int) -> Dict[str, int]:
    """Return a few small counts used by the UI (accounts, issued UPIs)."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select count(*) as n from payment_accounts pa join organizations o on o.id = pa.org_id where o.user_id = %s",
                (user_id,),
            )
            accounts = int((cur.fetchone() or {}).get("n", 0) or 0)
            cur.execute("select count(*) as n from organizations where user_id = %s and coalesce(nullif(upi,''), null) is not null", (user_id,))
            upis = int((cur.fetchone() or {}).get("n", 0) or 0)
    return {"payment_accounts": accounts, "upis": upis}


def update_organization_profile(
    *,
    org_id: str,
    user_id: int,
    dba: Optional[str] = None,
    address: Optional[Dict[str, Any]] = None,
    industry: Optional[str] = None,
    website: Optional[str] = None,
    description: Optional[str] = None,
) -> Optional[OrganizationRecord]:
    """
    Update editable organization (onboarding) profile fields for the current user.

    This is used by the Profile page to allow limited edits after onboarding.
    """
    assignments: List[str] = []
    params: List[Any] = []
    if dba is not None:
        assignments.append("dba = %s")
        params.append(dba)
    if address is not None:
        assignments.append("address = %s::jsonb")
        params.append(json.dumps(address))
    if industry is not None:
        assignments.append("industry = %s")
        params.append(industry)
    if website is not None:
        assignments.append("website = %s")
        params.append(website)
    if description is not None:
        assignments.append("description = %s")
        params.append(description)

    if not assignments:
        return get_organization(org_id, user_id)

    params.extend([str(org_id), int(user_id)])
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"update organizations set {', '.join(assignments)}, updated_at=now() where id = %s and user_id = %s returning *",
                params,
            )
            conn.commit()
            return cur.fetchone()


def get_onboarding_session_by_id(session_id: uuid.UUID) -> Optional[OnboardingSessionRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from onboarding_sessions where id = %s", (str(session_id),))
            return cur.fetchone()


def touch_onboarding_session(session_id: uuid.UUID) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("update onboarding_sessions set last_saved_at = now() where id = %s", (str(session_id),))
            conn.commit()


def create_organization_step1(
    *,
    org_id: uuid.UUID,
    user_id: int,
    legal_name: str,
    dba: Optional[str],
    ein: str,
    formation_date: Any,
    formation_state: str,
    entity_type: str,
    address: Dict[str, Any],
    industry: str,
    website: Optional[str],
    description: Optional[str],
    conn: psycopg2.extensions.connection | None = None,
    commit: bool = True,
) -> None:
    def _insert(target_conn: psycopg2.extensions.connection) -> None:
        with target_conn.cursor() as cur:
            cur.execute(
                """
                insert into organizations
                (id, user_id, legal_name, dba, ein, formation_date, formation_state, entity_type, address, industry, website, description, created_at, updated_at)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now(), now())
                """,
                (
                    str(org_id),
                    user_id,
                    legal_name,
                    dba,
                    ein,
                    formation_date,
                    formation_state,
                    entity_type,
                    json.dumps(address),
                    industry,
                    website,
                    description,
                ),
            )

    if conn is None:
        with get_connection() as conn_local:
            _insert(conn_local)
            conn_local.commit()
        return

    _insert(conn)
    if commit:
        conn.commit()


def update_organization_step1(
    *,
    org_id: uuid.UUID,
    user_id: int,
    legal_name: str,
    dba: Optional[str],
    ein: str,
    formation_date: Any,
    formation_state: str,
    entity_type: str,
    address: Dict[str, Any],
    industry: str,
    website: Optional[str],
    description: Optional[str],
) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                update organizations
                set legal_name=%s, dba=%s, ein=%s, formation_date=%s, formation_state=%s, entity_type=%s,
                    address=%s, industry=%s, website=%s, description=%s, updated_at=now()
                where id=%s and user_id=%s
                """,
                (
                    legal_name,
                    dba,
                    ein,
                    formation_date,
                    formation_state,
                    entity_type,
                    json.dumps(address),
                    industry,
                    website,
                    description,
                    str(org_id),
                    user_id,
                ),
            )
            conn.commit()


def get_organization(org_id: str, user_id: int) -> Optional[OrganizationRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from organizations where id = %s and user_id = %s", (str(org_id), user_id))
            return cur.fetchone()


def get_organization_by_id(org_id: str) -> Optional[OrganizationRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from organizations where id = %s", (str(org_id),))
            return cur.fetchone()


def list_organizations_for_user(user_id: int) -> List[OrganizationRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from organizations where user_id = %s order by created_at desc", (user_id,))
            return cur.fetchall()


def get_organization_by_upi(upi: str) -> Optional[OrganizationRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from organizations where upi = %s", (upi,))
            return cur.fetchone()


def set_organization_upi(
    org_id: str,
    upi: str,
    payment_account_id: int,
    *,
    verification_status: str = "verified",
    status: str = "active",
    conn: psycopg2.extensions.connection | None = None,
    commit: bool = True,
) -> None:
    def _update(target_conn: psycopg2.extensions.connection) -> None:
        with target_conn.cursor() as cur:
            cur.execute(
                "update organizations set upi=%s, verification_status=%s, status=%s, updated_at=now() where id=%s",
                (upi, verification_status, status, str(org_id)),
            )
            cur.execute("update payment_accounts set status='active' where id=%s", (payment_account_id,))

    if conn is None:
        with get_connection() as conn_local:
            _update(conn_local)
            conn_local.commit()
        return

    _update(conn)
    if commit:
        conn.commit()


def set_organization_verification_status(
    org_id: str,
    *,
    verification_status: str,
    status: str | None = None,
    conn: psycopg2.extensions.connection | None = None,
    commit: bool = True,
) -> None:
    assignments = ["verification_status=%s", "updated_at=now()"]
    params: list = [verification_status]
    if status is not None:
        assignments.insert(1, "status=%s")
        params.append(status)
    params.append(str(org_id))

    def _update(target_conn: psycopg2.extensions.connection) -> None:
        with target_conn.cursor() as cur:
            cur.execute(f"update organizations set {', '.join(assignments)} where id=%s", tuple(params))

    if conn is None:
        with get_connection() as conn_local:
            _update(conn_local)
            conn_local.commit()
        return

    _update(conn)
    if commit:
        conn.commit()


def set_onboarding_payment_account(
    session_id: uuid.UUID,
    payment_account_id: int,
    *,
    conn: psycopg2.extensions.connection | None = None,
    commit: bool = True,
) -> None:
    def _update(target_conn: psycopg2.extensions.connection) -> None:
        with target_conn.cursor() as cur:
            cur.execute(
                "update onboarding_sessions set step_statuses = jsonb_set(coalesce(step_statuses,'{}'::jsonb), '{payment_account_id}', %s::jsonb, true), last_saved_at=now() where id=%s",
                (json.dumps(payment_account_id), str(session_id)),
            )

    if conn is None:
        with get_connection() as conn_local:
            _update(conn_local)
            conn_local.commit()
        return

    _update(conn)
    if commit:
        conn.commit()


def get_onboarding_payment_account(session_id: uuid.UUID) -> Optional[int]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select (step_statuses->>'payment_account_id')::int as account_id from onboarding_sessions where id = %s", (str(session_id),))
            row = cur.fetchone()
            if not row:
                return None
            return row.get("account_id")


def create_onboarding_session(
    *,
    session_id: uuid.UUID,
    org_id: uuid.UUID,
    user_id: int,
    state: str,
    current_step: int,
    address_locked: bool,
    conn: psycopg2.extensions.connection | None = None,
    commit: bool = True,
) -> None:
    def _insert(target_conn: psycopg2.extensions.connection) -> None:
        with target_conn.cursor() as cur:
            cur.execute(
                """
                insert into onboarding_sessions
                (id, org_id, user_id, state, current_step, address_locked, last_saved_at)
                values (%s,%s,%s,%s,%s,%s, now())
                """,
                (str(session_id), str(org_id), user_id, state, current_step, address_locked),
            )

    if conn is None:
        with get_connection() as conn_local:
            _insert(conn_local)
            conn_local.commit()
        return

    _insert(conn)
    if commit:
        conn.commit()


def advance_onboarding_session(
    session_id: uuid.UUID,
    *,
    state: str,
    next_step: int,
    conn: psycopg2.extensions.connection | None = None,
    commit: bool = True,
) -> None:
    def _update(target_conn: psycopg2.extensions.connection) -> None:
        with target_conn.cursor() as cur:
            cur.execute(
                "update onboarding_sessions set state=%s, current_step=%s, last_saved_at=now() where id=%s",
                (state, next_step, str(session_id)),
            )

    if conn is None:
        with get_connection() as conn_local:
            _update(conn_local)
            conn_local.commit()
        return

    _update(conn)
    if commit:
        conn.commit()


def complete_onboarding_session(
    session_id: uuid.UUID,
    *,
    state: str = "VERIFIED",
    conn: psycopg2.extensions.connection | None = None,
    commit: bool = True,
) -> None:
    def _update(target_conn: psycopg2.extensions.connection) -> None:
        with target_conn.cursor() as cur:
            cur.execute(
                "update onboarding_sessions set state=%s, current_step=5, completed_at=now(), last_saved_at=now() where id=%s",
                (state, str(session_id)),
            )

    if conn is None:
        with get_connection() as conn_local:
            _update(conn_local)
            conn_local.commit()
        return

    _update(conn)
    if commit:
        conn.commit()

def update_onboarding_role(
    *,
    session_id: uuid.UUID,
    user_id: int,
    role: str,
    title: Optional[str],
    risk_level: str,
    conn: psycopg2.extensions.connection | None = None,
    commit: bool = True,
) -> None:
    def _update(target_conn: psycopg2.extensions.connection) -> None:
        with target_conn.cursor() as cur:
            cur.execute(
                "update onboarding_sessions set step_statuses = jsonb_set(coalesce(step_statuses,'{}'::jsonb), '{role}', %s::jsonb, true), risk_level=%s, last_saved_at=now() where id=%s and user_id=%s",
                (json.dumps({"role": role, "title": title}), risk_level, str(session_id), user_id),
            )

    if conn is None:
        with get_connection() as conn_local:
            _update(conn_local)
            conn_local.commit()
        return

    _update(conn)
    if commit:
        conn.commit()


def store_onboarding_file(*, file_id: str, filename: str, content_type: str, data: bytes, user_id: int) -> None:
    """
    Store an onboarding upload (MVP local disk storage).

    Writes:
    - `<file_id>.bin`: raw file bytes
    - `<file_id>.json`: metadata (including `user_id` ownership)
    """
    if not re.match(r"^id_[0-9a-f]{32}$", file_id):
        raise ValueError("Invalid file_id")

    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads"))
    os.makedirs(base, exist_ok=True)
    meta_path = os.path.abspath(os.path.join(base, f"{file_id}.json"))
    bin_path = os.path.abspath(os.path.join(base, f"{file_id}.bin"))
    if not meta_path.startswith(base + os.sep) or not bin_path.startswith(base + os.sep):
        raise ValueError("Invalid file_id")
    with open(bin_path, "wb") as f:
        f.write(data)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({"user_id": user_id, "filename": filename, "content_type": content_type}, f)


def onboarding_upload_base_dir() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads"))


def _is_valid_onboarding_file_id(file_id: str, *, allowed_prefixes: tuple[str, ...]) -> bool:
    if not allowed_prefixes:
        return False
    prefix_group = "|".join(re.escape(prefix) for prefix in allowed_prefixes)
    return bool(re.match(rf"^({prefix_group})_[0-9a-f]{{32}}$", file_id))


def store_onboarding_file_metadata(
    *,
    file_id: str,
    filename: str,
    content_type: str,
    user_id: int,
    doc_category: str | None = None,
    doc_type: str | None = None,
) -> None:
    """
    Store onboarding upload metadata (used when the file bytes are written elsewhere).
    """
    if not _is_valid_onboarding_file_id(file_id, allowed_prefixes=("id", "form")):
        raise ValueError("Invalid file_id")

    base = onboarding_upload_base_dir()
    os.makedirs(base, exist_ok=True)
    meta_path = os.path.abspath(os.path.join(base, f"{file_id}.json"))
    if not meta_path.startswith(base + os.sep):
        raise ValueError("Invalid file_id")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "user_id": user_id,
                "filename": filename,
                "content_type": content_type,
                "doc_category": doc_category,
                "doc_type": doc_type,
            },
            f,
        )


def onboarding_file_exists(*, file_id: str, user_id: int, allowed_prefixes: tuple[str, ...] = ("id",)) -> bool:
    """
    Validate that an onboarding upload exists and is owned by the user.

    This is used to ensure `id_document_id` references are not forged and to
    prevent path traversal (strict file_id format + base-dir constraint).
    """
    if not _is_valid_onboarding_file_id(file_id, allowed_prefixes=allowed_prefixes):
        return False

    # First, check metadata file to confirm ownership.
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads"))
    meta_path = os.path.abspath(os.path.join(base, f"{file_id}.json"))
    if not meta_path.startswith(base + os.sep):
        return False
    if not os.path.exists(meta_path):
        return False
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        if int(meta.get("user_id", -1)) != int(user_id):
            return False
    except Exception:
        return False

    # If Supabase/S3 is configured, ensure the object exists as well.
    bucket = os.getenv("DATABASE_BUCKET_NAME")
    endpoint = os.getenv("DATABASE_BUCKET_S3_ENDPOINT")
    access_key = os.getenv("DATABASE_BUCKET_S3_ACCESS_KEY_ID")
    secret_key = os.getenv("DATABASE_BUCKET_S3_SECRET_ACCESS_KEY")
    region = os.getenv("DATABASE_BUCKET_S3_REGION", "us-east-1")
    if bucket and endpoint and access_key and secret_key:
        try:
            import boto3
            from botocore.client import Config as BotoConfig

            s3 = boto3.client(
                "s3",
                endpoint_url=endpoint,
                region_name=region,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                config=BotoConfig(signature_version="s3v4"),
            )
            key_prefix = "formations" if file_id.startswith("form_") else "ids"
            key = f"{key_prefix}/{file_id}.bin"
            s3.head_object(Bucket=bucket, Key=key)
            return True
        except Exception:
            return False

    # Fallback: ensure local file exists.
    bin_path = os.path.abspath(os.path.join(base, f"{file_id}.bin"))
    return bin_path.startswith(base + os.sep) and os.path.exists(bin_path)


def set_onboarding_formation_documents(
    session_id: uuid.UUID,
    documents: list[dict],
    *,
    conn: psycopg2.extensions.connection | None = None,
    commit: bool = True,
) -> None:
    """Persist formation document references for audit and verification."""
    def _update(target_conn: psycopg2.extensions.connection) -> None:
        with target_conn.cursor() as cur:
            cur.execute(
                "update onboarding_sessions set step_statuses = jsonb_set(coalesce(step_statuses,'{}'::jsonb), '{formation_documents}', %s::jsonb, true), last_saved_at=now() where id=%s",
                (json.dumps(documents), str(session_id)),
            )

    if conn is None:
        with get_connection() as conn_local:
            _update(conn_local)
            conn_local.commit()
        return

    _update(conn)
    if commit:
        conn.commit()


def create_identity_verification(
    *,
    verification_id: uuid.UUID,
    session_id: uuid.UUID,
    org_id: uuid.UUID,
    user_id: int,
    full_name: str,
    title: Optional[str],
    id_document_id: str,
    phone: Optional[str],
    attestation: bool,
    status: str,
    conn: psycopg2.extensions.connection | None = None,
    commit: bool = True,
) -> None:
    def _insert(target_conn: psycopg2.extensions.connection) -> None:
        with target_conn.cursor() as cur:
            cur.execute(
                """
                insert into identity_verifications
                (id, session_id, org_id, user_id, full_name, title, id_document_id, phone, attestation, status, created_at)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
                """,
                (str(verification_id), str(session_id), str(org_id), user_id, full_name, title, id_document_id, phone, attestation, status),
            )

    if conn is None:
        with get_connection() as conn_local:
            _insert(conn_local)
            conn_local.commit()
        return

    _insert(conn)
    if commit:
        conn.commit()


def create_bank_rail_mapping(
    *,
    mapping_id: uuid.UUID,
    session_id: uuid.UUID,
    org_id: uuid.UUID,
    user_id: int,
    bank_name: str,
    account_number: str,
    last4: str,
    ach_routing: Optional[str],
    wire_routing: Optional[str],
    swift: Optional[str],
) -> None:
    nonce, ciphertext = crypto.encrypt_value(account_number)
    enc = {"n": nonce, "c": ciphertext}
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into bank_rail_mappings
                (id, session_id, org_id, user_id, bank_name, account_last4, account_number_enc, ach_routing, wire_routing, swift, created_at)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
                """,
                (
                    str(mapping_id),
                    str(session_id),
                    str(org_id),
                    user_id,
                    bank_name,
                    last4,
                    json.dumps(enc),
                    ach_routing,
                    wire_routing,
                    swift,
                ),
            )
            conn.commit()


def create_verification_otp(*, user_id: int, ttl: Any) -> tuple[str, str]:
    """Create and persist an OTP for onboarding verification; returns (otp_id, raw_code)."""
    otp_id = uuid.uuid4().hex
    # 6 digit code
    code = f"{int.from_bytes(os.urandom(2), 'big') % 1000000:06d}"
    expires_at = datetime.now(timezone.utc) + ttl
    create_otp(otp_id, user_id=user_id, code=code, expires_at=expires_at)
    return otp_id, code


def verify_otp(*, otp_id: str, code: str) -> bool:
    """
    Verify a submitted OTP against the stored digest and expiry.

    Note: Postgres drivers may return `expires_at` as a datetime; this code
    supports both datetime and ISO string representations.
    """
    record = get_otp(otp_id)
    if not record:
        return False
    if record.get("consumed"):
        return False
    expires_at_raw = record.get("expires_at")
    expires_at: datetime | None = None
    if isinstance(expires_at_raw, datetime):
        expires_at = expires_at_raw
    elif isinstance(expires_at_raw, str):
        try:
            expires_at = datetime.fromisoformat(expires_at_raw)
        except Exception:
            expires_at = None
    if expires_at is None:
        return False
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = expires_at.astimezone(timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        return False
    expected = hmac.new(record.get("salt", "").encode("utf-8"), code.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, record.get("digest", "")):
        return False
    consume_otp(otp_id)
    return True


def create_verification_attempt(
    *,
    attempt_id: uuid.UUID,
    session_id: uuid.UUID,
    org_id: uuid.UUID,
    user_id: int,
    method: str,
    destination: Optional[str],
    otp_id: str,
) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into verification_attempts
                (id, session_id, org_id, user_id, method, destination, status, otp_id, attempts, resend_count, created_at)
                values (%s,%s,%s,%s,%s,%s,'sent',%s,0,0, now())
                """,
                (str(attempt_id), str(session_id), str(org_id), user_id, method, destination, otp_id),
            )
            conn.commit()


def get_latest_verification_attempt(user_id: int, session_id: uuid.UUID) -> Optional[VerificationAttemptRecord]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select * from verification_attempts
                where user_id = %s and session_id = %s
                order by created_at desc
                limit 1
                """,
                (user_id, str(session_id)),
            )
            return cur.fetchone()


def bump_verification_attempt(attempt_id: uuid.UUID) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("update verification_attempts set attempts = attempts + 1 where id = %s", (str(attempt_id),))
            conn.commit()


def bump_verification_resend(attempt_id: uuid.UUID) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("update verification_attempts set resend_count = resend_count + 1 where id = %s", (str(attempt_id),))
            conn.commit()


def update_verification_attempt_otp(attempt_id: uuid.UUID, *, otp_id: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update verification_attempts set otp_id=%s, created_at=now(), status='sent' where id=%s",
                (otp_id, str(attempt_id)),
            )
            conn.commit()


def mark_verification_attempt_verified(attempt_id: uuid.UUID) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update verification_attempts set status='verified', verified_at=now() where id = %s",
                (str(attempt_id),),
            )
            conn.commit()


def send_verification_message_email(*, to_address: str, code: str) -> None:
    send_email(to_address=to_address, subject="Your Aplite verification code", body=f"Your verification code is {code}. It expires in 10 minutes.")


def send_verification_message_sms(*, code: str) -> None:
    # MVP: no SMS provider wired; log for development.
    print(f"[sms] verification code: {code}")


def create_verification_call(
    *,
    call_id: uuid.UUID,
    session_id: uuid.UUID,
    org_id: uuid.UUID,
    user_id: int,
    scheduled_at: Any,
) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into verification_calls
                (id, session_id, org_id, user_id, scheduled_at, status, created_at)
                values (%s,%s,%s,%s,%s,'scheduled', now())
                """,
                (str(call_id), str(session_id), str(org_id), user_id, scheduled_at),
            )
            conn.commit()


def complete_onboarding_tx(
    *,
    user_id: int,
    org_data: Dict[str, Any],
    role_data: Dict[str, Any],
    identity_data: Dict[str, Any],
    bank_data: Dict[str, Any],
    formation_docs: list[dict],
    verification_method: str,
    risk_level: str,
    master_upi: str,
) -> Dict[str, Any]:
    """
    Atomically complete onboarding in a single transaction.

    All database operations succeed or fail together, preventing orphaned records.
    """
    org_id = uuid.uuid4()
    session_id = uuid.uuid4()
    pending_call = verification_method == "call"

    with transaction() as conn:
        create_organization_step1(
            org_id=org_id,
            user_id=user_id,
            legal_name=org_data["legal_name"],
            dba=org_data.get("dba"),
            ein=org_data["ein"],
            formation_date=org_data["formation_date"],
            formation_state=org_data["formation_state"],
            entity_type=org_data["entity_type"],
            address=org_data["address"],
            industry=org_data["industry"],
            website=org_data.get("website"),
            description=org_data.get("description"),
            conn=conn,
            commit=False,
        )

        create_onboarding_session(
            session_id=session_id,
            org_id=org_id,
            user_id=user_id,
            state="STEP_2_COMPLETE",
            current_step=3,
            address_locked=True,
            conn=conn,
            commit=False,
        )

        if formation_docs:
            set_onboarding_formation_documents(session_id=session_id, documents=formation_docs, conn=conn, commit=False)

        update_onboarding_role(
            session_id=session_id,
            user_id=user_id,
            role=role_data["role"],
            title=role_data.get("title"),
            risk_level=risk_level,
            conn=conn,
            commit=False,
        )

        verification_id = uuid.uuid4()
        create_identity_verification(
            verification_id=verification_id,
            session_id=session_id,
            org_id=org_id,
            user_id=user_id,
            full_name=identity_data["full_name"],
            title=identity_data.get("title"),
            id_document_id=identity_data["id_document_id"],
            phone=identity_data.get("phone"),
            attestation=identity_data["attestation"],
            status="pending",
            conn=conn,
            commit=False,
        )

        rail = "ACH" if bank_data.get("ach_routing") else ("WIRE_DOM" if bank_data.get("wire_routing") else "SWIFT")
        if not (bank_data.get("ach_routing") or bank_data.get("wire_routing") or bank_data.get("swift")):
            raise ValueError("Provide at least one rail (ACH routing, wire routing, or SWIFT).")

        payment_index = _next_payment_index_for_org(str(org_id), conn=conn)
        payment_account_id = create_payment_account(
            user_id=user_id,
            org_id=str(org_id),
            payment_index=payment_index,
            rail=rail,
            bank_name=bank_data["bank_name"],
            account_name=org_data["legal_name"],
            ach_routing=bank_data.get("ach_routing") if rail == "ACH" else None,
            ach_account=bank_data.get("account_number") if rail == "ACH" else None,
            wire_routing=bank_data.get("wire_routing") if rail == "WIRE_DOM" else None,
            wire_account=bank_data.get("account_number") if rail == "WIRE_DOM" else None,
            bank_address=None,
            swift_bic=bank_data.get("swift") if rail == "SWIFT" else None,
            iban=bank_data.get("account_number") if rail == "SWIFT" else None,
            bank_country=None,
            bank_city=None,
            status="active",
            conn=conn,
            commit=False,
        )

        set_onboarding_payment_account(
            session_id=session_id,
            payment_account_id=payment_account_id,
            conn=conn,
            commit=False,
        )

        upi = None
        if pending_call:
            set_organization_verification_status(
                str(org_id),
                verification_status="pending_call",
                status="pending_call",
                conn=conn,
                commit=False,
            )
            advance_onboarding_session(
                session_id=session_id,
                state="PENDING_CALL",
                next_step=5,
                conn=conn,
                commit=False,
            )
        else:
            if not master_upi:
                raise RuntimeError("Missing master UPI for user.")
            core_id = generate_core_entity_id()
            upi = generate_upi(core_id, payment_index=payment_index, user_id=user_id)
            set_organization_upi(
                str(org_id),
                upi,
                payment_account_id,
                verification_status="verified",
                status="active",
                conn=conn,
                commit=False,
            )
            advance_onboarding_session(
                session_id=session_id,
                state="VERIFIED",
                next_step=5,
                conn=conn,
                commit=False,
            )

    return {
        "org_id": str(org_id),
        "session_id": str(session_id),
        "upi": upi,
        "payment_account_id": payment_account_id,
        "status": "PENDING_CALL" if pending_call else "VERIFIED",
    }


def complete_onboarding_and_issue_identifier(session_id: uuid.UUID) -> str:
    """
    Mark onboarding VERIFIED and issue a business UPI for the org.

    Refactored: one UPI per org, payment account created in Step 4.
    """
    session = get_onboarding_session_by_id(session_id)
    if not session:
        raise RuntimeError("Onboarding session not found.")

    org = get_organization(session["org_id"], int(session["user_id"]))
    if not org:
        raise RuntimeError("Organization not found.")

    payment_account_id = get_onboarding_payment_account(uuid.UUID(str(session["id"])))
    if not payment_account_id:
        raise RuntimeError("Payment account missing for onboarding session.")

    account = get_payment_account_by_id(payment_account_id)
    if not account:
        raise RuntimeError("Payment account not found.")
    if str(account.get("org_id")) != str(org["id"]):
        raise RuntimeError("Payment account does not belong to this organization.")

    payment_index = int(account.get("payment_index", 1) or 1)
    core_id = generate_core_entity_id()
    owner_user_id = int(org.get("user_id") or session["user_id"])
    user = get_user_by_id(owner_user_id) or {}
    parent_upi = user.get("master_upi") or ""
    if not parent_upi:
        raise RuntimeError("Missing master UPI for user.")

    upi = generate_upi(core_id, payment_index, user_id=owner_user_id)

    set_organization_upi(str(org["id"]), upi, payment_account_id, verification_status="verified", status="active")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update onboarding_sessions set state='VERIFIED', completed_at=now(), last_saved_at=now() where id=%s",
                (str(session_id),),
            )
            conn.commit()

    return upi


def is_user_verified(user_id: int) -> bool:
    """
    MVP definition of a verified user:
    - has at least one onboarding session that reached VERIFIED.
    """
    if not _table_exists("onboarding_sessions"):
        return False
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select 1 from onboarding_sessions where user_id = %s and state = 'VERIFIED' limit 1",
                (user_id,),
            )
            return cur.fetchone() is not None
