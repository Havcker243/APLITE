-- =========================
-- Extensions
-- =========================
create extension if not exists citext;
create extension if not exists pgcrypto;

-- =========================
-- USERS (People acting on behalf of orgs)
-- =========================
create table if not exists users (
    id bigserial primary key,
    first_name text not null,
    last_name text not null,
    email citext unique not null,
    company text default '',
    company_name text default '',
    summary text default '',
    established_year int,
    state text,
    country text,
    password_hash text not null,
    master_upi text not null, -- namespace / signing root
    created_at timestamptz not null default now()
);

-- =========================
-- SESSIONS (hashed tokens)
-- =========================
create table if not exists sessions (
    token text primary key,
    user_id bigint not null references users(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz
);

-- =========================
-- OTPs (email / sms / call)
-- =========================
create table if not exists otps (
    id text primary key,
    user_id bigint not null references users(id) on delete cascade,
    digest text not null,
    salt text not null,
    expires_at timestamptz not null,
    consumed boolean not null default false
);

-- =========================
-- ORGANIZATIONS (CUSTOMERS)
-- =========================
create table if not exists organizations (
    id uuid primary key default gen_random_uuid(),
    user_id bigint not null references users(id) on delete cascade,
    legal_name text not null,
    dba text,
    ein text not null,
    formation_date date not null,
    formation_state text not null,
    entity_type text not null,
    address jsonb not null default '{}'::jsonb,
    industry text not null,
    website text,
    description text,
    upi text unique, -- issued after onboarding
    verification_status text not null default 'pending', -- pending | verified | rejected
    status text not null default 'active', -- active | disabled
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_organizations_user
    on organizations(user_id);

create unique index if not exists idx_organizations_user_ein
    on organizations(user_id, ein);

-- =========================
-- PAYMENT ACCOUNTS (RAILS)
-- =========================
create table if not exists payment_accounts (
    id bigserial primary key,
    org_id uuid not null references organizations(id) on delete cascade,
    user_id bigint not null references users(id) on delete cascade,
    payment_index int not null,
    rail text not null check (rail in ('ACH','WIRE_DOM','SWIFT')),
    bank_name text not null,
    account_name text,
    enc jsonb not null default '{}'::jsonb,
    status text not null default 'active', -- active | disabled
    created_at timestamptz not null default now()
);

create unique index if not exists idx_payment_accounts_unique
    on payment_accounts(org_id, payment_index, rail);

create index if not exists idx_payment_accounts_org
    on payment_accounts(org_id);

-- =========================
-- CHILD UPIS (PER-ACCOUNT IDENTIFIERS)
-- =========================
create table if not exists child_upis (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references organizations(id) on delete cascade,
    payment_account_id bigint not null references payment_accounts(id) on delete cascade,
    upi text not null,
    status text not null default 'active' check (status in ('active','disabled')),
    created_at timestamptz not null default now(),
    disabled_at timestamptz,
    unique (org_id, upi)
);

create index if not exists idx_child_upis_upi
    on child_upis(upi);

create index if not exists idx_child_upis_org_id
    on child_upis(org_id);

-- =========================
-- ONBOARDING SESSIONS
-- =========================
create table if not exists onboarding_sessions (
    id uuid primary key,
    org_id uuid not null references organizations(id) on delete cascade,
    user_id bigint not null references users(id) on delete cascade,
    state text not null, -- flexible state machine
    current_step int not null default 1,
    step_statuses jsonb not null default '{}'::jsonb,
    risk_level text not null default 'low',
    address_locked boolean not null default false,
    issued_payment_account_id bigint references payment_accounts(id),
    last_saved_at timestamptz not null default now(),
    completed_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_onboarding_sessions_user
    on onboarding_sessions(user_id);

create index if not exists idx_onboarding_sessions_org
    on onboarding_sessions(org_id);

-- =========================
-- IDENTITY VERIFICATIONS (Future KYB/KYC)
-- =========================
create table if not exists identity_verifications (
    id uuid primary key,
    session_id uuid not null references onboarding_sessions(id) on delete cascade,
    org_id uuid not null references organizations(id) on delete cascade,
    user_id bigint not null references users(id) on delete cascade,
    full_name text not null,
    title text,
    id_document_id text not null,
    attestation boolean not null,
    status text not null default 'pending',
    created_at timestamptz not null default now()
);

-- =========================
-- VERIFICATION ATTEMPTS (OTP / Email / SMS / Call)
-- =========================
create table if not exists verification_attempts (
    id uuid primary key,
    session_id uuid not null references onboarding_sessions(id) on delete cascade,
    org_id uuid not null references organizations(id) on delete cascade,
    user_id bigint not null references users(id) on delete cascade,
    method text not null, -- email | sms | call
    destination text,
    status text not null default 'sent', -- sent | verified | expired | failed
    otp_id text references otps(id) on delete set null,
    attempts int not null default 0,
    resend_count int not null default 0,
    created_at timestamptz not null default now(),
    verified_at timestamptz
);

create index if not exists idx_verification_attempts_session
    on verification_attempts(session_id);

-- =========================
-- VERIFICATION CALLS (Manual Review)
-- =========================
create table if not exists verification_calls (
    id uuid primary key,
    session_id uuid not null references onboarding_sessions(id) on delete cascade,
    org_id uuid not null references organizations(id) on delete cascade,
    user_id bigint not null references users(id) on delete cascade,
    scheduled_at timestamptz not null,
    status text not null default 'scheduled', -- scheduled | completed | canceled
    created_at timestamptz not null default now(),
    completed_at timestamptz
);
