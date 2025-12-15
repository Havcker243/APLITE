"""
JSON-backed data helpers for the onboarding service.

Stores business and payment account data inside data/store.json so that
records persist across restarts.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "store.json"

DEFAULT_DATA = {
    "users": [],
    "sessions": [],
    "businesses": [],
    "payment_accounts": [],
    "user_pk": 0,
    "business_pk": 0,
    "payment_account_pk": 0,
}


class BusinessRecord(TypedDict, total=False):
    id: int
    user_id: int
    parent_upi: str
    upi: str
    core_entity_id: str
    legal_name: str
    ein: str
    business_type: str
    website: Optional[str]
    address: str
    country: str
    verification_status: str
    created_at: str


class PaymentAccountRecord(TypedDict, total=False):
    id: int
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


class UserRecord(TypedDict, total=False):
    id: int
    first_name: str
    last_name: str
    email: str
    company: str
    password_hash: str
    master_upi: str
    created_at: str


class SessionRecord(TypedDict, total=False):
    token: str
    user_id: int
    created_at: str


def _ensure_store() -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        _save_data(DEFAULT_DATA.copy())


def _load_data() -> Dict[str, Any]:
    _ensure_store()
    try:
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        # Backfill defaults to keep older store.json files compatible.
        for key, value in DEFAULT_DATA.items():
            data.setdefault(key, value if not isinstance(value, dict | list) else value.copy())
        return data
    except json.JSONDecodeError:
        _save_data(DEFAULT_DATA.copy())
        return DEFAULT_DATA.copy()


def _save_data(data: Dict[str, Any]) -> None:
    DATA_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _next_id(data: Dict[str, Any], key: str) -> int:
    data[key] = int(data.get(key, 0)) + 1
    return data[key]


def create_business(**payload: Any) -> int:
    """Persist a business row and return its ID."""
    data = _load_data()
    record: BusinessRecord = {
        "id": _next_id(data, "business_pk"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    }
    data["businesses"].append(record)  # type: ignore[arg-type]
    _save_data(data)
    return record["id"]


def create_payment_account(**payload: Any) -> int:
    """Persist a payment account row and return its ID."""
    data = _load_data()
    record: PaymentAccountRecord = {
        "id": _next_id(data, "payment_account_pk"),
        **payload,
    }
    data["payment_accounts"].append(record)  # type: ignore[arg-type]
    _save_data(data)
    return record["id"]


def list_businesses() -> List[BusinessRecord]:
    data = _load_data()
    return sorted(data.get("businesses", []), key=lambda row: row["id"], reverse=True)


def list_businesses_for_user(user_id: int) -> List[BusinessRecord]:
    return [row for row in list_businesses() if row.get("user_id") == user_id]


def get_business_by_upi(upi: str) -> Optional[BusinessRecord]:
    return next((row for row in list_businesses() if row["upi"] == upi), None)


def get_user_business_by_upi(user_id: int, upi: str) -> Optional[BusinessRecord]:
    return next((row for row in list_businesses_for_user(user_id) if row["upi"] == upi), None)


def get_business_by_ein(ein: str) -> Optional[BusinessRecord]:
    return next((row for row in list_businesses() if row["ein"] == ein), None)


def get_user_business_by_ein(user_id: int, ein: str) -> Optional[BusinessRecord]:
    return next((row for row in list_businesses_for_user(user_id) if row["ein"] == ein), None)


def get_business_by_core_entity_id(core_entity_id: str) -> Optional[BusinessRecord]:
    return next((row for row in list_businesses() if row["core_entity_id"] == core_entity_id), None)


def get_payment_account(
    *, business_id: int, payment_index: int, rail: str
) -> Optional[PaymentAccountRecord]:
    data = _load_data()
    return next(
        (
            row
            for row in data.get("payment_accounts", [])
            if row["business_id"] == business_id
            and row["payment_index"] == payment_index
            and row["rail"] == rail
        ),
        None,
    )


def create_user(**payload: Any) -> int:
    """Persist a user row and return its ID."""
    data = _load_data()
    record: UserRecord = {
        "id": _next_id(data, "user_pk"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    }
    data["users"].append(record)  # type: ignore[arg-type]
    _save_data(data)
    return record["id"]


def get_user_by_email(email: str) -> Optional[UserRecord]:
    data = _load_data()
    return next((row for row in data.get("users", []) if row.get("email") == email), None)


def get_user_by_id(user_id: int) -> Optional[UserRecord]:
    data = _load_data()
    return next((row for row in data.get("users", []) if row.get("id") == user_id), None)


def create_session(token: str, user_id: int) -> None:
    data = _load_data()
    record: SessionRecord = {
        "token": token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    data.setdefault("sessions", []).append(record)  # type: ignore[arg-type]
    _save_data(data)


def get_session(token: str) -> Optional[SessionRecord]:
    data = _load_data()
    return next((row for row in data.get("sessions", []) if row.get("token") == token), None)
