"""Public, unauthenticated endpoints.

Provides a read-only directory of verified clients for public lookup and
basic health-style visibility into the onboarding funnel.
"""

import logging
import os
from fastapi import APIRouter, HTTPException, Query, Request, status

from app.db import queries
from app.utils.ratelimit import RateLimit, check_rate_limit

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/api/public/clients")
def list_public_clients(
    request: Request,
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Public directory of verified clients; supports a simple `search` filter."""
    # Public directory is read-only but rate-limited to reduce scraping.
    limit_value = int(os.getenv("RL_PUBLIC_CLIENTS_LIMIT", "120"))
    window_seconds = int(os.getenv("RL_PUBLIC_CLIENTS_WINDOW_SECONDS", "60"))
    if limit_value > 0:
        ip = (request.client.host if request.client else "unknown").strip()
        ok, retry_after = check_rate_limit(f"public_clients:{ip}", RateLimit(limit=limit_value, window_seconds=window_seconds))
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Try again soon.",
                headers={"Retry-After": str(retry_after)},
            )
    try:
        return queries.list_public_clients(search=search, limit=limit)
    except Exception:
        logger.exception("Failed to list public clients")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Public directory unavailable")
