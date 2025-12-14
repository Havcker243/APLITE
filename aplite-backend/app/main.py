from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.auth import router as auth_router
from app.routes.business import router as business_router
from app.routes.resolve import router as resolve_router

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
app.include_router(business_router)
app.include_router(resolve_router)
app.include_router(auth_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
