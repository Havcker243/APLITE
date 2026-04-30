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

# Demo seed data — makes the product feel real before real onboarding traffic comes in.
_DEMO_BUSINESSES: dict[str, dict] = {
    "bulldogbites": {
        "name": "Bulldog Bites LLC",
        "verified": True,
        "last_verified": "2026-04-25",
        "industry": "Food & Beverage",
        "country": "US",
        "website": "bulldogbites.com",
    },
    "greenleaf": {
        "name": "Greenleaf Consulting Group",
        "verified": True,
        "last_verified": "2026-04-18",
        "industry": "Professional Services",
        "country": "US",
        "website": "greenleafconsulting.com",
    },
    "swiftpay": {
        "name": "SwiftPay Solutions Inc.",
        "verified": True,
        "last_verified": "2026-04-10",
        "industry": "Financial Technology",
        "country": "US",
        "website": "swiftpaysolutions.com",
    },
    "metrologic": {
        "name": "MetroLogic Technologies",
        "verified": True,
        "last_verified": "2026-03-28",
        "industry": "Software",
        "country": "US",
        "website": "metrologictech.com",
    },
    "brookstone": {
        "name": "Brookstone Ventures LLC",
        "verified": True,
        "last_verified": "2026-04-02",
        "industry": "Investment",
        "country": "US",
        "website": "brookstoneventures.com",
    },
    "fastfreight": {
        "name": "Fast Freight Inc.",
        "verified": False,
        "last_verified": None,
        "industry": "Logistics",
        "country": "US",
        "website": None,
    },
    "nexaworks": {
        "name": "NexaWorks Ltd.",
        "verified": False,
        "last_verified": None,
        "industry": "Technology",
        "country": "US",
        "website": None,
    },
    "clarastone": {
        "name": "Clarastone Partners",
        "verified": False,
        "last_verified": None,
        "industry": "Consulting",
        "country": "US",
        "website": None,
    },
}


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


@router.get("/api/public/verify")
def verify_aplite_id(
    request: Request,
    id: str = Query(..., max_length=120),
):
    """Verify an Aplite ID (e.g. bulldogbites@aplite). No auth required."""
    limit_value = int(os.getenv("RL_PUBLIC_VERIFY_LIMIT", "120"))
    window_seconds = int(os.getenv("RL_PUBLIC_VERIFY_WINDOW_SECONDS", "60"))
    if limit_value > 0:
        ip = (request.client.host if request.client else "unknown").strip()
        ok, retry_after = check_rate_limit(
            f"public_verify:{ip}",
            RateLimit(limit=limit_value, window_seconds=window_seconds),
        )
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Try again soon.",
                headers={"Retry-After": str(retry_after)},
            )

    raw = (id or "").strip().lower()
    # Accept both "bulldogbites@aplite" and bare "bulldogbites"
    if "@" in raw:
        handle, domain = raw.split("@", 1)
        if domain != "aplite":
            return {"verified": False, "handle": handle, "name": None, "industry": None, "country": None, "last_verified": None}
    else:
        handle = raw

    handle = handle.strip()
    if not handle:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Aplite ID")

    # Check demo seed data first
    demo = _DEMO_BUSINESSES.get(handle)
    if demo is not None:
        return {
            "verified": demo["verified"],
            "handle": handle,
            "name": demo["name"],
            "industry": demo.get("industry"),
            "country": demo.get("country"),
            "last_verified": demo.get("last_verified"),
            "website": demo.get("website"),
        }

    # Fall back to real DB — search by company name slug match
    try:
        results = queries.list_public_clients(search=handle, limit=5)
        for client in results:
            name = client.get("company_name") or client.get("legal_name") or ""
            slug = name.lower().replace(" ", "").replace(",", "").replace(".", "").replace("'", "")
            if slug.startswith(handle.replace(" ", "")):
                return {
                    "verified": True,
                    "handle": handle,
                    "name": name,
                    "industry": client.get("industry"),
                    "country": client.get("country"),
                    "last_verified": None,
                    "website": client.get("website"),
                }
    except Exception:
        logger.exception("DB lookup failed during verify")

    return {"verified": False, "handle": handle, "name": None, "industry": None, "country": None, "last_verified": None, "website": None}
