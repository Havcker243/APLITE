"""Authentication and profile-related routes.

Handles Supabase JWT validation and profile updates tied to the onboarding
flow. Auth validation is enforced here so downstream routes can trust the
active user context.
"""

from datetime import datetime
import uuid
import os
import logging

import jwt
from jwt import PyJWTError, PyJWKClient
from psycopg2.errors import UniqueViolation
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status, Query
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, EmailStr, Field

from app.db import queries
from app.utils.ratelimit import RateLimit, check_rate_limit
from app.utils.upi import generate_core_entity_id, generate_upi

router = APIRouter()
logger = logging.getLogger("aplite")


class ProfileUpdateRequest(BaseModel):
    company_name: str | None = None
    summary: str | None = None
    established_year: int | None = Field(default=None, ge=1800, le=datetime.now().year)
    state: str | None = None
    country: str | None = None


class OrgAddress(BaseModel):
    street1: str
    street2: str | None = None
    city: str
    state: str
    zip: str
    country: str


class OnboardingProfileUpdateRequest(BaseModel):
    dba: str | None = None
    address: OrgAddress | None = None
    industry: str | None = None
    website: str | None = None
    description: str | None = None


def _bearer_token_from_header(authorization: str | None) -> str | None:
    """Extract a bearer token from an Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return authorization.removeprefix("Bearer ").strip() or None


def _resolve_jwks_url() -> str:
    """Resolve the Supabase JWKS URL from env for token verification."""
    jwks_url = os.getenv("SUPABASE_JWKS_URL", "").strip()
    if jwks_url:
        return jwks_url
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    if supabase_url:
        return f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Supabase JWKS URL not configured")


def _resolve_issuer() -> str | None:
    """Resolve expected JWT issuer for Supabase tokens."""
    issuer = os.getenv("SUPABASE_ISSUER", "").strip()
    if issuer:
        return issuer
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    if supabase_url:
        return f"{supabase_url.rstrip('/')}/auth/v1"
    return None


def _decode_supabase_token(token: str) -> dict:
    """Validate and decode a Supabase JWT using the JWKS signer."""
    jwks_url = _resolve_jwks_url()
    issuer = _resolve_issuer()
    audience = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated").strip() or None
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")
        if alg not in ("ES256", "RS256"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unsupported token algorithm")
        jwk_client = PyJWKClient(jwks_url)
        signing_key = jwk_client.get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            signing_key,
            algorithms=[alg],
            audience=audience,
            issuer=issuer,
        )
    except PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


def _get_or_create_user_from_supabase(payload: dict) -> dict:
    """Lookup or create a local user record from Supabase claims."""
    email = (payload.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = queries.get_user_by_email(email)
    if user:
        return user

    metadata = payload.get("user_metadata") or {}
    first_name = (metadata.get("first_name") or metadata.get("firstName") or "").strip()
    last_name = (metadata.get("last_name") or metadata.get("lastName") or "").strip()
    if not first_name:
        first_name = (email.split("@")[0] or "User")[:80]
    if not last_name:
        last_name = ""

    core_id = generate_core_entity_id()
    user_id = queries.create_user(
        first_name=first_name,
        last_name=last_name,
        email=email,
        company="",
        company_name="",
        summary="",
        established_year=None,
        state=None,
        country=None,
        password_hash="",
        master_upi="",
    )
    master_upi = generate_upi(core_id, payment_index=0, user_id=user_id)
    queries.update_user_master_upi(user_id, master_upi)
    return queries.get_user_by_id(user_id) or {}


def _sanitize_user(user: dict) -> dict:
    """Remove sensitive fields before returning user data."""
    sanitized = dict(user)
    sanitized.pop("password_hash", None)
    return sanitized


def get_current_user(request: Request, authorization: str | None = Header(default=None)):
    """FastAPI dependency: authenticate the request and return the current user row."""
    token = _bearer_token_from_header(authorization)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token")
    payload = _decode_supabase_token(token)
    return _get_or_create_user_from_supabase(payload)


@router.get("/api/profile")
def get_profile(user=Depends(get_current_user)):
    """Return the current user's profile (sanitized)."""
    return _sanitize_user(user)


@router.get("/api/profile/details")
def get_profile_details(user=Depends(get_current_user)):
    """
    Return a richer profile snapshot for the UI.

    Includes:
    - `user`: account identity fields (read-only in MVP)
    - `onboarding`: latest onboarding session state (if any)
    - `organization`: onboarding business profile (if any)
    """
    latest_session = None
    org = None
    latest_review = None
    try:
        latest_session = queries.get_latest_onboarding_session(user["id"])
        if latest_session and latest_session.get("org_id"):
            org = queries.get_organization(str(latest_session["org_id"]), user["id"])
        if latest_session and latest_session.get("id"):
            latest_review = queries.get_latest_verification_review(uuid.UUID(str(latest_session["id"])))
    except Exception:
        # Keep profile page functional even if onboarding tables aren't present yet.
        latest_session = None
        org = None
        latest_review = None

    stats = queries.get_user_stats(user["id"])
    # Canonical onboarding status for the frontend guard.
    onboarding_status = str(latest_session.get("state")) if latest_session else "NOT_STARTED"
    return jsonable_encoder(
        {
            "user": _sanitize_user(user),
            "onboarding": latest_session,
            "organization": org,
            "stats": stats,
            "onboarding_status": onboarding_status,
            "verification_review": latest_review,
        }
    )


@router.put("/api/profile/onboarding")
def update_onboarding_profile(payload: OnboardingProfileUpdateRequest, user=Depends(get_current_user)):
    """
    Update onboarding/business profile fields shown on the Profile page.

    Rules (MVP):
    - If onboarding address is locked, address updates are rejected.
    - Other edits are allowed (dba/website/description/industry) for convenience.
    """
    latest_session = queries.get_latest_onboarding_session(user["id"])
    if not latest_session or not latest_session.get("org_id"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No onboarding profile found.")

    if payload.address is not None and bool(latest_session.get("address_locked", False)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Address is locked after onboarding Step 1.")

    updated = queries.update_organization_profile(
        org_id=str(latest_session["org_id"]),
        user_id=user["id"],
        dba=(payload.dba.strip() if payload.dba is not None else None),
        address=(payload.address.model_dump() if payload.address is not None else None),
        industry=(payload.industry.strip() if payload.industry is not None else None),
        website=(payload.website.strip() if payload.website is not None else None),
        description=(payload.description.strip() if payload.description is not None else None),
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Onboarding profile not found.")
    return jsonable_encoder(updated)


@router.put("/api/profile")
def update_profile(payload: ProfileUpdateRequest, user=Depends(get_current_user)):
    """Update editable profile fields shown in public directory and UPI resolves."""
    updated = queries.update_user_profile(
        user_id=user["id"],
        company_name=(payload.company_name or "").strip(),
        summary=(payload.summary or "").strip(),
        established_year=payload.established_year,
        state=(payload.state or "").strip() or None,
        country=(payload.country or "").strip() or None,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _sanitize_user(updated)


class ChildUpiRequest(BaseModel):
    name: str | None = None
    type: str
    website: str | None = None
    account_id: int | None = None
    rail: str | None = Field(default=None, pattern=r"^(ACH|WIRE_DOM|SWIFT)?$")
    bank_name: str | None = None
    account_name: str | None = None
    ach_routing: str | None = None
    ach_account: str | None = None
    wire_routing: str | None = None
    wire_account: str | None = None
    swift_bic: str | None = None
    iban: str | None = None
    bank_country: str | None = None
    bank_city: str | None = None
    bank_address: str | None = None


@router.post("/api/orgs/child-upi")
def create_child_upi(payload: ChildUpiRequest, request: Request, user=Depends(get_current_user)):
    """
    Issue a child/org UPI for the current user's verified org, using an existing or new payment account.
    """
    _limit = int(os.getenv("RL_CHILD_UPI_CREATE_LIMIT", "30"))
    _window = int(os.getenv("RL_CHILD_UPI_CREATE_WINDOW_SECONDS", "3600"))
    if _limit > 0:
        ip = (request.client.host if request.client else "unknown").strip()
        ok, retry = check_rate_limit(f"child_upi_create:{ip}:{user.get('id')}", RateLimit(limit=_limit, window_seconds=_window))
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Try again soon.",
                headers={"Retry-After": str(retry)},
            )
    safe_payload = payload.model_dump(
        exclude={
            "ach_account",
            "wire_account",
            "iban",
            "ach_routing",
            "wire_routing",
            "swift_bic",
            "bank_address",
        }
    )
    logger.info("child-upi request received", extra={"user_id": user.get("id"), "payload": safe_payload})
    latest_session = queries.get_latest_onboarding_session(user["id"])
    if not latest_session or str(latest_session.get("state")).upper() != "VERIFIED":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Complete onboarding first.")

    org_id = latest_session["org_id"]
    payment_account_id = None
    payment_index = 1
    if payload.account_id:
        acct = queries.get_payment_account_by_id(int(payload.account_id))
        if not acct or str(acct.get("org_id")) != str(org_id):
            logger.info(
                "child-upi invalid account",
                extra={"user_id": user.get("id"), "account_id": payload.account_id, "org_id": str(org_id)},
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment account.")
        payment_account_id = int(acct["id"])
        payment_index = int(acct.get("payment_index", 1) or 1)
    else:
        if not payload.rail or not payload.bank_name:
            logger.info(
                "child-upi missing rail or bank",
                extra={"user_id": user.get("id"), "rail": payload.rail, "bank_name": payload.bank_name},
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rail and bank name are required.")
        try:
            payment_account_id = queries.create_payment_account(
                user_id=user["id"],
                org_id=str(org_id),
                rail=payload.rail,
                bank_name=payload.bank_name.strip(),
                account_name=payload.account_name or payload.name or payload.bank_name,
                ach_routing=payload.ach_routing if payload.rail == "ACH" else None,
                ach_account=payload.ach_account if payload.rail == "ACH" else None,
                wire_routing=payload.wire_routing if payload.rail == "WIRE_DOM" else None,
                wire_account=payload.wire_account if payload.rail == "WIRE_DOM" else None,
                bank_address=payload.bank_address,
                swift_bic=payload.swift_bic if payload.rail == "SWIFT" else None,
                iban=payload.iban if payload.rail == "SWIFT" else None,
                bank_country=payload.bank_country,
                bank_city=payload.bank_city,
                status="active",
            )
        except Exception as exc:
            logger.exception("child-upi payment account create failed")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to create payment account") from exc
        acct = queries.get_payment_account_by_id(payment_account_id)
        if not acct:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to load payment account")
        payment_index = int(acct.get("payment_index", 1) or 1)

    child_upi_id = None
    upi = None
    label = payload.name.strip() if payload.name else None
    for _ in range(3):
        try:
            core_id = generate_core_entity_id()
            upi = generate_upi(core_id, payment_index, user_id=user["id"])
            child_upi_id = queries.create_child_upi(
                org_id=str(org_id),
                payment_account_id=int(payment_account_id),
                upi=upi,
                label=label,
            )
            break
        except UniqueViolation:
            upi = None
            child_upi_id = None
            continue
        except Exception as exc:
            logger.exception("child-upi upi generation failed")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to generate UPI") from exc

    if not upi or not child_upi_id:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to generate unique UPI")

    return {"child_upi_id": child_upi_id, "upi": upi, "payment_account_id": payment_account_id}


@router.get("/api/orgs/child-upis")
def list_child_upis(
    limit: int | None = Query(default=10, ge=1, le=200),
    before: str | None = Query(default=None),
    user=Depends(get_current_user),
):
    """
    List payment accounts/UPIs for the current user's verified org.
    """
    latest_session = queries.get_latest_onboarding_session(user["id"])
    if not latest_session or str(latest_session.get("state")).upper() != "VERIFIED":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Complete onboarding first.")
    org_id = latest_session["org_id"]
    before_dt = None
    if before:
        try:
            before_dt = datetime.fromisoformat(before)
        except Exception:
            before_dt = None
    rows = queries.list_child_upis_for_org(org_id, limit=limit, before=before_dt)
    results: list[dict] = []
    for row in rows:
        results.append(
            {
                "child_upi_id": row.get("child_upi_id"),
                "upi": row.get("upi") or "",
                "label": row.get("label"),
                "payment_account_id": row.get("payment_account_id"),
                "rail": row.get("rail", ""),
                "bank_name": row.get("bank_name"),
                "status": row.get("status"),
                "created_at": row.get("created_at").isoformat() if row.get("created_at") else "",
                "disabled_at": row.get("disabled_at").isoformat() if row.get("disabled_at") else "",
            }
        )
    return results


@router.post("/api/orgs/child-upis/{child_upi_id}/disable")
def disable_child_upi(child_upi_id: str, user=Depends(get_current_user)):
    """Disable a child UPI owned by the current user's org."""
    latest_session = queries.get_latest_onboarding_session(user["id"])
    if not latest_session or str(latest_session.get("state")).upper() != "VERIFIED":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Complete onboarding first.")
    org_id = latest_session["org_id"]
    record = queries.get_child_upi_by_id(child_upi_id)
    if not record or str(record.get("org_id")) != str(org_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPI not found")
    updated = queries.disable_child_upi(child_upi_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to disable UPI")
    return {
        "child_upi_id": str(updated.get("id")),
        "status": updated.get("status"),
        "disabled_at": updated.get("disabled_at").isoformat() if updated.get("disabled_at") else "",
    }


@router.post("/api/orgs/child-upis/{child_upi_id}/reactivate")
def reactivate_child_upi(child_upi_id: str, user=Depends(get_current_user)):
    """Reactivate a previously disabled child UPI."""
    latest_session = queries.get_latest_onboarding_session(user["id"])
    if not latest_session or str(latest_session.get("state")).upper() != "VERIFIED":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Complete onboarding first.")
    org_id = latest_session["org_id"]
    record = queries.get_child_upi_by_id(child_upi_id)
    if not record or str(record.get("org_id")) != str(org_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UPI not found")
    updated = queries.reactivate_child_upi(child_upi_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to reactivate UPI")
    return {
        "child_upi_id": str(updated.get("id")),
        "status": updated.get("status"),
        "disabled_at": updated.get("disabled_at").isoformat() if updated.get("disabled_at") else "",
    }
