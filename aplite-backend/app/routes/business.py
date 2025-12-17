from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db import queries
from app.routes.auth import get_current_user
from app.utils.upi import generate_core_entity_id, generate_upi
from pydantic import BaseModel
from datetime import datetime
from typing import Literal


router = APIRouter()


class PaymentAccountPayload(BaseModel):
    rail: Literal["ACH", "WIRE_DOM", "SWIFT"]
    bank_name: str
    account_name: str | None = None
    ach_routing: str | None = None
    ach_account: str | None = None
    wire_routing: str | None = None
    wire_account: str | None = None
    bank_address: str | None = None
    swift_bic: str | None = None
    iban: str | None = None
    bank_country: str | None = None
    bank_city: str | None = None


class BusinessCreateRequest(BaseModel):
    legal_name: str
    ein: str
    business_type: str
    website: str | None = None
    address: str
    country: str

    payment_account_id: int | None = None
    account: PaymentAccountPayload | None = None


class BusinessSummary(BaseModel):
    id: int
    upi: str
    legal_name: str
    rails: list[str]
    verification_status: str
    created_at: datetime | str
    status: str


@router.post("/api/businesses")
def create_business(payload: BusinessCreateRequest, user=Depends(get_current_user)):
    if not queries.is_user_verified(user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account must be verified before issuing UPIs.",
        )
    if not payload.payment_account_id and not payload.account:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select an existing account or provide new payment details.",
        )

    verification_status = "verified"

    existing_account = None
    account_id = None

    if payload.payment_account_id:
        existing_account = queries.get_payment_account_by_id(payload.payment_account_id)
        if not existing_account or existing_account.get("user_id") != user["id"]:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment account not found")
        account_id = existing_account["id"]

    if payload.account and not existing_account:
        # basic rail-specific validation
        if payload.account.rail == "ACH" and (not payload.account.ach_routing or not payload.account.ach_account):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ACH accounts require routing and account numbers.",
            )
        if payload.account.rail == "WIRE_DOM" and (not payload.account.wire_routing or not payload.account.wire_account):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wire accounts require routing and account numbers.",
            )
        if payload.account.rail == "SWIFT" and (not payload.account.swift_bic or not payload.account.iban):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SWIFT accounts require BIC and IBAN.",
            )
        try:
            account_id = queries.create_payment_account(
                user_id=user["id"],
                business_id=None,
                rail=payload.account.rail,
                bank_name=payload.account.bank_name,
                account_name=payload.account.account_name or payload.legal_name,
                ach_routing=payload.account.ach_routing,
                ach_account=payload.account.ach_account,
                wire_routing=payload.account.wire_routing,
                wire_account=payload.account.wire_account,
                bank_address=payload.account.bank_address or payload.address,
                swift_bic=payload.account.swift_bic,
                iban=payload.account.iban,
                bank_country=payload.account.bank_country or payload.country,
                bank_city=payload.account.bank_city,
            )
            existing_account = queries.get_payment_account_by_id(account_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to create payment account",
            ) from exc

    if not existing_account:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment account missing")

    payment_index = int(existing_account.get("payment_index", 1) or 1)
    core_id = generate_core_entity_id()
    try:
        upi = generate_upi(core_id, payment_index, user_id=user["id"])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate UPI. Check server secret configuration.",
        ) from exc

    if queries.get_business_by_upi(upi):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="UPI already exists. Please retry onboarding.",
        )

    if queries.get_user_business_by_ein(user["id"], payload.ein):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Business with this EIN already exists.",
        )

    try:
        business_id = queries.create_business(
            user_id=user["id"],
            parent_upi=user["master_upi"],
            upi=upi,
            payment_account_id=account_id,
            rails=[existing_account["rail"]],
            core_entity_id=core_id,
            legal_name=payload.legal_name,
            ein=payload.ein,
            business_type=payload.business_type,
            website=payload.website,
            address=payload.address,
            country=payload.country,
            verification_status=verification_status,
        )
        queries.update_payment_account(account_id, business_id=business_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create business at this time.",
        ) from exc

    return {"upi": upi, "verification_status": verification_status, "rails": [existing_account["rail"]]}


@router.post("/api/businesses/{business_id}/deactivate")
def deactivate_business(business_id: int, user=Depends(get_current_user)):
    business = queries.get_business_by_id(business_id)
    if not business or business.get("user_id") != user["id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    if business.get("status") == "deactivated":
        return {"status": "already_deactivated"}

    updated = queries.update_business_status(business_id, status="deactivated")
    if not updated:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to deactivate business")
    return {"status": "deactivated"}


@router.get("/api/businesses")
def list_businesses(
    limit: int | None = Query(default=None, ge=1, le=200),
    user=Depends(get_current_user),
) -> list[BusinessSummary]:
    rows = queries.list_businesses_for_user(user["id"])
    if limit:
        rows = rows[:limit]
    return [
        BusinessSummary(
            id=row["id"],
            upi=row["upi"],
            legal_name=row["legal_name"],
            rails=row.get("rails", []) or [],
            verification_status=row["verification_status"],
            created_at=row.get("created_at") or "",
            status=row.get("status", "active"),
        )
        for row in rows
    ]
