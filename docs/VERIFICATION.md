# Verification (MVP)

## Call-based verification
- Owners are routed to call verification after onboarding.
- Booking is handled via Cal.com embed.
- The app shows a pending screen until backend flips the session to `VERIFIED`.

## Webhook behavior
- Endpoint: `POST /webhooks/cal`
- Signature header: `X-Cal-Signature`
- If `CAL_WEBHOOK_SECRET` is set, signature is validated (HMAC SHA256).
- On call completion events, backend completes onboarding and issues UPI.

## Pending screen
- `onboard/pending` polls `/api/profile/details` on an interval.
- Redirects to `/dashboard` once status is `VERIFIED`.
- Provides reschedule link if `NEXT_PUBLIC_CAL_LINK` is configured.
