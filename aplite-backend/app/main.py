"""FastAPI application setup for the Aplite backend.

Defines middleware, routers, and cross-cutting concerns like timeouts,
rate limiting, and DB connection handling.
"""

import asyncio
import logging
import os
import time
import uuid

from dotenv import load_dotenv

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.db.connection import request_connection
from app.routes.auth import router as auth_router
from app.routes.accounts import router as accounts_router
from app.routes.resolve import router as resolve_router
from app.routes.public import router as public_router
from app.routes.onboarding import router as onboarding_router
from app.routes.admin import router as admin_router
from app.utils.ratelimit import RateLimit, check_rate_limit

load_dotenv()

app = FastAPI()
default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
env_origins = os.getenv("FRONTEND_ORIGINS", "")
extra_origins = [origin.strip() for origin in env_origins.split(",") if origin.strip()]
allow_origins = list(dict.fromkeys(default_origins + extra_origins))
allow_origin_regex = os.getenv("FRONTEND_ORIGIN_REGEX") or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(resolve_router)
app.include_router(auth_router)
app.include_router(accounts_router)
app.include_router(public_router)
app.include_router(onboarding_router)
app.include_router(admin_router)

logger = logging.getLogger("aplite")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)


@app.middleware("http")
async def logging_timeout_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    start = time.perf_counter()
    timeout = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "30"))
    try:
        # Hard timeout keeps slow upstream calls from tying up workers.
        response = await asyncio.wait_for(call_next(request), timeout=timeout if timeout > 0 else None)
    except asyncio.TimeoutError:
        logger.warning("request timeout", extra={"path": request.url.path, "method": request.method, "request_id": request_id})
        return JSONResponse(status_code=504, content={"detail": "Request timed out", "request_id": request_id})
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "request",
        extra={
            "path": request.url.path,
            "method": request.method,
            "status": getattr(response, "status_code", "unknown"),
            "duration_ms": round(duration_ms, 2),
            "request_id": request_id,
        },
    )
    response.headers["X-Request-ID"] = request_id
    return response


@app.middleware("http")
async def global_rate_limit_middleware(request: Request, call_next):
    limit = int(os.getenv("RL_GLOBAL_LIMIT", "0"))
    window_seconds = int(os.getenv("RL_GLOBAL_WINDOW_SECONDS", "60"))
    if limit > 0:
        ip = (request.client.host if request.client else "unknown").strip()
        ok, retry_after = check_rate_limit(f"global:ip:{ip}", RateLimit(limit=limit, window_seconds=window_seconds))
        if not ok:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Try again soon."},
                headers={"Retry-After": str(retry_after)},
            )
    return await call_next(request)


@app.middleware("http")
async def db_connection_middleware(request: Request, call_next):
    # Skip DB checkout for health checks and preflight requests.
    if request.method == "OPTIONS" or request.url.path == "/health":
        return await call_next(request)
    # Use one pooled DB connection per request to reduce pool churn.
    with request_connection():
        return await call_next(request)


@app.get("/health")
def health_check():
    return {"status": "ok"}
