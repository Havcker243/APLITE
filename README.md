# Tatin

Tatin is a verified payment identity system for businesses. It replaces raw bank-detail sharing with short Tatin IDs that can be verified publicly and resolved to payout coordinates by authorized partners.

Example ID: `bulldogbites@tatin`

## What Is Included

- Public marketing and trust pages
- Supabase-backed signup, login, OAuth, and email confirmation
- Six-step KYB onboarding flow
- Manual verification queue for owners and authorized representatives
- Payment account management for ACH, domestic wire, and SWIFT rails
- Organization and child Tatin ID issuance
- Public verification, lookup, and authenticated resolve endpoints
- Waitlist capture, admin review tools, rate limiting, and health checks

## Current Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 18, TypeScript |
| Styling | Tailwind CSS, Radix UI |
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL |
| Auth | Supabase Auth JWTs |
| Storage | S3-compatible object storage for uploaded documents |
| Encryption | AES-GCM field encryption for payment details |
| Email | SendGrid |
| Scheduling | Cal.com |
| Hosting | Vercel frontend, Render backend |

## Repository Layout

```text
Tatin-1/
|-- tatin-backend/
|   |-- app/
|   |-- data/
|   |-- migrations/
|   |-- .env.example
|   `-- requirements-backend.txt
|-- tatin-frontend/
|   |-- src/
|   |-- public/
|   |-- .env.example
|   `-- package.json
|-- docs/
|-- schema-final.sql
|-- render.yaml
`-- README.md
```

## End-to-End Flow

1. A user signs up through Supabase Auth.
2. The backend creates the local user profile on first authenticated request.
3. The user completes onboarding drafts and submits KYB details.
4. Owners move to `PENDING_CALL`; authorized representatives move to `PENDING_REVIEW`.
5. Admin review approves or rejects the session.
6. Approved organizations receive an organization Tatin ID.
7. Verified users create payment accounts and child Tatin IDs.
8. Public users can verify IDs; authorized clients can resolve payout details.

## Prerequisites

- Node.js 18 or newer
- Python 3.11 or newer
- PostgreSQL database
- Supabase project for authentication
- S3-compatible bucket for onboarding uploads
- Optional but recommended: SendGrid and Cal.com accounts

## Local Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd Tatin-1
```

Frontend:

```bash
cd tatin-frontend
npm install
```

Backend:

```bash
cd ../tatin-backend
python -m venv venv
```

PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
pip install -r requirements-backend.txt
```

Bash:

```bash
source venv/bin/activate
pip install -r requirements-backend.txt
```

### 2. Configure environment files

Create backend config:

```bash
cd tatin-backend
cp .env.example .env
```

Create frontend config:

```bash
cd ../tatin-frontend
cp .env.example .env.local
```

On Windows PowerShell, use `Copy-Item` instead of `cp` if needed.

### 3. Initialize the database

Use the current schema at the repo root:

```bash
psql "$DATABASE_URL" -f schema-final.sql
```

Do not use `tatin-backend/data/schema.sql` for a fresh environment; it is an older draft and is missing onboarding fields used by the application.

### 4. Start the backend

From `tatin-backend/`:

```bash
uvicorn app.main:app --reload
```

Default local backend URL: `http://127.0.0.1:8000`

Health check:

```bash
curl http://127.0.0.1:8000/health
```

### 5. Start the frontend

From `tatin-frontend/`:

```bash
npm run dev
```

Default local frontend URL: `http://localhost:3000`

## Required Environment Variables

### Backend: `tatin-backend/.env`

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `ENCRYPTION_KEY` | Yes | Key used by backend crypto helpers |
| `UPI_SECRET_KEY` | Yes | HMAC key for Tatin ID generation |
| `ADMIN_API_KEY` | Yes | Admin queue authentication |
| `DATABASE_BUCKET_NAME` | Yes for uploads | Object-storage bucket |
| `DATABASE_BUCKET_S3_ACCESS_KEY_ID` | Yes for uploads | Object-storage access key |
| `DATABASE_BUCKET_S3_SECRET_ACCESS_KEY` | Yes for uploads | Object-storage secret key |
| `DATABASE_BUCKET_S3_ENDPOINT` | Yes for uploads | Object-storage endpoint |
| `DATABASE_BUCKET_S3_REGION` | Yes for uploads | Object-storage region |

Recommended:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_JWKS_URL` | Explicit JWT verification key endpoint |
| `SUPABASE_ISSUER` | Explicit JWT issuer override |
| `SUPABASE_JWT_AUDIENCE` | JWT audience, defaults to `authenticated` |
| `FRONTEND_ORIGINS` | Comma-separated CORS allowlist |
| `FRONTEND_ORIGIN_REGEX` | Regex CORS allowlist |
| `SESSION_TOKEN_HMAC_KEY` | Dedicated HMAC key for session-token hashing |
| `CSRF_SECRET_KEY` | Dedicated CSRF signing key |
| `REQUEST_TIMEOUT_SECONDS` | Request timeout, defaults to `30` |
| `DB_POOL_MIN` / `DB_POOL_MAX` | Database connection-pool sizing |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | Transactional email delivery |
| `NEXT_PUBLIC_CAL_LINK` | Cal.com scheduling link consumed by the UI |
| `SENTRY_DSN` | Error tracking |

Rate-limit variables are available for global traffic, resolve, lookup, onboarding uploads, account creation, child-ID creation, and public directory endpoints. See `tatin-backend/.env.example` for the full list.

### Frontend: `tatin-frontend/.env.local`

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Yes | Supabase browser key used by the current code |
| `NEXT_PUBLIC_CAL_LINK` | Recommended | Cal.com booking link |
| `NEXT_PUBLIC_API_PROXY` | Optional | Set to `1` when using same-origin proxy routes |

## Verification Behavior

- Owners do not upload an ID document and move to call verification.
- Authorized representatives must upload an ID document and move to document review.
- Admin approval is the source of truth for verification status.
- Approved users can create child Tatin IDs and resolve payment details.
- Rejected users receive the rejection reason and can restart onboarding.

## Key Routes

### Public

- `GET /health`
- `GET /api/public/clients`
- `GET /api/public/verify?id={tatin_id}`
- `POST /api/public/waitlist`

### Authenticated

- `GET /api/profile`
- `GET /api/profile/details`
- `PUT /api/profile`
- `PUT /api/profile/onboarding`
- `GET /onboarding/current`
- `POST /onboarding/draft`
- `POST /onboarding/upload-id`
- `POST /onboarding/upload-formation`
- `POST /onboarding/complete`
- `GET /api/accounts`
- `POST /api/accounts`
- `PUT /api/accounts/{id}`
- `POST /api/upi/lookup`
- `POST /api/orgs/child-upi`
- `GET /api/orgs/child-upis`
- `POST /api/resolve`

### Admin

- `GET /api/admin/verification/queue`
- `GET /api/admin/verification/{session_id}`
- `GET /api/admin/verification/file/{file_id}`
- `POST /api/admin/verification/{session_id}/approve`
- `POST /api/admin/verification/{session_id}/reject`

Admin endpoints require the `X-Admin-Key` header.

## Deployment

### Backend on Render

The included `render.yaml` configures:

- service name: `tatin-backend`
- root directory: `tatin-backend`
- build command: `pip install -r requirements-backend.txt`
- start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- health check path: `/health`

Set all required secret environment variables in Render before deploying.

### Frontend on Vercel

1. Import the repository.
2. Set the project root directory to `tatin-frontend`.
3. Add the frontend environment variables listed above.
4. Ensure `NEXT_PUBLIC_API_URL` points at the deployed backend.

## Smoke-Test Checklist

After setup, verify:

1. `GET /health` returns `{"status":"ok"}`.
2. The frontend loads at `http://localhost:3000`.
3. Supabase signup works and confirmed users can authenticate.
4. Onboarding drafts save and resume across steps.
5. Uploads succeed with the object-storage bucket configured.
6. Owner and representative paths diverge correctly at verification.
7. Admin can review, approve, and reject sessions with `X-Admin-Key`.
8. Verified users can create payment accounts and child Tatin IDs.
9. Public verification and lookup work.
10. Resolve returns payout details only for valid IDs and allowed callers.

## More Documentation

- `docs/PRODUCT_UI_SPEC.md`
- `docs/DEMO_SCRIPT.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/FRONTEND.md`
- `docs/VERIFICATION.md`

## Known Notes

- The backend currently authenticates requests with Supabase bearer JWTs.
- `tatin-backend/data/schema.sql` remains in the repo for historical reference only.
- Uploaded sample files under `tatin-backend/data/uploads/` are local artifacts, not required for a fresh environment.
