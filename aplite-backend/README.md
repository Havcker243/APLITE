# Aplite Backend (MVP)

FastAPI service for onboarding businesses, managing payment accounts, issuing UPIs, and resolving payment details.

## Environment
- Python 3.11+ (system or venv)
- Postgres: set `DATABASE_URL` (Supabase URL works)
- Secrets: `ENCRYPTION_KEY`, `UPI_SECRET_KEY` (already in your `.env`; not modified here)
- Email (optional): `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` to send OTP emails via SendGrid; otherwise emails log to stdout.

## Install (backend-only)
```bash
pip install -r requirements-backend.txt
```

## Database schema
Apply the minimal schema:
```bash
psql "$DATABASE_URL" -f data/schema.sql
```

## Run the server
```bash
uvicorn app.main:app --reload
```
Run from the repo root so `app` is on the import path. If needed, set `PYTHONPATH=.`.

## Key routes
- Auth: `/api/auth/signup`, `/api/auth/login/start`, `/api/auth/login/verify`, profile GET/PUT
- Payment accounts: `/api/accounts` (list/create)
- Businesses: `/api/businesses` (create/list), `/api/businesses/{id}/deactivate`
- Resolve UPI: `/api/resolve`
- Public clients: `/api/public/clients`
