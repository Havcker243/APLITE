-- Migration 002: API keys and resolution audit logs

-- API keys for partner/programmatic access to the resolve endpoint
create table if not exists api_keys (
    id uuid primary key default gen_random_uuid(),
    user_id bigint not null references users(id) on delete cascade,
    name text not null,
    key_hash text not null unique,
    key_prefix text not null,
    scopes jsonb not null default '["resolve"]'::jsonb,
    last_used_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_user on api_keys(user_id);
create index if not exists idx_api_keys_hash on api_keys(key_hash);

-- Resolution audit log: every successful UPI resolution is recorded here
create table if not exists resolution_logs (
    id bigserial primary key,
    upi text not null,
    rail text not null,
    requester_user_id bigint references users(id) on delete set null,
    api_key_id uuid references api_keys(id) on delete set null,
    requester_ip text,
    resolved_at timestamptz not null default now()
);

create index if not exists idx_resolution_logs_upi on resolution_logs(upi);
create index if not exists idx_resolution_logs_user on resolution_logs(requester_user_id);
create index if not exists idx_resolution_logs_key on resolution_logs(api_key_id);
