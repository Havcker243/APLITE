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
create unique index if not exists idx_businesses_ein_per_user on businesses(user_id, ein);
create unique index if not exists idx_payment_accounts_unique_pi on payment_accounts(user_id, payment_index, rail);
