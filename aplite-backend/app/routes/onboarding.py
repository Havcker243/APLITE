from __future__ import annotations

from datetime import date
import hashlib
import hmac
import os
import logging
import re
import uuid
import json
from typing import Optional
import psycopg2
from psycopg2.errors import UniqueViolation

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, Form, Header, Request
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field, field_validator

from app.db import queries
from app.routes.auth import get_current_user
from app.utils.upi import generate_core_entity_id, generate_upi
from app.utils.email import send_email
import boto3
from botocore.client import Config as BotoConfig

router = APIRouter()
logger = logging.getLogger("aplite")

EIN_RE = re.compile(r"^\d{2}-\d{7}$")
DOMAIN_RE = re.compile(
    r"^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$"
)

CAL_WEBHOOK_SECRET = os.getenv("CAL_WEBHOOK_SECRET", "")
WEBHOOK_ALERT_EMAIL = os.getenv("WEBHOOK_ALERT_EMAIL", "")
CAL_VERIFY_EVENTS = {
    "booking.completed",
    "booking.ended",
    "call.completed",
    "meeting.completed",
}
CAL_VERIFY_ON_CANCEL = os.getenv("CAL_VERIFY_ON_CANCEL", "0").lower() in ("1", "true", "yes")
CAL_CANCEL_EVENTS = {
    "booking.cancelled",
    "booking.canceled",
    "call.cancelled",
    "call.canceled",
    "meeting.cancelled",
    "meeting.canceled",
}

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


class FormationDocument(BaseModel):
    doc_type: str = Field(
        ...,
        pattern=r"^(articles_of_organization|certificate_of_formation|articles_of_incorporation|certificate_of_limited_partnership|partnership_equivalent)$",
    )
    file_id: str = Field(..., pattern=r"^form_[0-9a-f]{32}$")


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
    formation_documents: list[FormationDocument] | None = None

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
    id_document_id: str | None = Field(default=None, min_length=8, max_length=200)
    phone: str | None = Field(default=None, max_length=32)
    attestation: bool

    @field_validator("id_document_id")
    @classmethod
    def validate_id_document_id(cls, value: str | None) -> str | None:
        if value is None:
            return value
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
    step_statuses: dict
    org: dict


class CompletePayload(BaseModel):
    org: Step1Payload
    role: Step2Payload
    identity: Step3Payload
    bank: Step4Payload
    verification_method: str | None = Field(default=None, pattern=r"^(call|id|otp|none)?$")
    verification_code: str | None = Field(default=None, min_length=6, max_length=6)
    id_document_id: str | None = None


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
        "step_statuses": session.get("step_statuses") or {},
        "org": org,
    }


@router.post("/onboarding/reset")
def onboarding_reset(user=Depends(get_current_user)):
    """
    Delete any in-progress (non-verified) onboarding session for the user.

    Used to force a clean restart when the user returns to onboarding.
    """
    queries.reset_active_onboarding(user["id"])
    return {"detail": "reset"}


@router.post("/onboarding/upload-id")
async def onboarding_upload_id(file: UploadFile = File(...), user=Depends(get_current_user)):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing file.")
    content_type = (file.content_type or "").lower()
    if content_type not in ("image/jpeg", "image/png", "application/pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type. Use jpg, png, or pdf.")

    file_id, storage = _store_uploaded_file(file, user_id=user["id"], doc_category="id_document")
    return {"file_id": file_id, "storage": storage}

@router.post("/onboarding/upload-formation")
async def onboarding_upload_formation(
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    # Formation docs are keyed separately so we can validate entity-specific requirements.
    if doc_type not in {
        "articles_of_organization",
        "certificate_of_formation",
        "articles_of_incorporation",
        "certificate_of_limited_partnership",
        "partnership_equivalent",
    }:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported formation document type.")
    file_id, storage = _store_uploaded_file(
        file,
        user_id=user["id"],
        file_id_prefix="form",
        key_prefix="formations",
        doc_category="formation_document",
        doc_type=doc_type,
    )
    return {"file_id": file_id, "storage": storage}


def _store_uploaded_file(
    file: UploadFile,
    user_id: int,
    *,
    file_id_prefix: str = "id",
    key_prefix: str = "ids",
    doc_category: str | None = None,
    doc_type: str | None = None,
) -> tuple[str, str]:
    # Accept uploads into S3 when configured; otherwise persist locally for MVP.
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing file.")
    content_type = (file.content_type or "").lower()
    if content_type not in ("image/jpeg", "image/png", "application/pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type. Use jpg, png, or pdf.")

    file_id = f"{file_id_prefix}_{uuid.uuid4().hex}"

    # Read file into memory (max 10MB) for upload.
    max_bytes = 10 * 1024 * 1024
    data = file.file.read(max_bytes + 1)
    if data is None:
        data = b""
    if len(data) > max_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 10MB).")

    # Attempt to upload to Supabase S3-compatible bucket; fallback to local disk.
    bucket = os.getenv("DATABASE_BUCKET_NAME")
    endpoint = os.getenv("DATABASE_BUCKET_S3_ENDPOINT")
    access_key = os.getenv("DATABASE_BUCKET_S3_ACCESS_KEY_ID")
    secret_key = os.getenv("DATABASE_BUCKET_S3_SECRET_ACCESS_KEY")
    region = os.getenv("DATABASE_BUCKET_S3_REGION", "us-east-1")
    key = f"{key_prefix}/{file_id}.bin"
    uploaded = False
    storage = "local"
    if bucket and endpoint and access_key and secret_key:
        try:
            s3 = boto3.client(
                "s3",
                endpoint_url=endpoint,
                region_name=region,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                config=BotoConfig(signature_version="s3v4"),
            )
            s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
            uploaded = True
            storage = "s3"
        except Exception as exc:
            logger.exception("Failed to upload ID document to Supabase storage: %s", exc)

    if not uploaded:
        base = queries.onboarding_upload_base_dir()
        os.makedirs(base, exist_ok=True)
        bin_path = os.path.abspath(os.path.join(base, f"{file_id}.bin"))
        if not bin_path.startswith(base + os.sep):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload id")
        with open(bin_path, "wb") as out:
            out.write(data)

    # Always store metadata locally to validate ownership.
    queries.store_onboarding_file_metadata(
        file_id=file_id,
        filename=file.filename,
        content_type=content_type,
        user_id=user_id,
        doc_category=doc_category,
        doc_type=doc_type,
    )
    return file_id, storage


def _entity_type_key(value: str) -> str:
    return "".join(ch for ch in value.strip().lower() if ch.isalnum())


def _allowed_formation_docs(entity_type: str) -> set[str]:
    # Normalize entity type names to a small set of required formation docs.
    key = _entity_type_key(entity_type)
    if key == "llc":
        return {"articles_of_organization", "certificate_of_formation"}
    if key in {"ccorp", "scorp"}:
        return {"articles_of_incorporation"}
    if key in {"nonprofit", "nonprofitcorporation"}:
        return {"articles_of_incorporation"}
    if key == "partnership":
        return {"certificate_of_limited_partnership", "partnership_equivalent"}
    return set()


def _formation_docs_required(entity_type: str) -> bool:
    return _entity_type_key(entity_type) != "soleproprietor"


def _cal_signature_ok(secret: str, body: bytes, signature: str | None) -> bool:
    if not secret:
        return True
    if not signature:
        return False
    signature = signature.strip()
    if signature.startswith("sha256="):
        signature = signature.split("=", 1)[1]
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


def _extract_cal_email(payload: dict) -> str | None:
    # Best-effort extraction across Cal.com webhook variants.
    candidates: list[str] = []
    for key in ("email", "user", "organizer"):
        value = payload.get(key)
        if isinstance(value, dict):
            email = value.get("email")
            if isinstance(email, str):
                candidates.append(email)
        elif isinstance(value, str) and "@" in value:
            candidates.append(value)

    booking = payload.get("booking") if isinstance(payload.get("booking"), dict) else payload.get("data")
    if not booking and isinstance(payload.get("payload"), dict):
        booking = payload.get("payload")
    if isinstance(booking, dict):
        responses = booking.get("responses")
        if isinstance(responses, dict):
            email_obj = responses.get("email")
            if isinstance(email_obj, dict) and isinstance(email_obj.get("value"), str):
                candidates.append(email_obj["value"])
        for key in ("attendees", "participants"):
            attendees = booking.get(key)
            if isinstance(attendees, list):
                for attendee in attendees:
                    if isinstance(attendee, dict) and isinstance(attendee.get("email"), str):
                        candidates.append(attendee["email"])
        organizer = booking.get("organizer")
        if isinstance(organizer, dict) and isinstance(organizer.get("email"), str):
            candidates.append(organizer["email"])
        if isinstance(booking.get("email"), str):
            candidates.append(booking["email"])

    for email in candidates:
        cleaned = email.strip().lower()
        if cleaned and "@" in cleaned:
            return cleaned
    return None


def _normalize_cal_event(payload: dict) -> str:
    raw = payload.get("type") or payload.get("event") or payload.get("trigger") or payload.get("triggerEvent") or ""
    value = str(raw).strip()
    if not value:
        return ""
    value = value.replace(" ", "_").replace("-", "_")
    value = value.lower()
    # Normalize Cal enum-like values to dot notation (booking_cancelled -> booking.cancelled).
    if "_" in value and "." not in value:
        parts = value.split("_", 1)
        if len(parts) == 2:
            return f"{parts[0]}.{parts[1]}"
    return value


def _send_webhook_alert(subject: str, body: str) -> None:
    if not WEBHOOK_ALERT_EMAIL:
        return
    try:
        send_email(to_address=WEBHOOK_ALERT_EMAIL, subject=subject, body=body)
    except Exception:
        logger.exception("Failed to send webhook alert")


@router.post("/onboarding/complete")
def onboarding_complete(
    data: str = Form(..., description="JSON string for CompletePayload"),
    file: UploadFile | None = File(default=None),
    user=Depends(get_current_user),
):
    """
    Single-submit onboarding: accept all steps and complete verification in one go.

    Accepts multipart/form-data with:
      - data: JSON string matching CompletePayload
      - file: optional UploadFile for ID document
    """
    # Parse + validate the full payload in one request (MVP single-submit flow).
    try:
        payload_raw = json.loads(data)
        payload = CompletePayload(**payload_raw)
    except Exception as exc:
        # Surface validation errors; return a simple string to avoid serialization issues.
        logger.exception("Invalid onboarding payload: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc) or "Invalid onboarding payload",
        ) from exc

    # Handle ID document (multipart file takes precedence over existing file_id).
    file_id = payload.identity.id_document_id or payload.id_document_id
    if file is not None:
        file_id, _ = _store_uploaded_file(file, user_id=user["id"], doc_category="id_document")

    # Validate formation documents against the declared entity type.
    allowed_docs = _allowed_formation_docs(payload.org.entity_type)
    formation_required = _formation_docs_required(payload.org.entity_type)
    formation_docs = payload.org.formation_documents or []
    if formation_required:
        if not allowed_docs:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Formation documents required for this entity type.")
        if not any(doc.doc_type in allowed_docs for doc in formation_docs):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload a valid formation document for this entity type.")
    for doc in formation_docs:
        if allowed_docs and doc.doc_type not in allowed_docs:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported formation document for this entity type.")
        if not queries.onboarding_file_exists(file_id=doc.file_id, user_id=user["id"], allowed_prefixes=("form",)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid formation document reference.")

    # Basic role/risk determination and verification method.
    risk_level = "low" if payload.role.role == "owner" else "high"
    # Default verification path: owners go through a call; reps provide ID.
    verification_method = payload.verification_method or ("call" if payload.role.role == "owner" else "id")

    try:
        # Step 3: identity validation
        require_document = verification_method != "call"
        if require_document and not file_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload a government ID document.")
        if file_id:
            if not queries.onboarding_file_exists(file_id=file_id, user_id=user["id"]):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document reference. Please re-upload.")

        if not (payload.bank.ach_routing or payload.bank.wire_routing or payload.bank.swift):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide at least one rail (ACH routing, wire routing, or SWIFT).",
            )

        # Commit all onboarding data atomically (org + session + identity + bank + UPI issuance).
        result = queries.complete_onboarding_tx(
            user_id=user["id"],
            org_data={
                "legal_name": payload.org.legal_name.strip(),
                "dba": (payload.org.dba or "").strip() or None,
                "ein": payload.org.ein,
                "formation_date": payload.org.formation_date,
                "formation_state": payload.org.formation_state.strip(),
                "entity_type": payload.org.entity_type.strip(),
                "address": payload.org.address.model_dump(),
                "industry": payload.org.industry.strip(),
                "website": payload.org.website,
                "description": (payload.org.description or "").strip() or None,
            },
            role_data={
                "role": payload.role.role,
                "title": payload.role.title,
            },
            identity_data={
                "full_name": payload.identity.full_name.strip(),
                "title": (payload.identity.title or "").strip() or None,
                "id_document_id": file_id or "call_verification",
                "phone": (payload.identity.phone or "").strip() or None,
                "attestation": payload.identity.attestation,
            },
            bank_data={
                "bank_name": payload.bank.bank_name.strip(),
                "account_number": payload.bank.account_number,
                "ach_routing": payload.bank.ach_routing,
                "wire_routing": payload.bank.wire_routing,
                "swift": payload.bank.swift,
            },
            formation_docs=[doc.model_dump() for doc in formation_docs],
            verification_method=verification_method,
            risk_level=risk_level,
            master_upi=user.get("master_upi") or "",
        )

    except HTTPException:
        raise
    except (UniqueViolation, psycopg2.IntegrityError) as exc:
        logger.exception("Onboarding failed due to duplicate org/EIN")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An organization with this EIN already exists for this account.",
        ) from exc
    except RuntimeError as exc:
        # Surface runtime issues (e.g., missing UPI secret) for easier debugging.
        logger.exception("Onboarding completion failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc) or "Unable to complete onboarding",
        ) from exc
    except Exception as exc:
        logger.exception("Onboarding completion failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to complete onboarding") from exc

    return {
        "status": result["status"],
        "org_id": result["org_id"],
        "session_id": result["session_id"],
        "upi": result["upi"],
        "payment_account_id": result["payment_account_id"],
    }


@router.post("/api/admin/orgs/{org_id}/verify")
def admin_verify_org(
    org_id: str,
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
):
    """
    Manual verification endpoint (MVP).

    Protect with ADMIN_API_KEY to avoid unauthenticated use.
    """
    expected_key = os.getenv("ADMIN_API_KEY") or ""
    if not expected_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Admin verification is not configured.")
    if x_admin_key != expected_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid admin key.")

    org = queries.get_organization_by_id(org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    session = queries.get_latest_onboarding_session_by_org(org_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Onboarding session not found.")

    payment_account_id = queries.get_onboarding_payment_account(uuid.UUID(str(session["id"])))
    if not payment_account_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment account missing for onboarding session.")
    account = queries.get_payment_account_by_id(payment_account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment account not found.")

    user = queries.get_user_by_id(int(org.get("user_id") or 0)) or {}
    master_upi = user.get("master_upi") or ""
    if not master_upi:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Missing master UPI for user.")

    upi = org.get("upi") or None
    if not upi:
        payment_index = int(account.get("payment_index", 1) or 1)
        core_id = generate_core_entity_id()
        upi = generate_upi(core_id, payment_index=payment_index, user_id=int(user.get("id") or 0))
        queries.set_organization_upi(org_id, upi, payment_account_id, verification_status="verified", status="active")
    else:
        queries.set_organization_verification_status(org_id, verification_status="verified", status="active")

    queries.complete_onboarding_session(uuid.UUID(str(session["id"])), state="VERIFIED")
    return {"status": "VERIFIED", "org_id": str(org_id), "upi": upi}


@router.post("/webhooks/cal")
async def cal_webhook(request: Request, x_cal_signature: str | None = Header(default=None, alias="X-Cal-Signature")):
    """
    Cal.com webhook handler.

    Expected behavior:
    - If event indicates a completed call, mark onboarding VERIFIED and issue UPI.
    - Otherwise acknowledge the event.
    """
    body = await request.body()
    if not _cal_signature_ok(CAL_WEBHOOK_SECRET, body, x_cal_signature):
        _send_webhook_alert(
            subject="Aplite: Cal webhook signature failed",
            body="Received Cal webhook with invalid signature.",
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid webhook signature.")

    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception as exc:
        _send_webhook_alert(
            subject="Aplite: Cal webhook invalid JSON",
            body=f"Failed to parse webhook JSON: {exc}",
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload.") from exc

    event = _normalize_cal_event(payload)
    email = _extract_cal_email(payload)
    logger.info("cal webhook received", extra={"event": event, "email": email})
    if not email:
        _send_webhook_alert(
            subject="Aplite: Cal webhook missing email",
            body=f"Event {event or 'unknown'} did not include an attendee email.",
        )
        return {"status": "ignored", "detail": "Missing attendee email"}

    user = queries.get_user_by_email(email)
    if not user:
        _send_webhook_alert(
            subject="Aplite: Cal webhook user not found",
            body=f"Event {event or 'unknown'} for email {email} had no matching user.",
        )
        return {"status": "ignored", "detail": "User not found"}

    latest_session = queries.get_latest_onboarding_session(user["id"])
    if not latest_session:
        _send_webhook_alert(
            subject="Aplite: Cal webhook session missing",
            body=f"User {email} has no onboarding session for event {event or 'unknown'}.",
        )
        return {"status": "ignored", "detail": "No onboarding session"}

    if event in CAL_VERIFY_EVENTS or (CAL_VERIFY_ON_CANCEL and event in CAL_CANCEL_EVENTS):
        try:
            upi = queries.complete_onboarding_and_issue_identifier(uuid.UUID(str(latest_session["id"])))
            return {"status": "VERIFIED", "upi": upi}
        except Exception as exc:
            logger.exception("Cal webhook verification failed")
            _send_webhook_alert(
                subject="Aplite: Cal webhook verification failed",
                body=f"Failed to verify user {email} for event {event or 'unknown'}: {exc}",
            )
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to complete verification") from exc

    return {"status": "acknowledged", "event": event or "unknown"}
