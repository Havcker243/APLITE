from fastapi import APIRouter, Query

from app.db import queries

router = APIRouter()


@router.get("/api/public/clients")
def list_public_clients(search: str | None = Query(default=None, max_length=120), limit: int = Query(default=50, ge=1, le=200)):
    return queries.list_public_clients(search=search, limit=limit)
