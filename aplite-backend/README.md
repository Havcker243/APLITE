# Aplite Backend (MVP)

FastAPI service for onboarding businesses, managing payment accounts, issuing UPIs, and resolving payment details.

## Environment
- Python 3.11+ (system or venv)
- Postgres: set `DATABASE_URL` (Supabase URL works)
- Secrets: `ENCRYPTION_KEY`, `UPI_SECRET_KEY` (already in your `.env`; not modified here)
- Sessions: `SESSION_TTL_HOURS` (optional; default `168` = 7 days)
- Cal.com webhook (optional): `CAL_WEBHOOK_SECRET` for verifying webhook signatures
- Webhook alerts (optional): `WEBHOOK_ALERT_EMAIL` (send failures to this email via SendGrid)
- Email (optional): `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` to send OTP emails via SendGrid; otherwise emails log to stdout.

## Install (backend-only)
```bash
pip install -r requirements-backend.txt
```

## Database schema
Apply the current schema (matches Supabase snapshot):
```bash
psql "$DATABASE_URL" -f ../schema-final.sql
```

> Note: `aplite-backend/data/schema.sql` is an older draft and is missing columns used by onboarding (e.g., `organizations.upi`, `verification_status`, `status`, `sessions.expires_at`). Always use `schema-final.sql`.

## Run the server
```bash
uvicorn app.main:app --reload
```
Run from the repo root so `app` is on the import path. If needed, set `PYTHONPATH=.`.

## Key routes
- Auth: `/api/auth/signup`, `/api/auth/login/start`, `/api/auth/login/verify`, `/api/auth/logout`
- Profile: `GET/PUT /api/profile`
- Profile (extended): `GET /api/profile/details`, `PUT /api/profile/onboarding`
- Onboarding: `/onboarding/current`, `/onboarding/complete`, `/onboarding/upload-id`, `/onboarding/upload-formation`, `/onboarding/reset`
- Payment accounts: `/api/accounts` (list/create), `PUT /api/accounts/{id}` (rail fields lock once linked to a UPI)
- Child UPIs: `/api/orgs/child-upi`, `/api/orgs/child-upis` (supports `limit` + `before`), `/api/orgs/child-upis/{id}/disable`, `/api/orgs/child-upis/{id}/reactivate`
- Businesses: `/api/businesses` (create/list), `/api/businesses/{id}/deactivate`
- Resolve UPI: `/api/resolve`, `/api/upi/lookup`
- Public clients: `/api/public/clients`
- Webhooks: `POST /webhooks/cal` (Cal.com booking events; completes verification on call completion)
