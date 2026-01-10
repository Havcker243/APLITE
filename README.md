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
- `ADMIN_API_KEY` (required for admin verification endpoints)
- `CSRF_SECRET_KEY` (recommended; signs CSRF tokens)
- Optional email: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- Optional rate limits:
  - `RL_GLOBAL_LIMIT`, `RL_GLOBAL_WINDOW_SECONDS`
  - `RL_RESOLVE_LIMIT`, `RL_RESOLVE_WINDOW_SECONDS`
  - `RL_UPI_LOOKUP_LIMIT`, `RL_UPI_LOOKUP_WINDOW_SECONDS`
  - `RL_UPI_MASTER_LOOKUP_LIMIT`, `RL_UPI_MASTER_LOOKUP_WINDOW_SECONDS`
  - `RL_ONBOARDING_UPLOAD_ID_LIMIT`, `RL_ONBOARDING_UPLOAD_ID_WINDOW_SECONDS`
  - `RL_ONBOARDING_UPLOAD_FORMATION_LIMIT`, `RL_ONBOARDING_UPLOAD_FORMATION_WINDOW_SECONDS`
  - `RL_ONBOARDING_COMPLETE_LIMIT`, `RL_ONBOARDING_COMPLETE_WINDOW_SECONDS`
  - `RL_ACCOUNTS_CREATE_LIMIT`, `RL_ACCOUNTS_CREATE_WINDOW_SECONDS`
  - `RL_CHILD_UPI_CREATE_LIMIT`, `RL_CHILD_UPI_CREATE_WINDOW_SECONDS`
  - `RL_PUBLIC_CLIENTS_LIMIT`, `RL_PUBLIC_CLIENTS_WINDOW_SECONDS`

### Frontend (`aplite-frontend/.env.local`)
- `NEXT_PUBLIC_API_URL` (defaults to `http://127.0.0.1:8000`)

## Key routes (backend)
- Auth: `POST /api/auth/signup`, `POST /api/auth/login/start`, `POST /api/auth/login/verify`, `POST /api/auth/logout`
- Profile: `GET /api/profile`, `PUT /api/profile`
- Onboarding: `GET /onboarding/current`, `POST /onboarding/draft`, `POST /onboarding/complete`, `POST /onboarding/upload-id`, `POST /onboarding/upload-formation`
- Onboarding (utility): `POST /onboarding/reset`, `GET /api/profile/details`, `PUT /api/profile/onboarding`
- Payment accounts: `GET /api/accounts`, `POST /api/accounts`, `PUT /api/accounts/{id}` (rail fields lock once linked to a UPI)
- Child UPIs: `POST /api/orgs/child-upi`, `GET /api/orgs/child-upis` (supports `limit` + `before`), `POST /api/orgs/child-upis/{id}/disable`, `POST /api/orgs/child-upis/{id}/reactivate`
- Resolve: `POST /api/resolve`, `POST /api/upi/lookup`
- Public clients: `GET /api/public/clients`
- Admin verification: `POST /api/admin/orgs/{org_id}/verify`, `POST /api/admin/orgs/upi/{org_upi}/verify`, `POST /api/admin/users/master-upi/{master_upi}/verify`
- Admin review queue: `GET /api/admin/verification/queue`, `GET /api/admin/verification/{session_id}`, `POST /api/admin/verification/{session_id}/approve`, `POST /api/admin/verification/{session_id}/reject`

## Verification flow (MVP)
- Owners complete onboarding and schedule a verification call (out of band).
- All submissions move to `PENDING_REVIEW` (or `PENDING_CALL`) until admin review.
- The UI shows a pending screen that polls until the backend flips to `VERIFIED`.
- An admin uses the verification endpoints to approve/reject and issue the org UPI (rejections require a reason).
 - Draft progress is saved server-side and returned by `/onboarding/current`.

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

## Product docs
- `docs/PRODUCT_UI_SPEC.md`
