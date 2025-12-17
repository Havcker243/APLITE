from fastapi import APIRouter, Query

from app.db import queries

router = APIRouter()


@router.get("/api/public/clients")
def list_public_clients(search: str | None = Query(default=None, max_length=120), limit: int = Query(default=50, ge=1, le=200)):
    results = []
    for biz in queries.list_businesses():
        if biz.get("status") == "deactivated":
            continue
        owner = queries.get_user_by_id(biz.get("user_id")) or {}
        if owner.get("id") and not queries.is_user_verified(int(owner["id"])):
            continue
        display_name = owner.get("company_name") or biz.get("legal_name") or ""
        if search and search.lower() not in display_name.lower():
            continue
        results.append(
            {
                "id": biz.get("id"),
                "legal_name": biz.get("legal_name"),
                "company_name": display_name,
                "country": biz.get("country"),
                "state": owner.get("state"),
                "summary": owner.get("summary") or "",
                "established_year": owner.get("established_year"),
                "status": biz.get("status", "active"),
                "website": biz.get("website"),
            }
        )
        if len(results) >= limit:
            break
    return results
