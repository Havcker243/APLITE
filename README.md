# APLITE

Aplite is a full-stack MVP for sharing payout details safely. Businesses share a short
identifier (UPI) instead of raw bank details. Verified users can resolve a UPI into
payout coordinates only when needed.

## What this product does
- Replaces direct bank detail sharing with short payment identifiers.
- Guides businesses through onboarding and verification.
- Lets verified users create and resolve UPIs for payouts.

## Core flow (high level)
1) Business signs up.
2) Onboarding collects business, identity, and payout details.
3) Admin manually reviews submissions.
4) Approved businesses receive a UPI.
5) Verified users resolve UPIs to see payout coordinates.

## Roles
- Business user: completes onboarding and manages UPIs.
- Admin reviewer: approves or rejects onboarding submissions.

## Data protection (summary)
- Bank details are encrypted at rest.
- UPIs do not expose bank details by default.
- Only verified users can resolve UPIs.

## Repository layout
- `aplite-backend/`: FastAPI + Postgres API
- `aplite-frontend/`: Next.js (Pages Router) web UI
- `docs/`: product and technical documentation

## Documentation
- `docs/README.md`: doc index and reading order
- `docs/PRODUCT_UI_SPEC.md`: UX spec
- `docs/ARCHITECTURE.md`: system overview

## Developer quick start

Backend (from `aplite-backend/`):
```bash
pip install -r requirements-backend.txt
psql "$DATABASE_URL" -f ../schema-final.sql
uvicorn app.main:app --reload
```

Frontend (from `aplite-frontend/`):
```bash
npm install
npm run dev
```

## Production configuration (summary)
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
- `SESSION_TTL_HOURS`
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- `NEXT_PUBLIC_CAL_LINK`

For full backend configuration and operational notes, see `aplite-backend/README.md`.
