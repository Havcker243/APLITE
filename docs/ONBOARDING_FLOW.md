# Onboarding Flow (Current Implementation)

## Roles and risk
- **Owner**: lower risk. Call verification (no ID upload).
- **Authorized Representative**: higher risk. Title required (exec-level). ID upload required.

## Backend routes (current)
- `GET /onboarding/current`: returns session (only after final submit).
- `POST /onboarding/upload-id`: ID uploads (jpg/png/pdf).
- `POST /onboarding/upload-formation`: formation document uploads.
- `POST /onboarding/complete`: single-submit onboarding payload.

## Frontend UX (current)
- Step 2: role toggle; exec title required for reps.
- Step 3: owners see call-based copy; reps must upload ID.
- Step 5: review + submit only (no OTP UI).
- Drafts are stored locally (sessionStorage) until final submit.

## Schema note
Use `schema-final.sql`. Older `aplite-backend/data/schema.sql` is missing onboarding columns (`organizations.upi`, `verification_status`, `status`, `sessions.expires_at`, etc.).
