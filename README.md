# APLITE

Aplite is a small full-stack MVP for:
- onboarding businesses,
- attaching payout rails (ACH / WIRE_DOM / SWIFT) to payment accounts,
- issuing short UPI identifiers,
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
- `SESSION_TTL_HOURS` (optional; default `168` = 7 days)
- Optional email: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`

### Frontend (`aplite-frontend/.env.local`)
- `NEXT_PUBLIC_API_URL` (defaults to `http://127.0.0.1:8000`)

## Key routes (backend)
- Auth: `POST /api/auth/signup`, `POST /api/auth/login/start`, `POST /api/auth/login/verify`, `POST /api/auth/logout`
- Profile: `GET /api/profile`, `PUT /api/profile`
- Onboarding: `GET /onboarding/current`, `POST /onboarding/step-1..4`, `POST /verify/send-otp`, `POST /verify/confirm-otp`, `GET /verify/available-slots`, `POST /verify/schedule-call`, `POST /verify/complete-call`
- Payment accounts: `GET /api/accounts`, `POST /api/accounts`
- Businesses: `GET /api/businesses`, `POST /api/businesses`, `POST /api/businesses/{id}/deactivate`
- Resolve: `POST /api/resolve`
- Public clients: `GET /api/public/clients`

## Product docs
- `docs/PRODUCT_UI_SPEC.md`
