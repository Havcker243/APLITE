"""Onboarding flow routes and payload models.

Exposes endpoints for each onboarding step, file uploads, and the final
completion step that persists organizations, payment accounts, and
verification metadata.
"""

from __future__ import annotations

from datetime import date
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
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

from app.db import queries
from app.routes.auth import get_current_user
from app.utils.upi import generate_core_entity_id, generate_upi
from app.utils.ratelimit import RateLimit, check_rate_limit
import boto3
from botocore.client import Config as BotoConfig

router = APIRouter()
logger = logging.getLogger("aplite")

EIN_RE = re.compile(r"^\d{2}-\d{7}$")
DOMAIN_RE = re.compile(
    r"^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$"
)


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
    account_number: str = Field(min_length=4, max_length=34)
    ach_routing: str | None = Field(default=None, max_length=20)
    wire_routing: str | None = Field(default=None, max_length=34)
    swift: str | None = Field(default=None, max_length=20)

    @field_validator("account_number")
    @classmethod
    def validate_account_number(cls, value: str) -> str:
        value = value.strip().replace(" ", "")
        if not re.match(r"^[A-Z0-9]+$", value.upper()):
            raise ValueError("Account number must be alphanumeric.")
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

    @model_validator(mode="after")
    def validate_account_number_for_rail(self) -> "Step4Payload":
        if self.swift and self.account_number:
            return self
        if self.account_number and not self.account_number.isdigit():
            raise ValueError("Account number must be numeric for ACH or wire rails.")
        return self


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
    verification_method: str | None = Field(default=None, pattern=r"^(call|id|none)?$")
    id_document_id: str | None = None


class DraftPayload(BaseModel):
    step: int = Field(ge=1, le=4)
    data: dict
    completed: bool = False


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


@router.post("/onboarding/draft")
def onboarding_save_draft(payload: DraftPayload, user=Depends(get_current_user)):
    """
    Save onboarding draft data for a single step.

    Creates an onboarding session on first Step 1 save; later steps require an active session.
    """
    step = int(payload.step)
    session = queries.get_active_onboarding_session(user["id"])
    if session and str(session.get("state")) in ("PENDING_CALL", "PENDING_REVIEW", "VERIFIED"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Onboarding is already submitted.")

    requires_full = payload.completed or (step == 1 and not session)
    step_data = None
    if step not in (1, 2, 3, 4):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid step.")
    if requires_full:
        try:
            if step == 1:
                step_data = Step1Payload(**payload.data)
            elif step == 2:
                step_data = Step2Payload(**payload.data)
            elif step == 3:
                step_data = Step3Payload(**payload.data)
            elif step == 4:
                step_data = Step4Payload(**payload.data)
        except ValidationError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc

    session_id: uuid.UUID
    org_id: uuid.UUID
    if step == 1:
        if session and session.get("org_id"):
            org_id = uuid.UUID(str(session["org_id"]))
            session_id = uuid.UUID(str(session["id"]))
            if step_data is not None:
                queries.update_organization_step1(
                    org_id=org_id,
                    user_id=user["id"],
                    legal_name=step_data.legal_name.strip(),
                    dba=(step_data.dba or "").strip() or None,
                    ein=step_data.ein,
                    formation_date=step_data.formation_date,
                    formation_state=step_data.formation_state.strip(),
                    entity_type=step_data.entity_type.strip(),
                    address=step_data.address.model_dump(),
                    industry=step_data.industry.strip(),
                    website=step_data.website,
                    description=(step_data.description or "").strip() or None,
                )
        else:
            if step_data is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Complete required fields for Step 1 before saving a draft.",
                )
            org_id = uuid.uuid4()
            session_id = uuid.uuid4()
            queries.create_organization_step1(
                org_id=org_id,
                user_id=user["id"],
                legal_name=step_data.legal_name.strip(),
                dba=(step_data.dba or "").strip() or None,
                ein=step_data.ein,
                formation_date=step_data.formation_date,
                formation_state=step_data.formation_state.strip(),
                entity_type=step_data.entity_type.strip(),
                address=step_data.address.model_dump(),
                industry=step_data.industry.strip(),
                website=step_data.website,
                description=(step_data.description or "").strip() or None,
            )
            queries.create_onboarding_session(
                session_id=session_id,
                org_id=org_id,
                user_id=user["id"],
                state="DRAFT",
                current_step=1,
                address_locked=False,
            )
    else:
        if not session or not session.get("org_id"):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Start Step 1 before saving drafts.")
        org_id = uuid.UUID(str(session["org_id"]))
        session_id = uuid.UUID(str(session["id"]))

    existing_statuses = session.get("step_statuses") if isinstance(session, dict) else None
    step_statuses = dict(existing_statuses) if isinstance(existing_statuses, dict) else {}

    step_key = f"step{step}"
    if step_data is not None:
        step_statuses[step_key] = jsonable_encoder(step_data.model_dump())
    else:
        step_statuses[step_key] = jsonable_encoder(dict(payload.data))

    if step == 1 and step_data is not None:
        formation_docs = step_data.formation_documents or []
        step_statuses["formation_documents"] = [jsonable_encoder(doc.model_dump()) for doc in formation_docs]
    if step == 2 and step_data is not None:
        step_statuses["role"] = {"role": step_data.role, "title": step_data.title}

    completed_steps = step_statuses.get("completed_steps")
    if not isinstance(completed_steps, list):
        completed_steps = []
    if payload.completed and step not in completed_steps:
        completed_steps.append(step)
        completed_steps.sort()
    step_statuses["completed_steps"] = completed_steps

    current_step = int(session.get("current_step") or 1) if session else 1
    target_step = step + (1 if payload.completed else 0)
    current_step = max(current_step, target_step)
    if current_step > 5:
        current_step = 5

    updated = queries.update_onboarding_session(
        session_id,
        state="DRAFT",
        current_step=current_step,
        address_locked=bool(session.get("address_locked", False)) if session else False,
        step_statuses=step_statuses,
    )

    return {
        "session_id": str(session_id),
        "org_id": str(org_id),
        "current_step": int(updated.get("current_step") if updated else current_step),
        "step_statuses": step_statuses,
    }


@router.post("/onboarding/upload-id")
async def onboarding_upload_id(request: Request, file: UploadFile = File(...), user=Depends(get_current_user)):
    _enforce_rate_limit(
        request,
        key="onboarding_upload_id",
        limit=int(os.getenv("RL_ONBOARDING_UPLOAD_ID_LIMIT", "20")),
        window_seconds=int(os.getenv("RL_ONBOARDING_UPLOAD_ID_WINDOW_SECONDS", "3600")),
        user_id=int(user.get("id", 0) or 0),
    )
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing file.")
    content_type = (file.content_type or "").lower()
    if content_type not in ("image/jpeg", "image/png", "application/pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type. Use jpg, png, or pdf.")

    file_id, storage = await _store_uploaded_file(file, user_id=user["id"], doc_category="id_document")
    return {"file_id": file_id, "storage": storage}

@router.post("/onboarding/upload-formation")
async def onboarding_upload_formation(
    request: Request,
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    _enforce_rate_limit(
        request,
        key="onboarding_upload_formation",
        limit=int(os.getenv("RL_ONBOARDING_UPLOAD_FORMATION_LIMIT", "20")),
        window_seconds=int(os.getenv("RL_ONBOARDING_UPLOAD_FORMATION_WINDOW_SECONDS", "3600")),
        user_id=int(user.get("id", 0) or 0),
    )
    # Formation docs are keyed separately so we can validate entity-specific requirements.
    if doc_type not in {
        "articles_of_organization",
        "certificate_of_formation",
        "articles_of_incorporation",
        "certificate_of_limited_partnership",
        "partnership_equivalent",
    }:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported formation document type.")
    file_id, storage = await _store_uploaded_file(
        file,
        user_id=user["id"],
        file_id_prefix="form",
        key_prefix="formations",
        doc_category="formation_document",
        doc_type=doc_type,
    )
    return {"file_id": file_id, "storage": storage}


async def _store_uploaded_file(
    file: UploadFile,
    user_id: int,
    *,
    file_id_prefix: str = "id",
    key_prefix: str = "ids",
    doc_category: str | None = None,
    doc_type: str | None = None,
) -> tuple[str, str]:
    # Uploads are stored in S3-compatible storage; local fallback is disabled.
    # We always store metadata in Postgres to enforce ownership checks later.
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing file.")
    content_type = (file.content_type or "").lower()
    if content_type not in ("image/jpeg", "image/png", "application/pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type. Use jpg, png, or pdf.")

    file_id = f"{file_id_prefix}_{uuid.uuid4().hex}"

    # Read file into memory (max 10MB) for upload.
    max_bytes = 10 * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if data is None:
        data = b""
    if len(data) > max_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 10MB).")

    # Attempt to upload to S3-compatible storage; fallback to local disk.
    bucket = os.getenv("DATABASE_BUCKET_NAME")
    endpoint = os.getenv("DATABASE_BUCKET_S3_ENDPOINT")
    access_key = os.getenv("DATABASE_BUCKET_S3_ACCESS_KEY_ID")
    secret_key = os.getenv("DATABASE_BUCKET_S3_SECRET_ACCESS_KEY")
    region = os.getenv("DATABASE_BUCKET_S3_REGION", "us-east-1")
    key = f"{key_prefix}/{file_id}.bin"
    storage = "s3"
    if not (bucket and endpoint and access_key and secret_key):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="File storage is not configured.")
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
    except Exception as exc:
        logger.exception("Failed to upload ID document to Supabase storage: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to upload file.") from exc

    # Always store metadata locally to validate ownership and audit the upload.
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


def _enforce_rate_limit(request: Request, *, key: str, limit: int, window_seconds: int, user_id: int | None = None) -> None:
    if limit <= 0:
        return
    ip = (request.client.host if request.client else "unknown").strip()
    # Rate limit by IP plus user id to avoid shared IPs punishing each other.
    suffix = f"{ip}:{user_id}" if user_id is not None else ip
    ok, retry_after = check_rate_limit(f"{key}:{suffix}", RateLimit(limit=limit, window_seconds=window_seconds))
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Try again soon.",
            headers={"Retry-After": str(retry_after)},
        )




@router.post("/onboarding/complete")
async def onboarding_complete(
    request: Request,
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
    _enforce_rate_limit(
        request,
        key="onboarding_complete",
        limit=int(os.getenv("RL_ONBOARDING_COMPLETE_LIMIT", "5")),
        window_seconds=int(os.getenv("RL_ONBOARDING_COMPLETE_WINDOW_SECONDS", "3600")),
        user_id=int(user.get("id", 0) or 0),
    )

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
        file_id, _ = await _store_uploaded_file(file, user_id=user["id"], doc_category="id_document")

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

    active_session = queries.get_active_onboarding_session(user["id"])
    existing_session_id = None
    existing_org_id = None
    if active_session:
        state = str(active_session.get("state") or "")
        if state in ("PENDING_CALL", "PENDING_REVIEW", "VERIFIED"):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Onboarding is already submitted.")
        if active_session.get("org_id"):
            existing_session_id = uuid.UUID(str(active_session["id"]))
            existing_org_id = uuid.UUID(str(active_session["org_id"]))

    try:
        # Step 3: identity validation
        if not payload.identity.attestation:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attestation is required.")
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
        # This keeps partial onboarding data from being written if any step fails.
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
            existing_session_id=existing_session_id,
            existing_org_id=existing_org_id,
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

    return _verify_org(org)


@router.post("/api/admin/orgs/upi/{org_upi}/verify")
def admin_verify_org_by_upi(
    org_upi: str,
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
):
    """
    Manual verification endpoint (MVP) by UPI.
    """
    expected_key = os.getenv("ADMIN_API_KEY") or ""
    if not expected_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Admin verification is not configured.")
    if x_admin_key != expected_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid admin key.")

    org = queries.get_organization_by_upi(org_upi)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    return _verify_org(org)


@router.post("/api/admin/users/master-upi/{master_upi}/verify")
def admin_verify_by_master_upi(
    master_upi: str,
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
):
    """
    Manual verification endpoint (MVP) by user master UPI.
    """
    expected_key = os.getenv("ADMIN_API_KEY") or ""
    if not expected_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Admin verification is not configured.")
    if x_admin_key != expected_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid admin key.")

    user = queries.get_user_by_master_upi(master_upi)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    session = queries.get_latest_onboarding_session(user["id"])
    if not session or not session.get("org_id"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Onboarding session not found.")

    org = queries.get_organization(str(session["org_id"]), user["id"])
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    return _verify_org(org)


def _verify_org(org: dict):
    org_id = str(org.get("id"))
    if not org_id:
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
    return {"status": "VERIFIED", "org_id": org_id, "upi": upi}
