# API (MVP)

This file documents the backend routes used by the frontend.

## Auth
- `POST /api/auth/signup`
  - Create user and issue session token (password min length: 8).
- `POST /api/auth/login/start`
  - Password check + send OTP (email).
- `POST /api/auth/login/verify`
  - Verify OTP and issue session.
- `POST /api/auth/logout`
  - Invalidate current session.
- `GET /api/auth/csrf`
  - Issue CSRF token for cookie-based sessions.

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
  - Reset in-progress onboarding session (also removes related org payment accounts and child UPIs).
- `POST /onboarding/upload-id`
  - Upload identity doc (requires S3 storage config).
- `POST /onboarding/upload-formation`
  - Upload formation doc (requires S3 storage config).
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

## Admin verification
- `POST /api/admin/orgs/{org_id}/verify`
- `POST /api/admin/orgs/upi/{org_upi}/verify`
- `POST /api/admin/users/master-upi/{master_upi}/verify`
  - Requires `X-Admin-Key` header (matches `ADMIN_API_KEY`).

## Admin review queue
- `GET /api/admin/verification/queue`
  - List pending verification sessions (call + ID).
- `GET /api/admin/verification/{session_id}`
  - Full onboarding payload + file metadata for review.
- `GET /api/admin/verification/file/{file_id}`
  - Stream uploaded ID/formation docs.
- `POST /api/admin/verification/{session_id}/approve`
- `POST /api/admin/verification/{session_id}/reject`
  - Requires `reason` in JSON body.
