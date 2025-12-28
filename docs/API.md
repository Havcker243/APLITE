# API (MVP)

This file documents the backend routes used by the frontend.

## Auth
- `POST /api/auth/signup`
  - Create user and issue session token.
- `POST /api/auth/login/start`
  - Password check + send OTP (email).
- `POST /api/auth/login/verify`
  - Verify OTP and issue session.
- `POST /api/auth/logout`
  - Invalidate current session.

## Profile
- `GET /api/profile`
  - Basic user profile.
- `GET /api/profile/details`
  - Profile + onboarding + org snapshot.
- `PUT /api/profile`
  - Update public-facing user profile.
- `PUT /api/profile/onboarding`
  - Update org profile fields (address locked after Step 1).

## Onboarding
- `GET /onboarding/current`
  - Active onboarding session (if any).
- `POST /onboarding/reset`
  - Reset in-progress onboarding session.
- `POST /onboarding/upload-id`
  - Upload identity doc.
- `POST /onboarding/upload-formation`
  - Upload formation doc.
- `POST /onboarding/complete`
  - Single-submit onboarding (all steps).

## Payment accounts
- `GET /api/accounts`
  - List accounts (includes `rail_locked`).
- `POST /api/accounts`
  - Create account.
- `PUT /api/accounts/{id}`
  - Update account (rail fields locked when linked to a UPI).

## Child UPIs
- `POST /api/orgs/child-upi`
  - Create child UPI for an org.
- `GET /api/orgs/child-upis`
  - List child UPIs; supports pagination:
    - `limit` (1-200)
    - `before` (ISO timestamp)
- `POST /api/orgs/child-upis/{id}/disable`
- `POST /api/orgs/child-upis/{id}/reactivate`

## Resolve + lookup
- `POST /api/resolve`
  - Resolve a UPI to payout coordinates.
- `POST /api/upi/lookup`
  - Lookup public profile for a verified UPI.

## Public directory
- `GET /api/public/clients`

## Webhooks
- `POST /webhooks/cal`
  - Accepts Cal.com booking events and completes verification on call completion.
  - Signature header: `X-Cal-Signature`
