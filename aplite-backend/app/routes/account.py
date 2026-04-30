"""Account self-service routes: data export and account deletion."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from app.db import queries
from app.routes.auth import get_current_user

router = APIRouter()
logger = logging.getLogger("aplite")


@router.get("/api/account/export")
def export_account_data(user=Depends(get_current_user)):
    """Return a full export of the authenticated user's data as JSON.

    Excludes encrypted payment rail fields (those are behind the resolve flow).
    """
    user_id = int(user.get("id", 0) or 0)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    data = queries.export_user_data(user_id)
    return JSONResponse(
        content=data,
        headers={
            "Content-Disposition": "attachment; filename=aplite-data-export.json",
            "Content-Type": "application/json",
        },
    )


@router.delete("/api/account")
def delete_account(user=Depends(get_current_user)):
    """Permanently delete the authenticated user's account and all associated data.

    This action is irreversible. The caller must re-authenticate after deletion
    since their session will no longer be valid.
    Note: the Supabase auth user record is separate and should be deleted via
    the Supabase dashboard or admin API.
    """
    user_id = int(user.get("id", 0) or 0)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    logger.info("account deletion requested", extra={"user_id": user_id})
    queries.delete_user_data(user_id)

    return {"status": "deleted", "message": "Your account and all associated data have been removed."}
