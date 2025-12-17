# APLITE

Aplite is a small full-stack MVP for:
- onboarding businesses,
- attaching payout rails (ACH / WIRE_DOM / SWIFT) to payment accounts,
- issuing short “UPI” identifiers,
- resolving a UPI into payout coordinates + public company profile info.

## Repo structure
- `aplite-backend/`: FastAPI + Postgres API
- `aplite-frontend/`: Next.js (pages router) web UI
- `docs/`: product/UI specs and notes

## Quickstart (local)

### 1) Backend
From `aplite-backend/`:

```bash
pip install -r requirements-backend.txt
psql "$DATABASE_URL" -f data/schema.sql
uvicorn app.main:app --reload
```

Backend runs on `http://127.0.0.1:8000`.

### 2) Frontend
From `aplite-frontend/`:

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Environment variables

### Backend (`aplite-backend/.env`)
- `DATABASE_URL` (Postgres connection string; Supabase works)
- `ENCRYPTION_KEY` (16/24/32 bytes; used for encrypting payment coordinates at rest)
- `UPI_SECRET_KEY` (HMAC secret for UPI namespace/signature)
- Optional email: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`

### Frontend (`aplite-frontend/.env.local`)
- `NEXT_PUBLIC_API_URL` (defaults to `http://127.0.0.1:8000`)

## Product docs
- `docs/PRODUCT_UI_SPEC.md`

