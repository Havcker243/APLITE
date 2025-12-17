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
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TypedDict

from app.db.connection import get_connection
from app.utils import crypto
from app.utils.email import send_email
from app.utils.upi import generate_core_entity_id, generate_upi


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
        with conn.cursor() as cur:
            cur.execute("update businesses set status = %s where id = %s returning *", (status, business_id))
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


def get_active_onboarding_session(user_id: int) -> Optional[OnboardingSessionRecord]:
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
) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
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


def create_onboarding_session(
    *,
    session_id: uuid.UUID,
    org_id: uuid.UUID,
    user_id: int,
    state: str,
    current_step: int,
    address_locked: bool,
) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into onboarding_sessions
                (id, org_id, user_id, state, current_step, address_locked, last_saved_at)
                values (%s,%s,%s,%s,%s,%s, now())
                """,
                (str(session_id), str(org_id), user_id, state, current_step, address_locked),
            )
            conn.commit()


def advance_onboarding_session(session_id: uuid.UUID, *, state: str, next_step: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update onboarding_sessions set state=%s, current_step=%s, last_saved_at=now() where id=%s",
                (state, next_step, str(session_id)),
            )
            conn.commit()


def update_onboarding_role(
    *,
    session_id: uuid.UUID,
    user_id: int,
    role: str,
    title: Optional[str],
    risk_level: str,
) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update onboarding_sessions set step_statuses = jsonb_set(coalesce(step_statuses,'{}'::jsonb), '{role}', %s::jsonb, true), risk_level=%s, last_saved_at=now() where id=%s and user_id=%s",
                (json.dumps({"role": role, "title": title}), risk_level, str(session_id), user_id),
            )
            conn.commit()


def store_onboarding_file(*, file_id: str, filename: str, content_type: str, data: bytes, user_id: int) -> None:
    base = os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads")
    os.makedirs(base, exist_ok=True)
    meta_path = os.path.join(base, f"{file_id}.json")
    bin_path = os.path.join(base, f"{file_id}.bin")
    with open(bin_path, "wb") as f:
        f.write(data)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({"user_id": user_id, "filename": filename, "content_type": content_type}, f)


def onboarding_file_exists(*, file_id: str, user_id: int) -> bool:
    base = os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads")
    meta_path = os.path.join(base, f"{file_id}.json")
    if not os.path.exists(meta_path):
        return False
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        return int(meta.get("user_id", -1)) == int(user_id)
    except Exception:
        return False


def create_identity_verification(
    *,
    verification_id: uuid.UUID,
    session_id: uuid.UUID,
    org_id: uuid.UUID,
    user_id: int,
    full_name: str,
    title: Optional[str],
    id_document_id: str,
    attestation: bool,
    status: str,
) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into identity_verifications
                (id, session_id, org_id, user_id, full_name, title, id_document_id, attestation, status, created_at)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
                """,
                (str(verification_id), str(session_id), str(org_id), user_id, full_name, title, id_document_id, attestation, status),
            )
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
    otp_id = uuid.uuid4().hex
    # 6 digit code
    code = f"{int.from_bytes(os.urandom(2), 'big') % 1000000:06d}"
    expires_at = datetime.now(timezone.utc) + ttl
    create_otp(otp_id, user_id=user_id, code=code, expires_at=expires_at)
    return otp_id, code


def verify_otp(*, otp_id: str, code: str) -> bool:
    record = get_otp(otp_id)
    if not record:
        return False
    if record.get("consumed"):
        return False
    try:
        expires_at = datetime.fromisoformat(record["expires_at"])
    except Exception:
        return False
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


def complete_onboarding_and_issue_identifier(session_id: uuid.UUID) -> str:
    """
    Mark onboarding VERIFIED and issue a business UPI for the org.

    MVP behavior:
    - chooses one rail in priority order: ACH -> WIRE_DOM -> SWIFT
    - creates a payment_account row (encrypted coordinates)
    - creates a businesses row and returns the new upi
    """
    session = get_onboarding_session_by_id(session_id)
    if not session:
        raise RuntimeError("Onboarding session not found.")

    org = get_organization(session["org_id"], int(session["user_id"]))
    if not org:
        raise RuntimeError("Organization not found.")

    # Fetch latest bank mapping
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select * from bank_rail_mappings where session_id = %s order by created_at desc limit 1",
                (str(session_id),),
            )
            bank = cur.fetchone()

    if not bank:
        raise RuntimeError("Bank mapping missing.")

    rail = "ACH" if bank.get("ach_routing") else ("WIRE_DOM" if bank.get("wire_routing") else "SWIFT")

    # Decrypt account number just-in-time to populate payment_accounts enc structure.
    enc = bank.get("account_number_enc") or {}
    account_number = None
    try:
        account_number = crypto.decrypt_value(enc["n"], enc["c"])
    except Exception:
        account_number = None
    if not account_number:
        raise RuntimeError("Unable to read bank account number.")

    bank_address = ""
    try:
        addr = org.get("address") or {}
        bank_address = ", ".join(filter(None, [addr.get("street1"), addr.get("city"), addr.get("state"), addr.get("zip")]))
    except Exception:
        bank_address = ""

    payment_account_id = create_payment_account(
        user_id=int(session["user_id"]),
        business_id=None,
        rail=rail,
        bank_name=bank.get("bank_name") or "",
        account_name=org.get("legal_name") or "Account",
        ach_routing=bank.get("ach_routing") if rail == "ACH" else None,
        ach_account=account_number if rail == "ACH" else None,
        wire_routing=bank.get("wire_routing") if rail == "WIRE_DOM" else None,
        wire_account=account_number if rail == "WIRE_DOM" else None,
        bank_address=bank_address or None,
        swift_bic=bank.get("swift") if rail == "SWIFT" else None,
        iban=account_number if rail == "SWIFT" else None,
        bank_country=None,
        bank_city=None,
    )

    core_id = generate_core_entity_id()
    user = get_user_by_id(int(session["user_id"])) or {}
    parent_upi = user.get("master_upi") or ""
    if not parent_upi:
        raise RuntimeError("Missing master UPI for user.")

    # Align payment_index with the created payment account (so resolve matches PI embedded in UPI).
    account = get_payment_account_by_id(payment_account_id) or {}
    payment_index = int(account.get("payment_index", 1) or 1)

    upi = generate_upi(core_id, payment_index, user_id=int(session["user_id"]))

    create_business(
        user_id=int(session["user_id"]),
        parent_upi=parent_upi,
        upi=upi,
        payment_account_id=payment_account_id,
        rails=[rail],
        core_entity_id=core_id,
        legal_name=org.get("legal_name") or "",
        ein=org.get("ein") or "",
        business_type=org.get("entity_type") or "",
        website=org.get("website"),
        address=bank_address or "",
        country="US",
        verification_status="verified",
        status="active",
    )
    update_payment_account(payment_account_id, business_id=get_business_by_upi(upi)["id"])

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("update organizations set issued_upi=%s, updated_at=now() where id=%s", (upi, org["id"]))
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
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select 1 from onboarding_sessions where user_id = %s and state = 'VERIFIED' limit 1",
                (user_id,),
            )
            return cur.fetchone() is not None
