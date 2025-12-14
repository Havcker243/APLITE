from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, EmailStr, Field

from app.db import queries
from app.utils.security import generate_session_token, hash_password, verify_password
from app.utils.upi import generate_core_entity_id, generate_upi

router = APIRouter()


class SignupRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    company: str = Field(..., alias="company_name")
    password: str
    confirm_password: str
    accept_terms: bool


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


def _issue_session(user_id: int) -> str:
    token = generate_session_token()
    queries.create_session(token, user_id)
    return token


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
    master_upi = generate_upi(core_id, payment_index=0)
    password_hash = hash_password(payload.password)

    user_id = queries.create_user(
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=payload.email.lower(),
        company=payload.company.strip(),
        password_hash=password_hash,
        master_upi=master_upi,
    )
    token = _issue_session(user_id)
    user = queries.get_user_by_id(user_id) or {}
    user.pop("password_hash", None)
    return {"token": token, "user": user}


@router.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    user = queries.get_user_by_email(payload.email.lower())
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = _issue_session(user["id"])
    sanitized = dict(user)
    sanitized.pop("password_hash", None)
    return {"token": token, "user": sanitized}
