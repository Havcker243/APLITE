from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, EmailStr, Field

from app.db import queries
from app.utils.email import send_email
from app.utils.security import generate_session_token, hash_password, verify_password
from app.utils.upi import generate_core_entity_id, generate_upi

router = APIRouter()


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


def _issue_session(user_id: int) -> str:
    token = generate_session_token()
    queries.create_session(token, user_id)
    return token


def _sanitize_user(user: dict) -> dict:
    sanitized = dict(user)
    sanitized.pop("password_hash", None)
    return sanitized


def get_current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token")
    token = authorization.removeprefix("Bearer ").strip()
    session = queries.get_session(token)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    user = queries.get_user_by_id(session["user_id"])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("/api/auth/signup", response_model=AuthResponse)
def signup(payload: SignupRequest):
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
    user = queries.get_user_by_id(user_id) or {}
    return {"token": token, "user": _sanitize_user(user)}


@router.post("/api/auth/login/start")
def login_start(payload: LoginStartRequest):
    user = queries.get_user_by_email(payload.email.lower())
    if not user:
        # Clear message to guide users without an account.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found for this email.")
    if not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    login_id = secrets.token_urlsafe(16)
    code = f"{secrets.randbelow(999999):06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    queries.create_otp(login_id, user_id=user["id"], code=code, expires_at=expires_at)

    send_email(
        to_address=user["email"],
        subject="Your Aplite login code",
        body=f"Your verification code is {code}. It expires in 10 minutes.",
    )
    return {"login_id": login_id, "detail": "Verification code sent"}


@router.post("/api/auth/login/verify", response_model=AuthResponse)
def login_verify(payload: LoginVerifyRequest):
    record = queries.get_otp(payload.login_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired login request")

    if record.get("consumed"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code already used")

    try:
        expires_at = datetime.fromisoformat(record["expires_at"])
    except Exception:
        expires_at = datetime.now(timezone.utc)
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
    return {"token": token, "user": _sanitize_user(user)}


@router.get("/api/profile")
def get_profile(user=Depends(get_current_user)):
    return _sanitize_user(user)


@router.put("/api/profile")
def update_profile(payload: ProfileUpdateRequest, user=Depends(get_current_user)):
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
