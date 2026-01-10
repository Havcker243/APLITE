# Product/UI Spec (Draft)

This document captures the intended **design language** + **onboarding UX** direction for Aplite.

It is written to be **implementation-ready** for the current repo:
- Frontend: `aplite-frontend/` (Next.js pages router)
- Styling: `aplite-frontend/src/styles/globals.css` + shared shell `aplite-frontend/src/components/Layout.tsx`

## Current implementation notes (MVP)
- Onboarding is a single-submit flow (`/onboarding/complete`) with server-side drafts saved per step.
- `/onboarding/current` returns the active onboarding session (including drafts).
- Role flow: owners go through call verification; authorized reps upload ID (admin completes verification).
- Step 5 is review + submit; Step 6 lets owners schedule/confirm a verification call.
- Child UPIs exist and can be created from existing or new payment accounts.

---

# A. Product UI Theme (Homepage + App Shell)

## A1) What you’re copying from the homepage reference

The reference is a premium agent product landing style:
- Dark, gradient-backed canvas
- One dominant message (headline)
- One dominant action (command bar / CTA)
- Soft depth (blurred glow, subtle borders)
- Minimal navigation
- High trust / high taste design

This should become the **global design language**, not just the landing page.

---

## A2) Onboarding Design Philosophy

This onboarding is not consumer onboarding. It is designed to:
- satisfy KYB / KYC expectations
- feel serious, expensive, and compliant
- avoid playful or casual UI patterns

The user should feel:

> “This product handles real money. It is strict for a reason.”

---

## A3) UI Design System Spec (Token-Level)

### Colors
- Onboarding should not be pitch black; aim for Stripe/Brex/Mercury.

#### Global backgrounds
- Primary background: `#0B0D12` (deep charcoal, not black)
- Secondary background (cards/panels): `#11141B`
- Divider lines: `rgba(255,255,255,0.08)`

#### Text colors
- Primary text: `#F5F7FA`
- Secondary text: `#B8BCC6`
- Muted/helper text: `#8A8F9C`
- Disabled text: `#5E636E`

#### Accent colors (use sparingly)
- Primary accent (trust): `#6C7CFF` (soft indigo)
- Success: `#3ED598`
- Warning: `#F4B740`
- Error: `#FF6B6B`

Never use bright red or neon green; keep everything muted and professional.

#### Form colors
- Input background: `#141824`
- Input border (default): `rgba(255,255,255,0.12)`
- Input border (focus): `#6C7CFF`
- Input error border: `#FF6B6B`
- Placeholder text: `#6E7381`

#### Buttons
- Primary button background: `#6C7CFF`
- Primary button hover: `#5A69E8`
- Primary button text: `#FFFFFF`
- Secondary button: transparent
- Secondary border: `rgba(255,255,255,0.15)`

### Typography
- Headline: large, bold, tight tracking
- Body: clean sans-serif, comfortable line height
- Emphasis: use weight + color, not underline
- Numbers/codes: monospaced for routing/account/UPI inputs

### Spacing + Layout
- Wide whitespace
- Standard container width (e.g. max-w 1100“1200px)
- Forms: two-column grid on desktop, one column on mobile
- Buttons: large touch targets, rounded corners

### Shapes
- Rounded corners everywhere
- Inputs and buttons feel soft, not sharp
- Focus ring: subtle glow in accent color

### Motion
- Hover effects: slight glow + lift
- Page transitions: fade/slide small amount
- Loading: skeletons instead of spinners where possible

---

## A4) Onboarding Layout Structure

### Page layout
- Fixed header
- Centered content container
- Max width: 960px
- Padding: 48px top, 32px sides
- Stepper always visible at top

### Stepper (top progress indicator)

Structure:
- Horizontal stepper with 5 steps
- Each step:
  - circle (number or checkmark)
  - label underneath

States:
- Completed: filled circle + checkmark (accent)
- Current: filled circle + number (accent)
- Future: outline circle (muted)

Rules:
- Steps are not clickable
- Navigation is linear only

---

## A5) App Shell Layout (Global Frame)

This is the skeleton that wraps every page.

### Header (Top)
- Left: product logo + product name
- Center or right: nav links (if needed)
- Right: user profile + logout/settings

### Main Content Area
- Centered content container
- Background gradient or vignette (subtle)

### Notifications
- Toast system for:
  - Saved
  - Code sent
  - Verification successful
  - Bank details encrypted
  - Errors with guidance

---

## A4) Agent-First Interaction Pattern

### Core idea
Instead of only forms everywhere, provide a **command entry point** where the user can:
- Start onboarding
- Verify my business
- Connect bank
- Issue UPI
- Update payment rails
- Invite teammates
- Generate payment identity

### Homepage structure
1. Headline
2. Subheadline: trust + speed + security
3. Command bar input (or big CTA button)
4. Showcase area (like the reference screenshot/mock)

---

# B. FinTech B2B Onboarding Flow (5 Steps + Verification)

## B0) Main onboarding requirements (current MVP)

Must have:
- Multi-step wizard with progress indicator
- Form validation + field formatting
- Data persistence between steps
- Local draft persistence (sessionStorage)
- Role-based verification path (call for owners, ID for authorized reps)
- Admin review queue for approval/rejection

## B1) Suggested 5-step wizard (draft)

This is the high-level flow the UI should support. Current MVP uses local drafts and a single submit on Step 5.

1. Establish legal entity (business info + legal address)
2. Add business context (industry, description, website, etc.)
3. Add representative / user identity (owner or authorized rep)
4. Connect payout rails (ACH / wire / SWIFT)
5. Review + submit; verification path determined by role (call for owners, ID for reps)
6. Owner call scheduling + confirmation (owners only)

---

# C. Onboarding Architecture (Backend + Frontend + States)

## C1) Onboarding entities

### 1) Organization (Business)

Represents the business account.

Fields:
- `legal_name`
- `dba_name` (optional)
- `ein`
- `formation_date`
- `formation_state`
- `entity_type`
- `website`
- `industry`
- `business_description`
- `legal_address` (structured)
- `risk_score` (computed)
- `verification_status` (`PENDING_REVIEW` / `PENDING_CALL` / `VERIFIED` / `REJECTED`)
- `created_at`, `updated_at`

### 2) User

Represents who is filling this out.

Fields:
- `name`
- `email`
- `phone` (optional)
- `role_in_org` (`owner` / `authorized_rep`)
- `executive_title` (required if `authorized_rep`)
- `identity_verification_status`
- `created_at`

### 3) OnboardingSession

Tracks finalized onboarding submissions.

Fields:
- `org_id`
- `user_id`
- `current_step` (1-6)
- `step_statuses` (JSON)
- `last_saved_at`
- `completed_at`

### 4) VerificationReview

Admin review audit trail for onboarding verification.

Fields:
- `session_id`
- `org_id`
- `reviewer_id` (admin)
- `status` (`APPROVED` / `REJECTED`)
- `reason` (required on rejection)
- `created_at`

### 5) BankRailMapping

Stores bank routing information securely.

Fields:
- `org_id`
- `bank_name`
- `account_last4` (store last4 only in plaintext)
- `account_number_encrypted`
- `ach_routing`
- `wire_routing`
- `swift_code` (optional)
- `verified` (boolean)
- `created_at`

---

## C2) State machine (workflow) (planned)

Onboarding currently relies on client-side step gating; the state machine below is planned.

Possible states:
- `NOT_STARTED`
- `STEP_1_IN_PROGRESS` / `STEP_1_COMPLETE`
- `STEP_2_IN_PROGRESS` / `STEP_2_COMPLETE`
- `STEP_3_IN_PROGRESS` / `STEP_3_VERIFICATION_PENDING` / `STEP_3_COMPLETE`
- `STEP_4_IN_PROGRESS` / `STEP_4_COMPLETE`
- `STEP_5_PENDING_VERIFICATION`
- `PENDING_REVIEW` / `PENDING_CALL` / `VERIFIED` / `REJECTED`

Rules (current):
- Client enforces step gating locally.
- Server stores drafts per step and marks the session `PENDING_REVIEW` or `PENDING_CALL` on final submit.

---

# D. Step-by-step Implementation Spec (UI guidance; backend is single-submit)

## Step 1: Establish Legal Entity (Business Info)

Purpose:
- Create the legal identity of the business; this becomes immutable later.
- Once submitted, the legal address becomes read-only in later steps.

### UI requirements
- Title: `Stage 1: Establish Legal Entity`
- Subtitle: "Please provide your business information"
- Two-column form layout (desktop), one column (mobile)

### Inputs + validation

1) Legal Name (required)
- string, min length 2
- max length 120
- trim whitespace

2) DBA Name (optional)
- string

3) EIN (required)
- validate format: `XX-XXXXXXX`
- allow user typing digits; auto-format as they type

4) Formation Date (required)
- date picker
- must be a valid past date (not future)

5) Formation State (required)
- dropdown list of states

6) Entity Type (required)
- dropdown (LLC, C-Corp, S-Corp, Partnership, Nonprofit, Sole Proprietor, etc.)

### Legal business address (required)
- Street 1
- Street 2 (optional)
- City
- State (dropdown)
- ZIP (5 digits; allow ZIP+4 optionally)

### Business profile (part of step 1)
- Industry (dropdown)
- Industry free-text when "Other"
- Website (validate domain)
- Business description (optional but useful)

### Formation documents (current)
- Required for most entity types (not required for Sole Proprietor)
- Upload via `POST /onboarding/upload-formation` (returns `file_id`)
- Final submit references the `file_id` in the step 1 payload

### Backend behavior (current)
- Server drafts saved via `POST /onboarding/draft`; client `sessionStorage` is fallback only.
- Address becomes locked after final submission.

### Backend API (current)
- `POST /onboarding/upload-formation` for formation documents (returns `file_id`).
- `POST /onboarding/draft` for per-step draft saves.
- `POST /onboarding/complete` for the full onboarding payload (all steps).

---

## Step 2: Confirm Authorization

### UI requirements
- Title: `Stage 2: Confirm Authorization`
- Options:
  - "I am the Business Owner"
  - "I am an Authorized Representative"
- If authorized rep: show executive title dropdown

### Validation
- Must pick one option
- If authorized rep:
  - require executive title
  - examples: CEO, COO, CFO, President, VP, Director

### Backend logic (current)
- Role and title are submitted as part of the final payload.

### Backend API (current)
- Role fields are included in `POST /onboarding/complete`.

---

## Step 3: Identity Verification

### UI requirements
- Title: `Stage 3: Identity Verification`
- Inputs:
  - Full legal name
  - Title (prefill from step 2 when possible)
  - Upload government ID (file upload)
  - Checkbox attestation

### File upload requirements
- Accept: `jpg`, `png`, `pdf`
- Max size: 10MB
- Show uploaded filename + replace
- Store securely (S3-like bucket or local in MVP)

### Attestation
- Checkbox required: "I confirm I have legal authority and the information is accurate."

### Backend workflow (current)
- Upload the ID file via `POST /onboarding/upload-id` to get a `file_id`.
- Include `file_id` in the final `POST /onboarding/complete` payload.

### Backend API (current)
- `POST /onboarding/upload-id`
- `POST /onboarding/complete`

---

## Step 4: Payment Rail Resolution (Bank Info)

### UI requirements
- Title: `Stage 4: Payment Rail Resolution Data`
- Banner: "All data is encrypted and securely stored"
- Inputs:
  - Bank name
  - Account number (masked)
  - ACH routing
  - Wire routing
  - SWIFT (optional)
  - Business address confirmation section (read-only)

### Validation rules
- Bank name required
- Account number:
  - required
  - numeric only for ACH/Wire
  - alphanumeric for SWIFT (IBAN)
- Routing numbers:
  - numeric only
  - length checks (ACH usually 9 digits)
- SWIFT:
  - optional
  - pattern checks (basic BIC format)

### Backend security rules (current)
- Encrypt account number before storing
- Never return full account number after save

### Backend API (current)
- Bank fields are included in `POST /onboarding/complete`.

---

## Step 5: Review + Submit

### UI requirements (current)
- Review the full onboarding payload
- Submit and receive confirmation
- Verification status is set based on role:
  - Owners: `PENDING_CALL`
  - Authorized reps: `PENDING_REVIEW`

### Verification method selection (current)
- Owners: call verification (admin completes after call).
- Authorized reps: ID + formation documents reviewed by admin.

## Step 6: Owner call scheduling (current MVP)

### UI requirements (current MVP)
- Owners schedule/confirm a verification call and then move to pending.
- Status auto-refreshes from the backend; redirect to dashboard on `VERIFIED`.
- Provide a reschedule link when configured.

---

# E. Verification Channel System (Email / Text / Call) (future)


## E1) When to use each method (planned)

- If user is owner + US-based + identity matches cleanly: Email OTP or SMS OTP
- If authorized rep or missing/mismatched details: schedule call

### Risk scoring factors (examples)
- Authorized rep instead of owner
- EIN/formation mismatch
- Suspicious domain/website
- Disposable phone/email signals
- Bank info mismatch
- Address inconsistencies

---

## E2) OTP verification spec (Email/SMS) (planned)

### User flow
1. User chooses method OR system chooses automatically
2. System sends 6-digit code
3. User enters code
4. Code verified -> onboarding complete -> issue identifier

### Backend rules
- Code expires in 10 minutes
- Attempt limit: 5 max
- Resend limit: 3 max

### API endpoints (planned)

`POST /verify/send-otp`

Payload:
```json
{
  "method": "email | sms"
}
```

`POST /verify/confirm-otp`

Payload:
```json
{
  "code": "123456"
}
```

---

## E3) Call verification spec (planned)

### User flow
1. Schedule call
2. Confirmation sent (email + optional SMS)
3. At call time:
   - verify identity + authority + business info + bank details
4. After call:
   - mark `VERIFIED`
   - issue identifier(s)

### MVP approaches
- Simulate call verification as:
  - admin marks verified manually
  - or user picks a time and you confirm with a code later

### API (planned)
- `GET /verify/available-slots`
- `POST /verify/schedule-call`
- `POST /verify/complete-call` (admin/internal)

---

# F. UX Details That Make It Feel Enterprise

## F1) Wizard behavior
- Top progress bar with steps 1-6
- Completed steps show checkmark
- Current step highlighted
- Cannot skip ahead
- Back is always available unless verification started

## F2) Autosave (current)
- Drafts are saved server-side on step completion
- `sessionStorage` is a fallback for offline UX
- Show a "Saved" indicator
- Drafts are cleared on logout

## F3) Resume onboarding (current)
- Drafts can be resumed across devices via `/onboarding/current`

## F4) Error messages
- Always show:
  - what went wrong
  - how to fix it
- Avoid generic "invalid input" without guidance.

# G. MVP Build Order (Current)
---

# J. Completion

After verification:
- Status becomes `VERIFIED`
- Universal Payment Identifier issued
- User redirected to dashboard

---

# K. Final Experience Summary

This onboarding is:
- Dark
- Structured
- Strict
- Trust-first
- Regulated
- Enterprise-grade

It intentionally slows the user slightly to build confidence.

---

# G. MVP Build Order (Current)

1. Single-submit onboarding payload (`/onboarding/complete`)
2. Formation + ID uploads (`/onboarding/upload-formation`, `/onboarding/upload-id`)
3. Admin review queue for approve/reject
4. Add child UPIs using existing or new payment accounts
5. (Future) OTP + deeper call scheduling flows

---

# H. Deliverable (Copy/Paste Task for Another Agent)

**Task:** Implement B2B fintech onboarding in 5 steps + owner verification with enterprise UI and dark theme.

**UI:** Premium dark gradient theme (minimal, agent-first), but onboarding uses a clean step wizard.

**Steps:**
1. Legal entity + address + industry + website (required validation; saved as source of truth)
2. Confirm user authority (owner vs authorized rep; exec title required if rep)
3. Identity verification (full name + title + upload government ID + attestation)
4. Bank rails mapping (bank name, acct number encrypted, ACH/wire routing, SWIFT optional; address read-only)
5. Review + submit (call for owners, ID for authorized reps)
6. Owner call scheduling + pending screen

**Requirements:**
- Autosave drafts in sessionStorage, strict step gating
- Encrypted storage for bank account details


