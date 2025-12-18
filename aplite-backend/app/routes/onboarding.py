from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import os
import re
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi import Request
from pydantic import BaseModel, Field, field_validator

from app.db import queries
from app.routes.auth import get_current_user
from app.utils.email import send_email
from app.utils.ratelimit import RateLimit, check_rate_limit

router = APIRouter()

EIN_RE = re.compile(r"^\d{2}-\d{7}$")
DOMAIN_RE = re.compile(
    r"^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$"
)

MAX_OTP_ATTEMPTS = 5
MAX_OTP_RESENDS = 3
OTP_TTL_MINUTES = 10


class Address(BaseModel):
    street1: str = Field(min_length=1, max_length=120)
    street2: str | None = Field(default=None, max_length=120)
    city: str = Field(min_length=1, max_length=80)
    state: str = Field(min_length=2, max_length=40)
    zip: str = Field(min_length=5, max_length=10)
    country: str = Field(min_length=2, max_length=80)

    @field_validator("zip")
    @classmethod
    def validate_zip(cls, value: str) -> str:
        value = value.strip()
        if not re.match(r"^\d{5}(-\d{4})?$", value):
            raise ValueError("ZIP must be 5 digits or ZIP+4 (NNNNN or NNNNN-NNNN).")
        return value


class Step1Payload(BaseModel):
    legal_name: str = Field(min_length=2, max_length=120)
    dba: str | None = Field(default=None, max_length=120)
    ein: str
    formation_date: date
    formation_state: str = Field(min_length=2, max_length=40)
    entity_type: str = Field(min_length=2, max_length=60)
    address: Address
    industry: str = Field(min_length=1, max_length=80)
    website: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=800)

    @field_validator("ein")
    @classmethod
    def validate_ein(cls, value: str) -> str:
        value = value.strip()
        if not EIN_RE.match(value):
            raise ValueError("EIN must match NN-NNNNNNN format.")
        return value

    @field_validator("formation_date")
    @classmethod
    def validate_formation_date(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Formation date cannot be in the future.")
        return value

    @field_validator("website")
    @classmethod
    def validate_website(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip().lower()
        if not value:
            return None
        # Accept either domain or URL; normalize to domain-ish string.
        value = value.removeprefix("https://").removeprefix("http://")
        value = value.split("/", 1)[0]
        if not DOMAIN_RE.match(value):
            raise ValueError("Website must be a valid domain (e.g. example.com).")
        return value


class Step1Response(BaseModel):
    org_id: str
    session_id: str
    next_step: int = 2


class Step2Payload(BaseModel):
    role: str = Field(..., pattern=r"^(owner|authorized_rep)$")
    title: str | None = Field(default=None, max_length=80)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None, info):  # type: ignore[override]
        role = info.data.get("role")
        if role == "authorized_rep" and (not value or not value.strip()):
            raise ValueError("Executive title is required for an authorized representative.")
        return value.strip() if value else None


class Step3Payload(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    title: str | None = Field(default=None, max_length=80)
    id_document_id: str = Field(min_length=8, max_length=200)
    attestation: bool

    @field_validator("id_document_id")
    @classmethod
    def validate_id_document_id(cls, value: str) -> str:
        value = value.strip()
        if not re.match(r"^id_[0-9a-f]{32}$", value):
            raise ValueError("Invalid document reference. Please re-upload.")
        return value


class Step4Payload(BaseModel):
    bank_name: str = Field(min_length=2, max_length=120)
    account_number: str = Field(min_length=4, max_length=32)
    ach_routing: str | None = Field(default=None, max_length=20)
    wire_routing: str | None = Field(default=None, max_length=34)
    swift: str | None = Field(default=None, max_length=20)

    @field_validator("account_number")
    @classmethod
    def validate_account_number(cls, value: str) -> str:
        value = value.strip().replace(" ", "")
        if not value.isdigit():
            raise ValueError("Account number must be numeric.")
        return value

    @field_validator("ach_routing")
    @classmethod
    def validate_ach(cls, value: str | None) -> str | None:
        if not value:
            return None
        value = value.strip().replace(" ", "")
        if not value.isdigit():
            raise ValueError("ACH routing number must be numeric.")
        if len(value) != 9:
            raise ValueError("ACH routing number must be 9 digits.")
        return value

    @field_validator("wire_routing")
    @classmethod
    def validate_wire(cls, value: str | None) -> str | None:
        if not value:
            return None
        value = value.strip().replace(" ", "")
        if not value.isdigit():
            raise ValueError("Wire routing number must be numeric.")
        if len(value) < 6:
            raise ValueError("Wire routing number should be at least 6 digits.")
        return value

    @field_validator("swift")
    @classmethod
    def validate_swift(cls, value: str | None) -> str | None:
        if not value:
            return None
        value = value.strip().upper().replace(" ", "")
        # Basic SWIFT/BIC check: 8 or 11 alnum.
        if not re.match(r"^[A-Z0-9]{8}([A-Z0-9]{3})?$", value):
            raise ValueError("SWIFT/BIC must be 8 or 11 alphanumeric characters.")
        return value


class CurrentOnboardingResponse(BaseModel):
    session_id: str
    org_id: str
    state: str
    current_step: int
    risk_level: str
    address_locked: bool
    org: dict


@router.get("/onboarding/current", response_model=CurrentOnboardingResponse)
def onboarding_current(user=Depends(get_current_user)):
    session = queries.get_active_onboarding_session(user["id"])
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active onboarding session.")
    org = queries.get_organization(session["org_id"], user["id"]) or {}
    return {
        "session_id": str(session["id"]),
        "org_id": str(session["org_id"]),
        "state": session["state"],
        "current_step": int(session["current_step"]),
        "risk_level": session.get("risk_level", "low"),
        "address_locked": bool(session.get("address_locked", False)),
        "org": org,
    }


@router.post("/onboarding/step-1", response_model=Step1Response)
def onboarding_step1(payload: Step1Payload, user=Depends(get_current_user)):
    active = queries.get_active_onboarding_session(user["id"])
    if active and int(active.get("current_step", 1)) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Step 1 is already completed for this onboarding session. Continue onboarding.",
        )

    org_id = uuid.uuid4()
    session_id = uuid.uuid4()

    if active:
        org_id = uuid.UUID(str(active["org_id"]))
        session_id = uuid.UUID(str(active["id"]))
        queries.update_organization_step1(
            org_id=org_id,
            user_id=user["id"],
            legal_name=payload.legal_name.strip(),
            dba=(payload.dba or "").strip() or None,
            ein=payload.ein,
            formation_date=payload.formation_date,
            formation_state=payload.formation_state.strip(),
            entity_type=payload.entity_type.strip(),
            address=payload.address.model_dump(),
            industry=payload.industry.strip(),
            website=payload.website,
            description=(payload.description or "").strip() or None,
        )
        queries.touch_onboarding_session(session_id)
    else:
        queries.create_organization_step1(
            org_id=org_id,
            user_id=user["id"],
            legal_name=payload.legal_name.strip(),
            dba=(payload.dba or "").strip() or None,
            ein=payload.ein,
            formation_date=payload.formation_date,
            formation_state=payload.formation_state.strip(),
            entity_type=payload.entity_type.strip(),
            address=payload.address.model_dump(),
            industry=payload.industry.strip(),
            website=payload.website,
            description=(payload.description or "").strip() or None,
        )
        queries.create_onboarding_session(
            session_id=session_id,
            org_id=org_id,
            user_id=user["id"],
            state="STEP_1_COMPLETE",
            current_step=2,
            address_locked=True,
        )

    return {"org_id": str(org_id), "session_id": str(session_id), "next_step": 2}


@router.post("/onboarding/step-2")
def onboarding_step2(payload: Step2Payload, user=Depends(get_current_user)):
    session = queries.get_active_onboarding_session(user["id"])
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Start onboarding first.")
    if int(session.get("current_step", 1)) != 2:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You cannot complete this step yet.")

    risk_level = "low" if payload.role == "owner" else "medium"
    queries.update_onboarding_role(
        session_id=uuid.UUID(str(session["id"])),
        user_id=user["id"],
        role=payload.role,
        title=payload.title,
        risk_level=risk_level,
    )
    queries.advance_onboarding_session(uuid.UUID(str(session["id"])), state="STEP_2_COMPLETE", next_step=3)
    return {"next_step": 3, "risk_level": risk_level}


@router.post("/onboarding/upload-id")
async def onboarding_upload_id(file: UploadFile = File(...), user=Depends(get_current_user)):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing file.")
    content_type = (file.content_type or "").lower()
    if content_type not in ("image/jpeg", "image/png", "application/pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type. Use jpg, png, or pdf.")

    file_id = f"id_{uuid.uuid4().hex}"

    # Stream to disk to avoid buffering full uploads in memory.
    max_bytes = 10 * 1024 * 1024
    base = queries.onboarding_upload_base_dir()
    os.makedirs(base, exist_ok=True)
    bin_path = os.path.abspath(os.path.join(base, f"{file_id}.bin"))
    tmp_path = os.path.abspath(os.path.join(base, f"{file_id}.bin.tmp"))
    if not bin_path.startswith(base + os.sep) or not tmp_path.startswith(base + os.sep):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload id")

    written = 0
    try:
        with open(tmp_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 10MB).")
                out.write(chunk)
        os.replace(tmp_path, bin_path)
        queries.store_onboarding_file_metadata(
            file_id=file_id,
            filename=file.filename,
            content_type=content_type,
            user_id=user["id"],
        )
    finally:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
    return {"file_id": file_id}


@router.post("/onboarding/step-3")
def onboarding_step3(payload: Step3Payload, user=Depends(get_current_user)):
    if not payload.attestation:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You must attest to continue.")

    session = queries.get_active_onboarding_session(user["id"])
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Start onboarding first.")
    if int(session.get("current_step", 1)) != 3:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You cannot complete this step yet.")

    # Ensure the uploaded document exists for this user.
    if not queries.onboarding_file_exists(file_id=payload.id_document_id, user_id=user["id"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document reference. Please re-upload.")

    verification_id = uuid.uuid4()
    queries.create_identity_verification(
        verification_id=verification_id,
        session_id=uuid.UUID(str(session["id"])),
        org_id=uuid.UUID(str(session["org_id"])),
        user_id=user["id"],
        full_name=payload.full_name.strip(),
        title=(payload.title or "").strip() or None,
        id_document_id=payload.id_document_id,
        attestation=payload.attestation,
        status="pending",
    )

    # MVP: mark as pending verification, then allow user to proceed.
    queries.advance_onboarding_session(uuid.UUID(str(session["id"])), state="STEP_3_VERIFICATION_PENDING", next_step=4)
    return {"next_step": 4, "status": "pending_verification"}


@router.post("/onboarding/step-4")
def onboarding_step4(payload: Step4Payload, user=Depends(get_current_user)):
    session = queries.get_active_onboarding_session(user["id"])
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Start onboarding first.")
    if int(session.get("current_step", 1)) != 4:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You cannot complete this step yet.")

    if not (payload.ach_routing or payload.wire_routing or payload.swift):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one rail (ACH routing, wire routing, or SWIFT).",
        )

    mapping_id = uuid.uuid4()
    last4 = payload.account_number[-4:]
    queries.create_bank_rail_mapping(
        mapping_id=mapping_id,
        session_id=uuid.UUID(str(session["id"])),
        org_id=uuid.UUID(str(session["org_id"])),
        user_id=user["id"],
        bank_name=payload.bank_name.strip(),
        account_number=payload.account_number,
        last4=last4,
        ach_routing=payload.ach_routing,
        wire_routing=payload.wire_routing,
        swift=payload.swift,
    )
    queries.advance_onboarding_session(uuid.UUID(str(session["id"])), state="STEP_4_COMPLETE", next_step=5)
    return {"next_step": 5, "bank_name": payload.bank_name.strip(), "account_last4": last4}


class SendOtpPayload(BaseModel):
    method: str = Field(..., pattern=r"^(email|sms)$")


@router.post("/verify/send-otp")
def send_verification_otp(payload: SendOtpPayload, background_tasks: BackgroundTasks, request: Request, user=Depends(get_current_user)):
    session = queries.get_active_onboarding_session(user["id"])
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Start onboarding first.")
    if int(session.get("current_step", 1)) < 5:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Complete onboarding steps before verification.")

    ip = (request.client.host if request.client else "unknown").strip()
    user_rule = RateLimit(limit=int(os.getenv("RL_VERIFY_OTP_USER_LIMIT", "5")), window_seconds=int(os.getenv("RL_VERIFY_OTP_USER_WINDOW_SECONDS", "600")))
    ip_rule = RateLimit(limit=int(os.getenv("RL_VERIFY_OTP_IP_LIMIT", "30")), window_seconds=int(os.getenv("RL_VERIFY_OTP_IP_WINDOW_SECONDS", "600")))
    ok, retry = check_rate_limit(f"verify_send_otp:user:{int(user['id'])}", user_rule)
    if not ok:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many OTP requests. Try again soon.", headers={"Retry-After": str(retry)})
    ok, retry = check_rate_limit(f"verify_send_otp:ip:{ip}", ip_rule)
    if not ok:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many OTP requests. Try again soon.", headers={"Retry-After": str(retry)})

    existing = queries.get_latest_verification_attempt(user["id"], uuid.UUID(str(session["id"])))
    destination = user["email"] if payload.method == "email" else None

    otp_id, code = queries.create_verification_otp(user_id=user["id"], ttl=timedelta(minutes=OTP_TTL_MINUTES))

    if existing and existing.get("method") == payload.method and existing.get("status") == "sent":
        if int(existing.get("resend_count", 0)) >= MAX_OTP_RESENDS:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Resend limit reached. Try again later.")
        queries.bump_verification_resend(uuid.UUID(str(existing["id"])))
        queries.update_verification_attempt_otp(uuid.UUID(str(existing["id"])), otp_id=otp_id)
    else:
        attempt_id = uuid.uuid4()
        queries.create_verification_attempt(
            attempt_id=attempt_id,
            session_id=uuid.UUID(str(session["id"])),
            org_id=uuid.UUID(str(session["org_id"])),
            user_id=user["id"],
            method=payload.method,
            destination=destination,
            otp_id=otp_id,
        )

    if payload.method == "email":
        # Avoid blocking the request on network I/O to the email provider.
        background_tasks.add_task(
            send_email,
            to_address=user["email"],
            subject="Your Aplite verification code",
            body=f"Your verification code is {code}. It expires in 10 minutes.",
        )
    else:
        # MVP: SMS not integrated; log to stdout via the backend logger.
        queries.send_verification_message_sms(code=code)

    return {"detail": "OTP sent", "expires_in_minutes": OTP_TTL_MINUTES}


class ConfirmOtpPayload(BaseModel):
    code: str = Field(min_length=6, max_length=6)


@router.post("/verify/confirm-otp")
def confirm_verification_otp(payload: ConfirmOtpPayload, user=Depends(get_current_user)):
    session = queries.get_active_onboarding_session(user["id"])
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Start onboarding first.")
    attempt = queries.get_latest_verification_attempt(user["id"], uuid.UUID(str(session["id"])))
    if not attempt or attempt.get("status") != "sent":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No pending OTP verification.")

    if int(attempt.get("attempts", 0)) >= MAX_OTP_ATTEMPTS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Attempt limit reached. Request a new code.")

    ok = queries.verify_otp(otp_id=attempt["otp_id"], code=payload.code)
    queries.bump_verification_attempt(uuid.UUID(str(attempt["id"])))
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code. Check and try again.")

    queries.mark_verification_attempt_verified(uuid.UUID(str(attempt["id"])))
    upi = queries.complete_onboarding_and_issue_identifier(uuid.UUID(str(session["id"])))
    return {"status": "VERIFIED", "upi": upi}


@router.get("/verify/available-slots")
def available_slots(user=Depends(get_current_user)):
    # MVP: deterministic slots (next 3 business days, 4 slots/day).
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    slots: list[str] = []
    for day_offset in range(1, 6):
        start = now + timedelta(days=day_offset)
        for hour in (14, 15, 16, 17):
            slots.append(start.replace(hour=hour).isoformat())
    return {"slots": slots}


class ScheduleCallPayload(BaseModel):
    scheduled_at: datetime


@router.post("/verify/schedule-call")
def schedule_call(payload: ScheduleCallPayload, user=Depends(get_current_user)):
    session = queries.get_active_onboarding_session(user["id"])
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Start onboarding first.")

    call_id = uuid.uuid4()
    queries.create_verification_call(
        call_id=call_id,
        session_id=uuid.UUID(str(session["id"])),
        org_id=uuid.UUID(str(session["org_id"])),
        user_id=user["id"],
        scheduled_at=payload.scheduled_at,
    )
    return {"detail": "Call scheduled", "call_id": str(call_id)}


@router.post("/verify/complete-call")
def complete_call(session_id: str, user=Depends(get_current_user)):
    # MVP/internal: allow the logged-in user to complete call verification in dev.
    try:
        sid = uuid.UUID(session_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session_id.")
    session = queries.get_onboarding_session_by_id(sid)
    if not session or int(session.get("user_id", -1)) != int(user["id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    upi = queries.complete_onboarding_and_issue_identifier(sid)
    return {"status": "VERIFIED", "upi": upi}
