import asyncio
import logging
import os
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.db.connection import request_connection
from app.routes.auth import router as auth_router
from app.routes.accounts import router as accounts_router
from app.routes.resolve import router as resolve_router
from app.routes.public import router as public_router
from app.routes.onboarding import router as onboarding_router

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(resolve_router)
app.include_router(auth_router)
app.include_router(accounts_router)
app.include_router(public_router)
app.include_router(onboarding_router)

logger = logging.getLogger("aplite")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)


@app.middleware("http")
async def logging_timeout_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    start = time.perf_counter()
    timeout = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "30"))
    try:
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
async def db_connection_middleware(request: Request, call_next):
    # Use one pooled DB connection per request to reduce pool churn.
    with request_connection():
        return await call_next(request)


@app.get("/health")
def health_check():
    return {"status": "ok"}
