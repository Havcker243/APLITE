# Frontend (MVP)

## App structure
- Next.js pages router in `aplite-frontend/src/pages`
- Shared shell in `aplite-frontend/src/components/Layout.tsx`
- Styling in `aplite-frontend/src/styles/globals.css`

## Auth/session behavior
- Tokens are stored in `localStorage` when present.
- Cookie-based auth is supported as a fallback.
- `AuthProvider` fetches `/api/profile/details` as the source of truth.

## Onboarding flow
- Wizard state lives in `sessionStorage` via `onboardingWizard.tsx`.
- Steps 1–4 are local drafts only.
- Step 5 submits the full payload to `/onboarding/complete`.
- Step 6 schedules a call (Cal.com); after booking, user is routed to a pending screen.

## Key pages
- `index.tsx`: landing
- `signup.tsx`, `login.tsx`
- `onboard/step-1..6.tsx`: onboarding wizard
- `onboard/pending.tsx`: verification pending screen
- `dashboard.tsx`: issue child UPIs + resolve
- `accounts.tsx`: manage payout rails (edit with rail locking)
- `resolve.tsx`: resolve + lookup
- `clients.tsx`: public directory

## UI patterns
- Use `card` + `form-card` for consistent layout.
- Errors use `error-box`, success uses `status-pill`.
- Child UPI list supports pagination (Load more).
