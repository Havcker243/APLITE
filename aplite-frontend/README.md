# Aplite Frontend (MVP)

Next.js (pages router) UI for signing up/logging in, onboarding, creating businesses/UPIs, and resolving payout coordinates.

## Requirements
- Node.js 18+

## Install
From `aplite-frontend/`:

```bash
npm install
```

## Run (dev)

```bash
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Environment variables

Create `aplite-frontend/.env.local`:
- `NEXT_PUBLIC_API_URL` (defaults to `http://127.0.0.1:8000`)

## Onboarding notes (backend alignment)
- Backend must be running with the `schema-final.sql` schema (not `aplite-backend/data/schema.sql`) so onboarding columns exist.
- Role-based flow: owners use OTP; authorized reps (high risk) are forced to schedule a verification call. The UI hides OTP when risk is high or role is authorized rep.

## Notes
- Auth tokens are stored in `localStorage` by the MVP (`aplite-frontend/src/utils/auth.tsx`).
