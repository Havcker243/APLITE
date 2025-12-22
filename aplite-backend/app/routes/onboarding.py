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

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, Form
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field, field_validator

from app.db import queries
from app.routes.auth import get_current_user
from app.utils.upi import generate_core_entity_id, generate_upi
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

    # Handle ID document (uploaded file takes precedence).
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

    # Basic role/risk determination and verification method
    risk_level = "low" if payload.role.role == "owner" else "high"
    # Default verification path: owners go through a call; reps provide ID.
    verification_method = payload.verification_method or ("call" if payload.role.role == "owner" else "id")

    org_id = uuid.uuid4()
    session_id = uuid.uuid4()
    verification_status = "verified"
    if verification_method == "call":
        # TODO: once call scheduling is integrated, keep status pending until call completion.
        verification_status = "pending_call"

    try:
        # Step 1: organization
        queries.create_organization_step1(
            org_id=org_id,
            user_id=user["id"],
            legal_name=payload.org.legal_name.strip(),
            dba=(payload.org.dba or "").strip() or None,
            ein=payload.org.ein,
            formation_date=payload.org.formation_date,
            formation_state=payload.org.formation_state.strip(),
            entity_type=payload.org.entity_type.strip(),
            address=payload.org.address.model_dump(),
            industry=payload.org.industry.strip(),
            website=payload.org.website,
            description=(payload.org.description or "").strip() or None,
        )

        # Step 2: role
        queries.create_onboarding_session(
            session_id=session_id,
            org_id=org_id,
            user_id=user["id"],
            state="STEP_2_COMPLETE",
            current_step=3,
            address_locked=True,
        )
        if formation_docs:
            queries.set_onboarding_formation_documents(
                session_id=session_id,
                documents=[doc.model_dump() for doc in formation_docs],
            )
        queries.update_onboarding_role(
            session_id=session_id,
            user_id=user["id"],
            role=payload.role.role,
            title=payload.role.title,
            risk_level=risk_level,
        )

        # Step 3: identity
        require_document = verification_method != "call"
        if require_document and not file_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload a government ID document.")
        if file_id:
            if not queries.onboarding_file_exists(file_id=file_id, user_id=user["id"]):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document reference. Please re-upload.")
        verification_id = uuid.uuid4()
        queries.create_identity_verification(
            verification_id=verification_id,
            session_id=session_id,
            org_id=org_id,
            user_id=user["id"],
            full_name=payload.identity.full_name.strip(),
            title=(payload.identity.title or "").strip() or None,
            id_document_id=file_id or "call_verification",
            attestation=payload.identity.attestation,
            status="pending",
        )

        # Step 4: bank account
        if not (payload.bank.ach_routing or payload.bank.wire_routing or payload.bank.swift):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide at least one rail (ACH routing, wire routing, or SWIFT).",
            )
        rail = "ACH" if payload.bank.ach_routing else ("WIRE_DOM" if payload.bank.wire_routing else "SWIFT")
        payment_account_id = queries.create_payment_account(
            user_id=user["id"],
            org_id=str(org_id),
            rail=rail,
            bank_name=payload.bank.bank_name.strip(),
            account_name=payload.org.legal_name.strip(),
            ach_routing=payload.bank.ach_routing if rail == "ACH" else None,
            ach_account=payload.bank.account_number if rail == "ACH" else None,
            wire_routing=payload.bank.wire_routing if rail == "WIRE_DOM" else None,
            wire_account=payload.bank.account_number if rail == "WIRE_DOM" else None,
            bank_address=None,
            swift_bic=payload.bank.swift if rail == "SWIFT" else None,
            iban=payload.bank.account_number if rail == "SWIFT" else None,
            bank_country=None,
            bank_city=None,
            status="active",
        )

        # Issue UPI immediately (no gating in this flow).
        core_id = generate_core_entity_id()
        parent_upi = user.get("master_upi") or ""
        if not parent_upi:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Missing master UPI for user.")
        upi = generate_upi(core_id, payment_index=1, user_id=user["id"])
        queries.set_organization_upi(str(org_id), upi, payment_account_id, verification_status="verified", status="active")

        # NOTE: We still advance to VERIFIED for now to keep the flow unblocked; call/doc gating can change this later.
        queries.advance_onboarding_session(session_id=session_id, state="VERIFIED", next_step=5)
        queries.set_onboarding_payment_account(session_id=session_id, payment_account_id=payment_account_id)

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
        "status": "PENDING_CALL" if verification_method == "call" else "VERIFIED",
        "org_id": str(org_id),
        "session_id": str(session_id),
        "upi": upi,
        "payment_account_id": payment_account_id,
    }
