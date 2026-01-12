# Aplite Frontend

Next.js (Pages Router) UI for signup/login, onboarding, UPI management, and
resolving payout coordinates.

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

## Environment
Create `aplite-frontend/.env.local`:
- `NEXT_PUBLIC_API_URL` (defaults to `http://127.0.0.1:8000`)

## Key behavior
- Auth uses HttpOnly cookies and in-memory state (no localStorage tokens).
- Onboarding drafts save on step completion via `/onboarding/draft`.
- Current onboarding state is loaded from `/onboarding/current`.
- Role-based flow:
  - Owners go to call verification.
  - Authorized reps upload an ID document.

## Backend alignment notes
- Use `schema-final.sql` (not `aplite-backend/data/schema.sql`) so onboarding
  columns exist.
- Submissions move to `PENDING_CALL` or `PENDING_REVIEW` until admin action.
