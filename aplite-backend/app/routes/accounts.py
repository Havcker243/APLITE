"""Payment account management routes.

Provides list, create, and update endpoints for payment accounts associated
with organizations and users. Sensitive rail fields are validated and locked
once linked to a UPI.
"""

import logging
import os
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from typing import Literal

from app.db import queries
from app.routes.auth import get_current_user
from app.utils.ratelimit import RateLimit, check_rate_limit

router = APIRouter()
logger = logging.getLogger("aplite")


class AccountCreateRequest(BaseModel):
    rail: Literal["ACH", "WIRE_DOM", "SWIFT"]
    bank_name: str
    account_name: Optional[str] = None
    ach_routing: Optional[str] = None
    ach_account: Optional[str] = None
    wire_routing: Optional[str] = None
    wire_account: Optional[str] = None
    bank_address: Optional[str] = None
    swift_bic: Optional[str] = None
    iban: Optional[str] = None
    bank_country: Optional[str] = None
    bank_city: Optional[str] = None


class AccountUpdateRequest(BaseModel):
    bank_name: Optional[str] = None
    account_name: Optional[str] = None
    ach_routing: Optional[str] = None
    ach_account: Optional[str] = None
    wire_routing: Optional[str] = None
    wire_account: Optional[str] = None
    bank_address: Optional[str] = None
    swift_bic: Optional[str] = None
    iban: Optional[str] = None
    bank_country: Optional[str] = None
    bank_city: Optional[str] = None


def _validate_rail_updates(rail: str, fields: dict) -> None:
    # Shared validation for updates; keeps update rules consistent with create flow.
    if rail == "ACH":
        if "ach_routing" in fields and fields["ach_routing"] and not fields["ach_routing"].isdigit():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ACH routing must be numeric.")
        if "ach_routing" in fields and fields["ach_routing"] and len(fields["ach_routing"]) != 9:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ACH routing must be 9 digits.")
        if "ach_account" in fields and fields["ach_account"] and not fields["ach_account"].isdigit():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ACH account must be numeric.")
    if rail == "WIRE_DOM":
        if "wire_routing" in fields and fields["wire_routing"] and not fields["wire_routing"].isdigit():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Wire routing must be numeric.")
        if "wire_routing" in fields and fields["wire_routing"] and len(fields["wire_routing"]) < 6:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Wire routing should be at least 6 digits.")
        if "wire_account" in fields and fields["wire_account"] and not fields["wire_account"].isdigit():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Wire account must be numeric.")
    if rail == "SWIFT":
        if "swift_bic" in fields and fields["swift_bic"]:
            value = str(fields["swift_bic"]).replace(" ", "").upper()
            if not re.match(r"^[A-Z0-9]{8}([A-Z0-9]{3})?$", value):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SWIFT/BIC must be 8 or 11 alphanumeric characters.")
            fields["swift_bic"] = value
        if "iban" in fields and fields["iban"]:
            fields["iban"] = str(fields["iban"]).replace(" ", "").upper()


def _org_upi_uses_account(account: dict) -> bool:
    return queries.payment_account_used_for_org_upi(account)


def _enforce_rate_limit(request: Request, *, key: str, limit: int, window_seconds: int, user_id: int | None = None) -> None:
    if limit <= 0:
        return
    ip = (request.client.host if request.client else "unknown").strip()
    # Rate limit keyed by IP + user to reduce accidental throttling across shared networks.
    suffix = f"{ip}:{user_id}" if user_id is not None else ip
    ok, retry_after = check_rate_limit(f"{key}:{suffix}", RateLimit(limit=limit, window_seconds=window_seconds))
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Try again soon.",
            headers={"Retry-After": str(retry_after)},
        )


@router.get("/api/accounts")
def list_accounts(user=Depends(get_current_user)):
    # Include a derived `rail_locked` flag so the UI can disable immutable fields.
    accounts = queries.list_payment_accounts_for_owner(user["id"])
    for acct in accounts:
        acct["rail_locked"] = queries.payment_account_has_child_upis(int(acct.get("id", 0))) or _org_upi_uses_account(acct)
    logger.info("accounts list fetched", extra={"user_id": user.get("id"), "count": len(accounts)})
    return accounts


@router.post("/api/accounts", status_code=status.HTTP_201_CREATED)
def create_account(payload: AccountCreateRequest, request: Request, user=Depends(get_current_user)):
    _enforce_rate_limit(
        request,
        key="accounts_create",
        limit=int(os.getenv("RL_ACCOUNTS_CREATE_LIMIT", "20")),
        window_seconds=int(os.getenv("RL_ACCOUNTS_CREATE_WINDOW_SECONDS", "3600")),
        user_id=int(user.get("id", 0) or 0),
    )
    # Creating payout rails is restricted until onboarding verifies the user/org.
    if not queries.is_user_verified(user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account must be verified before adding payout rails.",
        )

    # MVP: user owns a single org; first record is used as the parent.
    orgs = queries.list_organizations_for_user(user["id"])
    if not orgs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No organization found for this user.")
    org = orgs[0]

    try:
        account_id = queries.create_payment_account(
            user_id=user["id"],
            org_id=str(org["id"]),
            rail=payload.rail,
            bank_name=payload.bank_name,
            account_name=payload.account_name or f"{payload.bank_name} account",
            ach_routing=payload.ach_routing,
            ach_account=payload.ach_account,
            wire_routing=payload.wire_routing,
            wire_account=payload.wire_account,
            bank_address=payload.bank_address,
            swift_bic=payload.swift_bic,
            iban=payload.iban,
            bank_country=payload.bank_country,
            bank_city=payload.bank_city,
            status="active",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    account = queries.get_payment_account_by_id(account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to create account")
    account["rail_locked"] = False
    return account


@router.put("/api/accounts/{account_id}")
def update_account(account_id: int, payload: AccountUpdateRequest, user=Depends(get_current_user)):
    # Allow cosmetic edits anytime; block rail edits once the account backs a UPI.
    account = queries.get_payment_account_by_id(int(account_id))
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    org = queries.get_organization(str(account.get("org_id")), user["id"])
    if not org and int(account.get("user_id") or 0) != int(user["id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to edit this account")

    # Rail fields are immutable after an account backs a UPI.
    rail_locked = queries.payment_account_has_child_upis(int(account_id)) or _org_upi_uses_account(account)
    rail_fields = {
        "ach_routing",
        "ach_account",
        "wire_routing",
        "wire_account",
        "bank_address",
        "swift_bic",
        "iban",
        "bank_country",
        "bank_city",
    }
    payload_fields = {k: v for k, v in payload.model_dump().items() if v is not None and v != ""}

    if rail_locked and any(field in payload_fields for field in rail_fields):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account is linked to a UPI. Create a new account to change rail details.",
        )

    if not payload_fields:
        account["rail_locked"] = rail_locked
        return account

    _validate_rail_updates(str(account.get("rail") or ""), payload_fields)

    updated = queries.update_payment_account_details(
        account_id=int(account_id),
        user_id=user["id"],
        bank_name=payload_fields.get("bank_name"),
        account_name=payload_fields.get("account_name"),
        ach_routing=payload_fields.get("ach_routing"),
        ach_account=payload_fields.get("ach_account"),
        wire_routing=payload_fields.get("wire_routing"),
        wire_account=payload_fields.get("wire_account"),
        bank_address=payload_fields.get("bank_address"),
        swift_bic=payload_fields.get("swift_bic"),
        iban=payload_fields.get("iban"),
        bank_country=payload_fields.get("bank_country"),
        bank_city=payload_fields.get("bank_city"),
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to update account")
    updated["rail_locked"] = rail_locked
    return updated
