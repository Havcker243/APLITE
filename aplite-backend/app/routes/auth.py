from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
import secrets
import logging

from psycopg2.errors import UniqueViolation
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Header, Request, Response, status
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, EmailStr, Field

from app.db import queries
from app.utils.email import send_email
from app.utils.ratelimit import RateLimit, check_rate_limit
from app.utils.security import generate_session_token, hash_password, verify_password
from app.utils.upi import generate_core_entity_id, generate_upi

router = APIRouter()
logger = logging.getLogger("aplite")


class SignupRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    company: str = Field(..., alias="company_name")
    summary: str | None = None
    established_year: int | None = Field(default=None, ge=1800, le=datetime.now().year)
    state: str | None = None
    country: str | None = None
    password: str
    confirm_password: str
    accept_terms: bool


class LoginStartRequest(BaseModel):
    email: EmailStr
    password: str


class LoginVerifyRequest(BaseModel):
    login_id: str
    code: str


class AuthResponse(BaseModel):
    token: str
    user: dict


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


def _coerce_utc_datetime(value: object) -> datetime | None:
    """Parse a DB timestamp into a timezone-aware UTC datetime."""
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
        except Exception:
            return None
    else:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _bearer_token_from_header(authorization: str | None) -> str | None:
    """Extract a bearer token from an Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return authorization.removeprefix("Bearer ").strip() or None


def _issue_session(user_id: int) -> str:
    """Create and persist a new session token for the user."""
    token = generate_session_token()
    queries.create_session(token, user_id)
    return token


def _set_session_cookie(response: Response, token: str):
    """Set an HttpOnly session cookie alongside the token response."""
    secure_cookie = os.getenv("SESSION_COOKIE_SECURE", "0") not in ("0", "false", "False")
    response.set_cookie(
        key="aplite_session",
        value=token,
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
        max_age=int(os.getenv("SESSION_TTL_HOURS", "168")) * 3600,
        path="/",
    )


def _clear_session_cookie(response: Response):
    response.delete_cookie("aplite_session", path="/")


def _sanitize_user(user: dict) -> dict:
    sanitized = dict(user)
    sanitized.pop("password_hash", None)
    return sanitized


def get_current_user(request: Request, authorization: str | None = Header(default=None)):
    """FastAPI dependency: authenticate the request and return the current user row."""
    token = _bearer_token_from_header(authorization) or request.cookies.get("aplite_session")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token")
    session = queries.get_session(token)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    created_at = _coerce_utc_datetime(session.get("created_at"))
    if created_at is None:
        queries.delete_session(token)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    ttl_hours = int(os.getenv("SESSION_TTL_HOURS", "168"))  # default: 7 days
    if datetime.now(timezone.utc) > created_at + timedelta(hours=ttl_hours):
        queries.delete_session(token)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    user = queries.get_user_by_id(session["user_id"])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("/api/auth/signup", response_model=AuthResponse)
def signup(payload: SignupRequest, response: Response):
    """Create a new user and return a session token + sanitized user profile."""
    if not payload.accept_terms:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please accept the terms to continue")

    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match")

    existing = queries.get_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account already exists for this email")

    core_id = generate_core_entity_id()
    password_hash = hash_password(payload.password)

    # Create the user first, then generate a master UPI once we have the user_id for namespacing.
    user_id = queries.create_user(
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=payload.email.lower(),
        company=payload.company.strip(),
        company_name=payload.company.strip(),
        summary=(payload.summary or "").strip(),
        established_year=payload.established_year,
        state=(payload.state or "").strip() or None,
        country=(payload.country or "").strip() or None,
        password_hash=password_hash,
        master_upi="",
    )
    master_upi = generate_upi(core_id, payment_index=0, user_id=user_id)
    queries.update_user_master_upi(user_id, master_upi)
    token = _issue_session(user_id)
    _set_session_cookie(response, token)
    user = queries.get_user_by_id(user_id) or {}
    return {"token": token, "user": _sanitize_user(user)}


@router.post("/api/auth/login/start")
def login_start(payload: LoginStartRequest, background_tasks: BackgroundTasks, request: Request):
    """Start login: verify password and send a 6-digit OTP (email in MVP)."""
    ip = (request.client.host if request.client else "unknown").strip()
    email = payload.email.lower().strip()

    ip_rule = RateLimit(limit=int(os.getenv("RL_LOGIN_IP_LIMIT", "30")), window_seconds=int(os.getenv("RL_LOGIN_IP_WINDOW_SECONDS", "600")))
    email_rule = RateLimit(limit=int(os.getenv("RL_LOGIN_EMAIL_LIMIT", "10")), window_seconds=int(os.getenv("RL_LOGIN_EMAIL_WINDOW_SECONDS", "600")))
    ok, retry = check_rate_limit(f"login_start:ip:{ip}", ip_rule)
    if not ok:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many login attempts. Try again soon.", headers={"Retry-After": str(retry)})
    ok, retry = check_rate_limit(f"login_start:email:{email}", email_rule)
    if not ok:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many login attempts for this email. Try again soon.", headers={"Retry-After": str(retry)})

    user = queries.get_user_by_email(email)
    if not user:
        # Clear message to guide users without an account.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found for this email.")
    if not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    login_id = secrets.token_urlsafe(16)
    code = f"{secrets.randbelow(999999):06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    queries.create_otp(login_id, user_id=user["id"], code=code, expires_at=expires_at)

    background_tasks.add_task(
        send_email,
        to_address=user["email"],
        subject="Your Aplite login code",
        body=f"Your verification code is {code}. It expires in 10 minutes.",
    )
    return {"login_id": login_id, "detail": "Verification code sent"}


@router.post("/api/auth/login/verify", response_model=AuthResponse)
def login_verify(payload: LoginVerifyRequest, response: Response):
    """Complete login: verify OTP and return a new session token."""
    attempts_rule = RateLimit(
        limit=int(os.getenv("RL_LOGIN_OTP_ATTEMPTS", "5")),
        window_seconds=int(os.getenv("RL_LOGIN_OTP_WINDOW_SECONDS", "600")),
    )
    ok, retry_after = check_rate_limit(f"login_verify:{payload.login_id}", attempts_rule)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification attempts. Request a new code.",
            headers={"Retry-After": str(retry_after)},
        )

    record = queries.get_otp(payload.login_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired login request")

    if record.get("consumed"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code already used")

    expires_at_raw = record.get("expires_at")
    expires_at: datetime | None = None
    if isinstance(expires_at_raw, datetime):
        expires_at = expires_at_raw
    elif isinstance(expires_at_raw, str):
        try:
            expires_at = datetime.fromisoformat(expires_at_raw)
        except Exception:
            expires_at = None
    if expires_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired login request")
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = expires_at.astimezone(timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code expired")

    expected = hmac.new(record.get("salt", "").encode("utf-8"), payload.code.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, record.get("digest", "")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid code")

    queries.consume_otp(payload.login_id)
    user = queries.get_user_by_id(record["user_id"])
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found")

    token = _issue_session(record["user_id"])
    _set_session_cookie(response, token)
    # Determine if user has completed onboarding.
    latest_session = queries.get_latest_onboarding_session(record["user_id"]) if record else None
    return {"token": token, "user": _sanitize_user(user)}


@router.post("/api/auth/logout")
def logout(response: Response, user=Depends(get_current_user), authorization: str | None = Header(default=None)):
    """Invalidate the current session token (best-effort)."""
    token = _bearer_token_from_header(authorization) or ""
    if token:
        queries.delete_session(token)
    _clear_session_cookie(response)
    return {"detail": "Logged out"}


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
    try:
        latest_session = queries.get_latest_onboarding_session(user["id"])
        if latest_session and latest_session.get("org_id"):
            org = queries.get_organization(str(latest_session["org_id"]), user["id"])
    except Exception:
        # Keep profile page functional even if onboarding tables aren't present yet.
        latest_session = None
        org = None

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
    name: str
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
def create_child_upi(payload: ChildUpiRequest, user=Depends(get_current_user)):
    """
    Issue a child/org UPI for the current user's verified org, using an existing or new payment account.
    """
    logger.info("child-upi request received", extra={"user_id": user.get("id"), "payload": payload.model_dump()})
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
                account_name=payload.account_name or payload.name,
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
    for _ in range(3):
        try:
            core_id = generate_core_entity_id()
            upi = generate_upi(core_id, payment_index, user_id=user["id"])
            child_upi_id = queries.create_child_upi(
                org_id=str(org_id),
                payment_account_id=int(payment_account_id),
                upi=upi,
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
def list_child_upis(user=Depends(get_current_user)):
    """
    List payment accounts/UPIs for the current user's verified org.
    """
    latest_session = queries.get_latest_onboarding_session(user["id"])
    if not latest_session or str(latest_session.get("state")).upper() != "VERIFIED":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Complete onboarding first.")
    org_id = latest_session["org_id"]
    rows = queries.list_child_upis_for_org(org_id)
    results: list[dict] = []
    for row in rows:
        results.append(
            {
                "child_upi_id": row.get("child_upi_id"),
                "upi": row.get("upi") or "",
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
