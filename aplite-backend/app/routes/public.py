import logging
from fastapi import APIRouter, Query

from app.db import queries

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/api/public/clients")
def list_public_clients(search: str | None = Query(default=None, max_length=120), limit: int = Query(default=50, ge=1, le=200)):
    """Public directory of verified clients; supports a simple `search` filter."""
    try:
        return queries.list_public_clients(search=search, limit=limit)
    except Exception:
        logger.exception("Failed to list public clients")
        return []
