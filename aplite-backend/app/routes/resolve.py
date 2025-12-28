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


class LookupUPIRequest(BaseModel):
    upi: str


@router.get("/api/upi/master")
def lookup_master_upi(upi: str, user=Depends(get_current_user)):
    """
    Lookup a master UPI and return the owning profile + org list.

    Restricted to verified users to avoid broad enumeration.
    """
    upi_value = (upi or "").strip().upper()
    if not validate_upi_format(upi_value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid UPI format")
    if not queries.is_user_verified(int(user.get("id", 0) or 0)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification required")

    owner = queries.get_user_by_master_upi(upi_value)
    if not owner or (owner.get("master_upi") or "").upper() != upi_value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPI not found")

    orgs = queries.list_organizations_for_user(int(owner.get("id") or 0))
    return {
        "upi": upi_value,
        "owner": {
            "id": owner.get("id"),
            "company_name": owner.get("company_name") or owner.get("company"),
            "summary": owner.get("summary") or "",
            "established_year": owner.get("established_year"),
            "state": owner.get("state"),
            "country": owner.get("country"),
        },
        "organizations": [
            {
                "id": str(org.get("id")),
                "legal_name": org.get("legal_name") or "",
                "upi": org.get("upi"),
                "verification_status": org.get("verification_status"),
                "status": org.get("status"),
            }
            for org in orgs
        ],
    }


@router.post("/api/upi/lookup")
def lookup_upi(payload: LookupUPIRequest, user=Depends(get_current_user)):
    """Return the org + public profile for a verified UPI (exact match only)."""
    # Lookup is read-only and returns public profile + org metadata.
    upi_value = payload.upi.upper()

    if not validate_upi_format(upi_value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid UPI format")

    org = None
    child_upi = queries.get_child_upi_by_value(upi_value)
    if child_upi:
        if child_upi.get("status") != "active":
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="UPI is disabled")
        org = queries.get_organization_by_id(str(child_upi.get("org_id")))
    else:
        org = queries.get_organization_by_upi(upi_value)

    if not org or org.get("status") == "deactivated":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPI not found")
    if str(org.get("verification_status") or "").lower() != "verified":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPI not found")

    owner = queries.get_user_by_id(org.get("user_id")) or user
    if not verify_upi(upi_value, int(owner.get("id", 0) or 0)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPI not found")

    return {
        "upi": upi_value,
        "org": {
            "id": str(org.get("id")),
            "legal_name": org.get("legal_name") or "",
            "dba": org.get("dba"),
            "ein": org.get("ein") or "",
            "formation_date": org.get("formation_date"),
            "formation_state": org.get("formation_state"),
            "entity_type": org.get("entity_type"),
            "address": org.get("address") or {},
            "industry": org.get("industry"),
            "website": org.get("website"),
            "description": org.get("description"),
            "verification_status": org.get("verification_status"),
            "status": org.get("status") or "",
            "created_at": org.get("created_at"),
            "updated_at": org.get("updated_at"),
        },
        "profile": {
            "company_name": owner.get("company_name") or owner.get("company"),
            "summary": owner.get("summary") or "",
            "established_year": owner.get("established_year"),
            "state": owner.get("state"),
            "country": owner.get("country"),
        },
    }


@router.post("/api/resolve")
def resolve_upi(payload: ResolveUPIRequest, user=Depends(get_current_user)):
    """Resolve a UPI (owned by the caller) into payout coordinates for the requested rail."""
    # Resolve returns payout coordinates only for verified, active UPIs.
    upi_value = payload.upi.upper()

    if not validate_upi_format(upi_value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid UPI format")

    child_upi = queries.get_child_upi_by_value(upi_value)
    if child_upi:
        if child_upi.get("status") != "active":
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="UPI is disabled")
        org = queries.get_organization_by_id(str(child_upi.get("org_id")))
        if not org:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPI not found")
        owner = queries.get_user_by_id(org.get("user_id")) or user
        if not queries.is_user_verified(int(owner.get("id", 0))):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Recipient account is not verified.")
        if not verify_upi(upi_value, int(owner["id"])):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPI not found")

        account = queries.get_payment_account_by_id(int(child_upi.get("payment_account_id")))
        if account is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment details not found for this rail")
        if account.get("rail") != payload.rail:
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

    try:
        parsed = parse_upi(upi_value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    org = queries.get_organization_by_upi(upi_value)
    if not org or org.get("status") == "deactivated":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPI not found")

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
