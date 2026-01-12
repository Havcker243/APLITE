# Demo Script

This is a short, repeatable walkthrough for showing Aplite end to end. Use it for
investor demos, partner calls, or internal reviews.

## Setup (2 minutes)
- Use a demo business email in Supabase Auth.
- Ensure `NEXT_PUBLIC_CAL_LINK` is set so call scheduling works.
- Have one payout account ready for onboarding.

## Demo outline (5-7 minutes)

### 1) Landing page and value proposition (30 seconds)
Talking points:
- Aplite replaces raw bank detail sharing with secure payment identifiers (UPIs).
- Only verified parties can resolve a UPI into payout coordinates.

### 2) Signup and onboarding overview (60 seconds)
Flow:
- Start signup and enter basic identity details.
- Explain the 5-step KYB flow and why it exists (trust + compliance).
Talking points:
- Owners verify by call, authorized reps verify by ID.
- Drafts save as you go; onboarding can be resumed.

### 3) Payout rails and encryption (60 seconds)
Flow:
- Add ACH/wire details.
Talking points:
- Sensitive rail fields are encrypted at rest.
- Rail fields lock after a UPI is linked.

### 4) Call scheduling and verification (45 seconds)
Flow:
- Book the verification call.
- Show pending status page.
Talking points:
- Manual review ensures a verified business identity.
- Verified status unlocks UPI creation and resolution.

### 5) Create and share a UPI (60 seconds)
Flow:
- Create a child UPI for a payout account.
- Copy the UPI and explain how it is shared with partners.
Talking points:
- UPIs are short identifiers, not bank details.
- UPIs can be disabled or reactivated.

### 6) Resolve a UPI (60 seconds)
Flow:
- Resolve a UPI in the dashboard.
Talking points:
- Only verified users can resolve.
- Each resolution is controlled and auditable.

## Closing (30 seconds)
- Reiterate security, verification, and operational clarity.
- Ask for the next step: pilot, integration discussion, or feedback.

## Demo checklist
- [ ] Demo account is verified (or admin ready to approve)
- [ ] Cal.com link configured and working
- [ ] One payout account exists
- [ ] One child UPI exists
- [ ] Resolve flow working
