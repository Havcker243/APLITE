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
- Cal.com sends `triggerEvent` values like `BOOKING_CANCELLED`; the backend normalizes these to `booking.cancelled`.

### Events recognized for verification
- Always:
  - `booking.completed`
  - `booking.ended`
  - `call.completed`
  - `meeting.completed`
- If `CAL_VERIFY_ON_CANCEL=1` (testing only):
  - `booking.cancelled` / `booking.canceled`
  - `call.cancelled` / `call.canceled`
  - `meeting.cancelled` / `meeting.canceled`

## Local testing with ngrok (optional)
1) Start the backend on port 8000.
2) Run ngrok:
   ```bash
   ngrok http 8000
   ```
3) Use the public URL in Cal webhook settings:
   - `https://<your-ngrok-id>.ngrok.app/webhooks/cal`

## Local test script (no Cal required)
Run the PowerShell script to simulate a Cal webhook:
```powershell
.\scripts\test-cal-webhook.ps1 -Url "http://127.0.0.1:8000/webhooks/cal" -Email "you@example.com"
```

Python alternative:
```bash
python .\scripts\test-cal-webhook.py --url "http://127.0.0.1:8000/webhooks/cal" --email "you@example.com"
```

If you set `CAL_WEBHOOK_SECRET`, the scripts will include a signed header automatically.
## Pending screen
- `onboard/pending` polls `/api/profile/details` on an interval.
- Redirects to `/dashboard` once status is `VERIFIED`.
- Provides reschedule link if `NEXT_PUBLIC_CAL_LINK` is configured.
