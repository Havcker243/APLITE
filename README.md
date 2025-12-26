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
psql "$DATABASE_URL" -f ../schema-final.sql
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
- `CAL_WEBHOOK_SECRET` (optional; verify Cal.com webhook signatures for call completion)
- `WEBHOOK_ALERT_EMAIL` (optional; send webhook failures to this email via SendGrid)
- Optional email: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`

### Frontend (`aplite-frontend/.env.local`)
- `NEXT_PUBLIC_API_URL` (defaults to `http://127.0.0.1:8000`)

## Key routes (backend)
- Auth: `POST /api/auth/signup`, `POST /api/auth/login/start`, `POST /api/auth/login/verify`, `POST /api/auth/logout`
- Profile: `GET /api/profile`, `PUT /api/profile`
- Onboarding: `GET /onboarding/current`, `POST /onboarding/complete`, `POST /onboarding/upload-id`, `POST /onboarding/upload-formation`
- Onboarding (utility): `POST /onboarding/reset`, `GET /api/profile/details`, `PUT /api/profile/onboarding`
- Payment accounts: `GET /api/accounts`, `POST /api/accounts`, `PUT /api/accounts/{id}` (rail fields lock once linked to a UPI)
- Child UPIs: `POST /api/orgs/child-upi`, `GET /api/orgs/child-upis` (supports `limit` + `before`), `POST /api/orgs/child-upis/{id}/disable`, `POST /api/orgs/child-upis/{id}/reactivate`
- Businesses: `GET /api/businesses`, `POST /api/businesses`, `POST /api/businesses/{id}/deactivate`
- Resolve: `POST /api/resolve`, `POST /api/upi/lookup`
- Public clients: `GET /api/public/clients`
- Webhooks: `POST /webhooks/cal` (Cal.com booking events; completes verification on call completion)

## Verification flow (MVP)
- Owners complete onboarding and schedule a verification call (Cal.com).
- After booking, the UI shows a pending screen that polls until the backend flips to `VERIFIED`.
- Cal webhook (`/webhooks/cal`) marks the session `VERIFIED` on call-completed events.

## Account rail lock rules
- Payment accounts can be edited until they are linked to a UPI.
- Once linked to a child/org UPI, rail fields are read-only (create a new account to change rail details).
- Cosmetic fields (e.g. `bank_name`, `account_name`) remain editable.

## Child UPI pagination
`GET /api/orgs/child-upis` supports cursor pagination:
```bash
curl "$API_URL/api/orgs/child-upis?limit=10"
curl "$API_URL/api/orgs/child-upis?limit=10&before=2025-01-01T00:00:00Z"
```

## Webhook notes
- Cal webhook signature header: `X-Cal-Signature`
- Secrets/env:
  - `CAL_WEBHOOK_SECRET` to verify signature
  - `WEBHOOK_ALERT_EMAIL` to receive webhook failure alerts (SendGrid required)

## Product docs
- `docs/PRODUCT_UI_SPEC.md`
