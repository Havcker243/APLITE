# Onboarding Flow (Owner vs Authorized Rep)

## Roles and risk
- **Owner**: lower risk. Follows ID upload + OTP verification.
- **Authorized Representative**: higher risk. Title required (exec-level). Skips ID upload; verification is via scheduled call (OTP blocked).

## Backend routes
- `GET /onboarding/current`: returns session, `step_statuses.role`, risk.
- `POST /onboarding/step-1`: legal entity (address locked afterward).
- `POST /onboarding/step-2`: role + title. Sets risk=`high` for authorized reps.
- `POST /onboarding/upload-id`: owner ID uploads (jpg/png/pdf).
- `POST /onboarding/step-3`: owners must supply `id_document_id`; reps can omit (call-based).
- `POST /onboarding/step-4`: bank rails (encrypted at rest).
- `POST /verify/send-otp` / `POST /verify/confirm-otp`: OTP allowed only for low/medium risk (owners).
- `GET /verify/available-slots`, `POST /verify/schedule-call`: call scheduling.
- `POST /verify/complete-call`: dev helper to mark call complete and issue UPI.

## Frontend UX
- Step 2: role toggle; exec title required for reps.
- Step 3: owners see ID upload; reps see call-based copy, title required, ID optional/hidden.
- Step 5: owners see OTP UI; reps/high-risk see call scheduler and dev “Mark Call Completed”.
- Theme: dark is default to avoid light flash; users can toggle to light.

## Schema note
Use `schema-final.sql`. Older `aplite-backend/data/schema.sql` is missing onboarding columns (`organizations.upi`, `verification_status`, `status`, `sessions.expires_at`, etc.).
