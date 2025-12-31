"""Admin verification queue and decision routes.

Serves the review queue for onboarding sessions and supports approving or
rejecting pending verifications with audit metadata.
"""

import os
import uuid
import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Response, status

from app.db import queries
from app.db.connection import get_connection

router = APIRouter()
logger = logging.getLogger("aplite")


def _require_admin_key(x_admin_key: str | None) -> None:
    # MVP guard: shared admin key in header (not a full auth system).
    expected_key = os.getenv("ADMIN_API_KEY") or ""
    if not expected_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Admin verification is not configured.")
    if x_admin_key != expected_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid admin key.")


def _verification_method_from_session(session: dict) -> str:
    # Prefer stored method in step_statuses; fallback to state for older sessions.
    step_statuses = session.get("step_statuses") if isinstance(session, dict) else None
    if isinstance(step_statuses, dict):
        method = step_statuses.get("verification_method")
        if isinstance(method, str) and method:
            return method
    state = str(session.get("state") or "")
    return "call" if state == "PENDING_CALL" else "id"


@router.get("/api/admin/verification/queue")
def list_verification_queue(x_admin_key: str | None = Header(default=None, alias="X-Admin-Key")):
    _require_admin_key(x_admin_key)
    # Queue is built from onboarding sessions in PENDING_* states.
    rows = queries.list_pending_verification_queue()
    results: list[dict[str, Any]] = []
    for row in rows:
        results.append(
            {
                "session_id": str(row.get("id")),
                "org_id": str(row.get("org_id")),
                "user_id": row.get("user_id"),
                "state": row.get("state"),
                "current_step": row.get("current_step"),
                "risk_level": row.get("risk_level"),
                "last_saved_at": row.get("last_saved_at").isoformat() if row.get("last_saved_at") else None,
                "org": {
                    "legal_name": row.get("legal_name"),
                    "verification_status": row.get("org_verification_status"),
                    "status": row.get("org_status"),
                },
                "user": {
                    "email": row.get("email"),
                    "first_name": row.get("first_name"),
                    "last_name": row.get("last_name"),
                },
                "method": _verification_method_from_session(row),
            }
        )
    return results


@router.get("/api/admin/verification/{session_id}")
def get_verification_detail(
    session_id: str,
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
):
    _require_admin_key(x_admin_key)
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session id") from exc

    session = queries.get_onboarding_session_by_id(session_uuid)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Onboarding session not found")

    org = queries.get_organization_by_id(str(session.get("org_id")))
    user = queries.get_user_by_id(int(session.get("user_id") or 0))
    # Pull all related onboarding artifacts for review in a single response.
    identity = queries.get_identity_verification_by_session(session_uuid) or {}
    payment_account_id = queries.get_onboarding_payment_account(session_uuid)
    payment_account = queries.get_payment_account_by_id(int(payment_account_id)) if payment_account_id else None
    latest_review = queries.get_latest_verification_review(session_uuid)
    reviews = queries.list_verification_reviews(session_uuid)

    step_statuses = session.get("step_statuses") if isinstance(session, dict) else {}
    formation_docs = []
    if isinstance(step_statuses, dict):
        formation_docs = step_statuses.get("formation_documents") or []

    def _doc_meta(file_id: str, doc_type: str | None = None) -> dict:
        meta = queries.get_onboarding_file_metadata(file_id) or {}
        return {
            "file_id": file_id,
            "doc_type": doc_type,
            "filename": meta.get("filename"),
            "content_type": meta.get("content_type"),
        }

    identity_doc = None
    id_file_id = identity.get("id_document_id") if isinstance(identity, dict) else None
    if isinstance(id_file_id, str):
        identity_doc = _doc_meta(id_file_id, doc_type="id_document")

    formation_files = []
    for doc in formation_docs:
        if isinstance(doc, dict) and isinstance(doc.get("file_id"), str):
            formation_files.append(_doc_meta(doc["file_id"], doc_type=doc.get("doc_type")))

    return {
        "session": session,
        "org": org,
        "user": user,
        "identity": identity,
        "payment_account": payment_account,
        "method": _verification_method_from_session(session),
        "formation_documents": formation_files,
        "identity_document": identity_doc,
        "latest_review": latest_review,
        "reviews": reviews,
    }


@router.get("/api/admin/verification/file/{file_id}")
def get_verification_file(
    file_id: str,
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
):
    _require_admin_key(x_admin_key)
    # Stream file bytes from storage (S3 or local) for in-browser review.
    payload = queries.get_onboarding_file_bytes(file_id)
    if not payload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    data, content_type, filename = payload
    headers = {}
    if filename:
        headers["Content-Disposition"] = f"inline; filename=\"{filename}\""
    return Response(content=data, media_type=content_type or "application/octet-stream", headers=headers)


@router.post("/api/admin/verification/{session_id}/approve")
def approve_verification(
    session_id: str,
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
):
    _require_admin_key(x_admin_key)
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session id") from exc

    session = queries.get_onboarding_session_by_id(session_uuid)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Onboarding session not found")

    # Approval is the source of truth: finalize onboarding, mark VERIFIED, and issue org UPI.
    upi = queries.complete_onboarding_and_issue_identifier(session_uuid)
    method = _verification_method_from_session(session)
    queries.create_verification_review(
        review_id=uuid.uuid4(),
        session_id=session_uuid,
        org_id=uuid.UUID(str(session["org_id"])),
        user_id=int(session["user_id"]),
        method=method,
        status="approved",
        reason=None,
        reviewed_by=None,
    )
    return {"status": "VERIFIED", "upi": upi}


@router.post("/api/admin/verification/{session_id}/reject")
def reject_verification(
    session_id: str,
    payload: dict,
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
):
    _require_admin_key(x_admin_key)
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session id") from exc

    session = queries.get_onboarding_session_by_id(session_uuid)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Onboarding session not found")

    reason = (payload or {}).get("reason")
    reason_value = str(reason).strip() if reason else None
    if not reason_value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rejection reason required")

    # Rejection updates both org status and session state for consistent UI behavior.
    org_id = str(session.get("org_id"))
    queries.set_organization_verification_status(org_id, verification_status="rejected", status="rejected")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update onboarding_sessions set state='REJECTED', last_saved_at=now() where id = %s",
                (str(session_uuid),),
            )
            conn.commit()

    method = _verification_method_from_session(session)
    queries.create_verification_review(
        review_id=uuid.uuid4(),
        session_id=session_uuid,
        org_id=uuid.UUID(org_id),
        user_id=int(session["user_id"]),
        method=method,
        status="rejected",
        reason=reason_value,
        reviewed_by=None,
    )
    return {"status": "REJECTED"}
