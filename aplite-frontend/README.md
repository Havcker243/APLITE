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

## Notes
- Auth tokens are stored in `localStorage` by the MVP (`aplite-frontend/src/utils/auth.tsx`).
