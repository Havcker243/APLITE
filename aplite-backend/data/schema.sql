-- Minimal Postgres schema for the Aplite backend.

create table if not exists users (
    id serial primary key,
    first_name text not null,
    last_name text not null,
    email text not null unique,
    company text not null default '',
    company_name text not null default '',
    summary text not null default '',
    established_year int,
    state text,
    country text,
    password_hash text not null,
    master_upi text not null,
    created_at timestamptz not null default now()
);

create table if not exists sessions (
    token text primary key,
    user_id int not null references users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists otps (
    id text primary key,
    user_id int not null references users(id) on delete cascade,
    digest text not null,
    salt text not null,
    expires_at timestamptz not null,
    consumed boolean not null default false
);

-- Onboarding (KYB/KYC) tables
create table if not exists organizations (
    id uuid primary key,
    user_id int not null references users(id) on delete cascade,
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
    issued_upi text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_organizations_user on organizations(user_id);
create unique index if not exists idx_organizations_user_ein on organizations(user_id, ein);

create table if not exists onboarding_sessions (
    id uuid primary key,
    org_id uuid not null references organizations(id) on delete cascade,
    user_id int not null references users(id) on delete cascade,
    state text not null,
    current_step int not null default 1,
    step_statuses jsonb not null default '{}'::jsonb,
    risk_level text not null default 'low',
    address_locked boolean not null default false,
    last_saved_at timestamptz not null default now(),
    completed_at timestamptz
);

create index if not exists idx_onboarding_sessions_user on onboarding_sessions(user_id);
create index if not exists idx_onboarding_sessions_org on onboarding_sessions(org_id);

create table if not exists identity_verifications (
    id uuid primary key,
    session_id uuid not null references onboarding_sessions(id) on delete cascade,
    org_id uuid not null references organizations(id) on delete cascade,
    user_id int not null references users(id) on delete cascade,
    full_name text not null,
    title text,
    id_document_id text not null,
    attestation boolean not null,
    status text not null default 'pending',
    created_at timestamptz not null default now()
);

create table if not exists bank_rail_mappings (
    id uuid primary key,
    session_id uuid not null references onboarding_sessions(id) on delete cascade,
    org_id uuid not null references organizations(id) on delete cascade,
    user_id int not null references users(id) on delete cascade,
    bank_name text not null,
    account_last4 text not null,
    account_number_enc jsonb not null,
    ach_routing text,
    wire_routing text,
    swift text,
    created_at timestamptz not null default now()
);

create table if not exists verification_attempts (
    id uuid primary key,
    session_id uuid not null references onboarding_sessions(id) on delete cascade,
    org_id uuid not null references organizations(id) on delete cascade,
    user_id int not null references users(id) on delete cascade,
    method text not null, -- email | sms | call
    destination text,
    status text not null default 'sent', -- sent | verified | expired | failed
    otp_id text references otps(id) on delete set null,
    attempts int not null default 0,
    resend_count int not null default 0,
    created_at timestamptz not null default now(),
    verified_at timestamptz
);

create table if not exists verification_calls (
    id uuid primary key,
    session_id uuid not null references onboarding_sessions(id) on delete cascade,
    org_id uuid not null references organizations(id) on delete cascade,
    user_id int not null references users(id) on delete cascade,
    scheduled_at timestamptz not null,
    status text not null default 'scheduled', -- scheduled | completed | canceled
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

create table if not exists businesses (
    id serial primary key,
    user_id int not null references users(id) on delete cascade,
    parent_upi text not null,
    upi text not null unique,
    payment_account_id int,
    rails jsonb not null default '[]'::jsonb,
    core_entity_id text not null,
    legal_name text not null,
    ein text not null,
    business_type text not null,
    website text,
    address text not null,
    country text not null,
    verification_status text not null,
    status text not null default 'active',
    created_at timestamptz not null default now()
);

create table if not exists payment_accounts (
    id serial primary key,
    user_id int not null references users(id) on delete cascade,
    business_id int references businesses(id) on delete set null,
    payment_index int not null,
    rail text not null,
    bank_name text not null,
    account_name text,
    enc jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_payment_accounts_user on payment_accounts(user_id);
create index if not exists idx_payment_accounts_business on payment_accounts(business_id);
create index if not exists idx_businesses_user on businesses(user_id);
create index if not exists idx_businesses_user_id_desc on businesses(user_id, id desc);
create unique index if not exists idx_businesses_ein_per_user on businesses(user_id, ein);
create unique index if not exists idx_payment_accounts_unique_pi on payment_accounts(user_id, payment_index, rail);
