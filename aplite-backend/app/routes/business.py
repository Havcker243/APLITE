from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db import queries
from app.routes.auth import get_current_user
from app.utils.upi import generate_core_entity_id, generate_upi
from pydantic import BaseModel


router = APIRouter()


class BusinessCreateRequest(BaseModel):
    legal_name: str
    ein: str
    business_type: str
    website: str | None = None
    address: str
    country: str

    bank_name: str
    ach_routing: str
    ach_account: str
    wire_routing: str
    wire_account: str


class BusinessSummary(BaseModel):
    id: int
    upi: str
    legal_name: str
    verification_status: str
    created_at: str


@router.post("/api/businesses")
async def create_business(payload: BusinessCreateRequest, user=Depends(get_current_user)):
    payment_index = 1
    verification_status = "verified"
    core_id = generate_core_entity_id()
    upi = generate_upi(core_id, payment_index)

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
            core_entity_id=core_id,
            legal_name=payload.legal_name,
            ein=payload.ein,
            business_type=payload.business_type,
            website=payload.website,
            address=payload.address,
            country=payload.country,
            verification_status=verification_status,
        )

        queries.create_payment_account(
            business_id=business_id,
            payment_index=payment_index,
            rail="ACH",
            ach_routing=payload.ach_routing,
            ach_account=payload.ach_account,
            bank_name=payload.bank_name,
            account_name=payload.legal_name,
        )

        queries.create_payment_account(
            business_id=business_id,
            payment_index=payment_index,
            rail="WIRE_DOM",
            wire_routing=payload.wire_routing,
            wire_account=payload.wire_account,
            bank_name=payload.bank_name,
            account_name=payload.legal_name,
            bank_address=payload.address,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create business at this time.",
        ) from exc

    return {"upi": upi, "verification_status": verification_status}


@router.get("/api/businesses")
async def list_businesses(
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
            verification_status=row["verification_status"],
            created_at=row.get("created_at", ""),
        )
        for row in rows
    ]
