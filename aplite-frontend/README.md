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
- Onboarding drafts are saved server-side on step completion via `/onboarding/draft`.
- Role-based flow (current): owners go through call verification; authorized reps upload ID.
- Submissions move to `PENDING_CALL` or `PENDING_REVIEW` until admin approval/rejection.

## Notes
- Auth uses HttpOnly cookies with in-memory state; no localStorage token persistence.
