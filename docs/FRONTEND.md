# Frontend (MVP)

## App structure
- Next.js pages router in `aplite-frontend/src/pages`
- Shared shell in `aplite-frontend/src/components/Layout.tsx`
- Styling in `aplite-frontend/src/styles/globals.css`

## Auth/session behavior
- Auth uses HttpOnly cookies with in-memory session state.
- `authedFetch` requests a CSRF token (`/api/auth/csrf`) and sends `X-CSRF-Token` on non-GETs.
- `AuthProvider` fetches `/api/profile/details` as the source of truth.

## Onboarding flow
- Wizard state lives in `onboardingWizard.tsx` and hydrates from `/onboarding/current`.
- Steps 1-4 save server-side drafts via `POST /onboarding/draft`.
- `sessionStorage` is a fallback only (fast local UX).
- Step 5 submits the full payload to `/onboarding/complete`.
- Step 6 is for owners to schedule/confirm a verification call.
- After submit (or call confirmation), users are routed to the pending screen.

## Key pages
- `index.tsx`: landing
- `signup.tsx`, `login.tsx`
- Public info pages: `about.tsx`, `faq.tsx`, `payment-identity.tsx`, `verification.tsx`, `security.tsx`, `compliance.tsx`, `sla.tsx`, `trust.tsx`
- Public utility pages: `status.tsx`, `contact.tsx`, `terms-of-service.tsx`, `privacy-policy.tsx`
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
