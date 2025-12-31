# Onboarding Flow (Current Implementation)

## Roles and risk
- **Owner**: lower risk. Call verification (no ID upload).
- **Authorized Representative**: higher risk. Title required (exec-level). ID upload required.

## Backend routes (current)
- `GET /onboarding/current`: returns session (only after final submit).
- `POST /onboarding/upload-id`: ID uploads (jpg/png/pdf).
- `POST /onboarding/upload-formation`: formation document uploads.
- `POST /onboarding/complete`: single-submit onboarding payload.
- No per-step save/resume endpoints.

## Frontend UX (current)
- Step 2: role toggle; exec title required for reps.
- Step 3: owners see call-based copy; reps must upload ID.
- Step 5: review + submit only (no OTP UI).
- Step 6: owners schedule/confirm a verification call.
- Drafts are stored locally (sessionStorage) until final submit.
- Final submit happens only on Step 5.

## Verification status
- Owners move to `PENDING_CALL` after submit.
- Authorized reps move to `PENDING_REVIEW` after submit.
- Admin review is the source of truth for `VERIFIED` or `REJECTED`.
- Rejections show a reason and allow resubmission.

## Schema note
Use `schema-final.sql`. Older `aplite-backend/data/schema.sql` is missing onboarding columns (`organizations.upi`, `verification_status`, `status`, `sessions.expires_at`, etc.).
