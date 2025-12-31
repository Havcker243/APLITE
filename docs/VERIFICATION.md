# Verification (MVP)

## Current flow
- Onboarding submit sets a verification method:
  - Owners: `PENDING_CALL`
  - Authorized reps: `PENDING_REVIEW`
- Admin review is the source of truth for verification status.
- Admin approves or rejects; a rejection requires a reason.
- Approved sessions issue the org UPI and move to `VERIFIED`.

## Admin review
- Admin dashboard uses `X-Admin-Key` (matches `ADMIN_API_KEY`).
- Queue lists pending call + ID sessions.
- Detail view shows onboarding data and uploaded files.
- Approve/reject updates `verification_reviews` and `onboarding_sessions`.

## Pending screen
- `/onboard/pending` polls `/api/profile/details` on an interval.
- Redirects to `/dashboard` once status is `VERIFIED`.
- If `PENDING_CALL`, users can return to `/onboard/step-6` to schedule/reschedule.
- If `REJECTED`, users see the rejection reason and can restart onboarding.
