from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Literal, Optional

from app.db import queries
from app.routes.auth import get_current_user

router = APIRouter()


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


@router.get("/api/accounts")
def list_accounts(user=Depends(get_current_user)):
    return queries.list_payment_accounts_for_owner(user["id"])


@router.post("/api/accounts", status_code=status.HTTP_201_CREATED)
def create_account(payload: AccountCreateRequest, user=Depends(get_current_user)):
    if not queries.is_user_verified(user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account must be verified before adding payout rails.",
        )

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
    return account
