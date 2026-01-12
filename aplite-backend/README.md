# Aplite Backend

FastAPI service for onboarding organizations, managing payment accounts, issuing
UPIs, and resolving payout details.

## Requirements
- Python 3.11+
- Postgres (Supabase Postgres works)

## Install
From `aplite-backend/`:
```bash
pip install -r requirements-backend.txt
```

## Database schema
Apply the current schema:
```bash
psql "$DATABASE_URL" -f ../schema-final.sql
```

Note: `aplite-backend/data/schema.sql` is an older draft and is missing columns
used by onboarding (for example `organizations.upi`, `verification_status`,
`status`, `sessions.expires_at`). Use `schema-final.sql`.

## Run (dev)
```bash
uvicorn app.main:app --reload
```
Run from `aplite-backend/` so `.env` is loaded correctly.

## Configuration
Required:
- `DATABASE_URL`
- `SUPABASE_URL`
- `ENCRYPTION_KEY`
- `UPI_SECRET_KEY`
- `ADMIN_API_KEY`
- Storage: `DATABASE_BUCKET_NAME`, `DATABASE_BUCKET_S3_ACCESS_KEY_ID`,
  `DATABASE_BUCKET_S3_SECRET_ACCESS_KEY`, `DATABASE_BUCKET_S3_REGION`,
  `DATABASE_BUCKET_S3_ENDPOINT`

Recommended:
- `CSRF_SECRET_KEY`
- `SUPABASE_JWKS_URL`, `SUPABASE_ISSUER`, `SUPABASE_JWT_AUDIENCE`
- `SESSION_TTL_HOURS` (default `168` = 7 days)
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- `NEXT_PUBLIC_CAL_LINK`

## Key routes
- Auth: Supabase JWT required (no local auth endpoints)
- Profile: `GET/PUT /api/profile`
- Profile (extended): `GET /api/profile/details`, `PUT /api/profile/onboarding`
- Onboarding: `/onboarding/current`, `/onboarding/draft`, `/onboarding/complete`,
  `/onboarding/upload-id`, `/onboarding/upload-formation`, `/onboarding/reset`
- Payment accounts: `/api/accounts` (list/create), `PUT /api/accounts/{id}`
- Child UPIs: `/api/orgs/child-upi`, `/api/orgs/child-upis`,
  `/api/orgs/child-upis/{id}/disable`, `/api/orgs/child-upis/{id}/reactivate`
- Resolve UPI: `/api/resolve`, `/api/upi/lookup`
- Public clients: `/api/public/clients`
- Admin verification: `/api/admin/verification/queue`,
  `/api/admin/verification/{session_id}`,
  `/api/admin/verification/{session_id}/approve`,
  `/api/admin/verification/{session_id}/reject`

## Verification rules (enforced)
- Owners do not upload an ID document.
- Authorized reps must upload an ID document.
- Owners go to call verification.
- Authorized reps go through document review.

## Rate limits (optional)
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

## Troubleshooting
- "File storage is not configured": storage env vars are missing.
- "Missing ENCRYPTION_KEY / UPI_SECRET_KEY": secrets not set.
- "Confirm your email": Supabase email confirmation is enabled.
- "Admin verification is not configured": `ADMIN_API_KEY` missing.
- "Invalid admin key": admin key is incorrect or not set.
