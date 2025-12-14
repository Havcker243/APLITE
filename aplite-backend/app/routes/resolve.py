from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.db import queries
from app.routes.auth import get_current_user
from app.utils.upi import parse_upi, validate_upi_format

router = APIRouter()


class ResolveUPIRequest(BaseModel):
    upi: str
    rail: Literal["ACH", "WIRE_DOM"]


@router.post("/api/resolve")
async def resolve_upi(payload: ResolveUPIRequest, user=Depends(get_current_user)):
    upi_value = payload.upi.upper()

    if not validate_upi_format(upi_value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid UPI format")

    try:
        parsed = parse_upi(upi_value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    business = queries.get_user_business_by_upi(user["id"], upi_value)
    if business is None or business["core_entity_id"] != parsed.core_entity_id:
        business = next(
            (row for row in queries.list_businesses_for_user(user["id"]) if row["core_entity_id"] == parsed.core_entity_id),
            None,
        )

    if business is None or business["upi"] != upi_value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPI not found")

    account = queries.get_payment_account(
        business_id=business["id"], payment_index=parsed.payment_index, rail=payload.rail
    )
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment details not found for this rail",
        )

    if payload.rail == "ACH":
        coordinates = {
            "routing_number": account.get("ach_routing"),
            "account_number": account.get("ach_account"),
            "bank_name": account.get("bank_name"),
        }
    else:
        coordinates = {
            "routing_number": account.get("wire_routing"),
            "account_number": account.get("wire_account"),
            "bank_name": account.get("bank_name"),
            "bank_address": account.get("bank_address") or "",
        }

    return {
        "upi": upi_value,
        "rail": payload.rail,
        "business": {"legal_name": business["legal_name"], "country": business["country"]},
        "coordinates": coordinates,
    }
