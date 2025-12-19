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
    # Org-centric: one UPI per org; treat this endpoint as "issue org UPI".
    if not queries.is_user_verified(user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account must be verified before issuing UPIs.",
        )

    orgs = queries.list_organizations_for_user(user["id"])
    if not orgs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No organization found.")
    org = orgs[0]

    if org.get("upi"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="UPI already issued for this organization.")

    if not payload.account:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide payment details to issue a UPI.")

    acct = payload.account
    if acct.rail == "ACH" and (not acct.ach_routing or not acct.ach_account):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ACH accounts require routing and account numbers.")
    if acct.rail == "WIRE_DOM" and (not acct.wire_routing or not acct.wire_account):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Wire accounts require routing and account numbers.")
    if acct.rail == "SWIFT" and (not acct.swift_bic or not acct.iban):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SWIFT accounts require BIC and IBAN.")

    try:
        core_id = generate_core_entity_id()
        payment_account_id = queries.create_payment_account(
            user_id=user["id"],
            org_id=str(org["id"]),
            rail=acct.rail,
            bank_name=acct.bank_name,
            account_name=acct.account_name or acct.bank_name,
            ach_routing=acct.ach_routing,
            ach_account=acct.ach_account,
            wire_routing=acct.wire_routing,
            wire_account=acct.wire_account,
            bank_address=acct.bank_address or payload.address,
            swift_bic=acct.swift_bic,
            iban=acct.iban,
            bank_country=acct.bank_country or payload.country,
            bank_city=acct.bank_city,
            status="active",
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to create payment account") from exc

    account = queries.get_payment_account_by_id(payment_account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to create account")

    payment_index = int(account.get("payment_index", 1) or 1)
    try:
        upi = generate_upi(core_id, payment_index, user_id=user["id"])
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to generate UPI") from exc

    queries.set_organization_upi(str(org["id"]), upi, payment_account_id, verification_status="verified", status="active")

    # Persist a business row for history/lookup parity with list/deactivate endpoints.
    try:
        business_id = queries.create_business(
            user_id=user["id"],
            parent_upi=user.get("master_upi") or "",
            upi=upi,
            payment_account_id=payment_account_id,
            rails=[account["rail"]],
            core_entity_id=core_id,
            legal_name=payload.legal_name.strip(),
            ein=payload.ein.strip(),
            business_type=payload.business_type.strip(),
            website=(payload.website or "").strip() or None,
            address=payload.address.strip(),
            country=payload.country.strip(),
            verification_status="verified",
            status="active",
        )
        queries.update_payment_account(payment_account_id, business_id=business_id)
    except Exception as exc:
        # Do not fail the request after issuing UPI; log upstream (FastAPI will log).
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to persist business record") from exc

    return {"upi": upi, "verification_status": "verified", "rails": [account["rail"]], "business_id": business_id}


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
    before_id: int | None = Query(default=None, ge=1),
    user=Depends(get_current_user),
) -> list[BusinessSummary]:
    rows = queries.list_businesses_for_user(user["id"], limit=limit, before_id=before_id)
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
