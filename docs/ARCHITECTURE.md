# Architecture (MVP)

This document describes the current MVP architecture for Aplite. It is intentionally practical and aligned to the codebase.

## High-level overview
- Frontend: Next.js (pages router) app in `aplite-frontend/`
- Backend: FastAPI service in `aplite-backend/`
- Database: Postgres schema in `schema-final.sql`
- Storage: S3-compatible bucket required for onboarding uploads (no local fallback)

## Core domains
- Users: account identity + profile fields
- Organizations: onboarding business profile
- Payment accounts: payout rails with encrypted fields
- UPIs: org-level UPI + child UPIs per account
- Onboarding sessions: state + audit trail for KYB
- Verification: admin review queue (call + ID)

## Data flow (happy path)
1) User signs up -> master UPI issued
2) User completes onboarding with server-side drafts (Steps 1-4), then final submit
3) Backend stores org, onboarding session, identity, bank rails
4) Owners schedule verification call (out of band); reps submit ID
5) Admin reviews queue, approves or rejects (with reason)
6) Approved sessions issue org UPI; users create child UPIs and resolve payout coordinates

## Storage + security
- Sensitive rail fields are encrypted into `payment_accounts.enc` (AES-GCM).
- Session tokens are HMACed before storage; plaintext never stored in DB.
- UPI signatures are HMAC-derived per user namespace.

## Consistency rules (MVP)
- Payment accounts are editable until linked to any UPI.
- Once linked, rail fields are locked; cosmetic fields remain editable.
- Disabled child UPIs cannot be resolved.

## Key entrypoints
- Backend: `aplite-backend/app/main.py`
- Frontend app shell: `aplite-frontend/src/components/Layout.tsx`
- Onboarding shell: `aplite-frontend/src/components/onboarding/OnboardingShell.tsx`
