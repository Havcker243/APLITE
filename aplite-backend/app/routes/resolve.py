from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.db import queries
from app.routes.auth import get_current_user
from app.utils.upi import parse_upi, validate_upi_format, verify_upi

router = APIRouter()


class ResolveUPIRequest(BaseModel):
    upi: str
    rail: Literal["ACH", "WIRE_DOM", "SWIFT"]


@router.post("/api/resolve")
def resolve_upi(payload: ResolveUPIRequest, user=Depends(get_current_user)):
    """Resolve a UPI (owned by the caller) into payout coordinates for the requested rail."""
    upi_value = payload.upi.upper()

    if not validate_upi_format(upi_value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid UPI format")

    try:
        parsed = parse_upi(upi_value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    org = queries.get_organization_by_upi(upi_value)
    if not org or org.get("status") == "deactivated":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPI not found")

    if int(org.get("user_id", -1)) != int(user["id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this UPI.")

    owner = queries.get_user_by_id(org.get("user_id")) or user
    if not queries.is_user_verified(int(owner.get("id", 0))):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Recipient account is not verified.")

    if not verify_upi(upi_value, int(owner["id"])):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPI not found")

    account = queries.get_payment_account_by_org_and_index(str(org["id"]), parsed.payment_index, payload.rail)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment details not found for this rail")

    if payload.rail == "ACH":
        coordinates = {
            "routing_number": account.get("ach_routing"),
            "account_number": account.get("ach_account"),
            "bank_name": account.get("bank_name"),
        }
    elif payload.rail == "WIRE_DOM":
        coordinates = {
            "routing_number": account.get("wire_routing"),
            "account_number": account.get("wire_account"),
            "bank_name": account.get("bank_name"),
            "bank_address": account.get("bank_address") or "",
        }
    else:
        coordinates = {
            "swift_bic": account.get("swift_bic"),
            "iban": account.get("iban"),
            "bank_name": account.get("bank_name"),
            "bank_address": account.get("bank_address") or "",
            "bank_country": account.get("bank_country"),
            "bank_city": account.get("bank_city"),
        }

    business = {
        "legal_name": org.get("legal_name") or "",
        # Country is stored inside the onboarding address blob; fall back to user country.
        "country": (org.get("address") or {}).get("country") or owner.get("country") or "",
    }

    return {
        "upi": upi_value,
        "rail": payload.rail,
        "business": business,
        "profile": {
            "company_name": owner.get("company_name") or owner.get("company"),
            "summary": owner.get("summary") or "",
            "established_year": owner.get("established_year"),
            "state": owner.get("state"),
            "country": owner.get("country"),
        },
        "coordinates": coordinates,
    }
