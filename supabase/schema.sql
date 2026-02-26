-- AJA Wealth Management — Supabase Schema
-- Run this in the Supabase SQL editor after creating a project.

-- ────────────────────────────────────────────────────────────
-- Profiles (extends auth.users)
-- ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- Instruments (read-only reference data)
-- ────────────────────────────────────────────────────────────
create table if not exists public.instruments (
  ticker text primary key,
  name text not null,
  asset_type text not null check (asset_type in ('Stock', 'ETF')),
  exchange text,
  last_price numeric(12,4),
  last_price_updated_at timestamptz default now()
);

alter table public.instruments enable row level security;
create policy "Anyone can read instruments" on public.instruments
  for select using (true);

-- ────────────────────────────────────────────────────────────
-- Portfolios
-- ────────────────────────────────────────────────────────────
create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  primary_benchmark text references public.instruments(ticker),
  secondary_benchmarks text[] default '{}',
  created_at timestamptz default now(),
  last_updated_at timestamptz default now()
);

alter table public.portfolios enable row level security;
create policy "Users can manage own portfolios" on public.portfolios
  for all using (auth.uid() = owner);

-- ────────────────────────────────────────────────────────────
-- Portfolio Holdings
-- ────────────────────────────────────────────────────────────
create table if not exists public.portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  ticker text not null references public.instruments(ticker),
  weight_percent numeric(7,4) not null check (weight_percent >= 0 and weight_percent <= 100),
  unique (portfolio_id, ticker)
);

alter table public.portfolio_holdings enable row level security;
create policy "Users can manage holdings of own portfolios" on public.portfolio_holdings
  for all using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.owner = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- Performance Snapshots
-- ────────────────────────────────────────────────────────────
create table if not exists public.performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  snapshot_date date not null,
  timeframe text not null,
  portfolio_return_pct numeric(10,4),
  benchmark_return_pct numeric(10,4),
  outperformance_pct numeric(10,4),
  benchmark_used text,
  data_source text not null default 'historical' check (data_source in ('historical', 'backtest')),
  created_at timestamptz default now()
);

alter table public.performance_snapshots enable row level security;
create policy "Users can manage snapshots of own portfolios" on public.performance_snapshots
  for all using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.owner = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- User Default Benchmarks / Account Settings
-- ────────────────────────────────────────────────────────────
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  primary_benchmark text,
  inherit_defaults boolean default true,
  default_timeframe text default '1Y',
  hidden_timeframes text[] default '{}',
  default_chart_range text default '1Y',
  snapshot_refresh_interval integer default 60,
  default_portfolio_template text,
  confirm_deletes boolean default true,
  activity_log_granularity text default 'standard',
  updated_at timestamptz default now()
);

alter table public.user_settings enable row level security;
create policy "Users can manage own settings" on public.user_settings
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- Activity Log
-- ────────────────────────────────────────────────────────────
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid,  -- no FK to portfolios; app uses user_portfolios JSONB blob
  portfolio_name text,
  action_type text not null check (action_type in ('Create', 'Update', 'Duplicate', 'Delete')),
  change_summary text,
  occurred_at timestamptz default now()
);

alter table public.activity_log enable row level security;
create policy "Users can manage own activity log" on public.activity_log
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- User Portfolios (JSONB blob for cross-browser sync)
-- This table stores the full portfolios array per user as a
-- single JSONB document, mirroring the localStorage format.
-- This enables cross-browser sync without schema normalization.
-- ────────────────────────────────────────────────────────────
create table if not exists public.user_portfolios (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '[]',
  settings   jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.user_portfolios enable row level security;
create policy "Users manage own portfolios"
  on public.user_portfolios for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- Share Tokens (read-only client share links)
-- Stores a snapshot of a portfolio at the time it was shared.
-- Public read access (no auth required) so share links work
-- for unauthenticated clients.
-- ────────────────────────────────────────────────────────────
create table if not exists public.share_tokens (
  token                text primary key default encode(gen_random_bytes(20), 'hex'),
  owner_id             uuid not null references auth.users(id) on delete cascade,
  portfolio_snapshot   jsonb not null,
  created_at           timestamptz not null default now()
);

alter table public.share_tokens enable row level security;

-- Anyone with the token URL can read the record (enables unauthenticated share links)
create policy "Public can read share tokens"
  on public.share_tokens for select using (true);

-- Only the owner can create or delete their own share tokens
create policy "Owners manage own share tokens"
  on public.share_tokens for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ────────────────────────────────────────────────────────────
-- Messages (advisor ↔ client communication per portfolio)
-- ────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null,
  sender_id    uuid not null references auth.users(id) on delete cascade,
  sender_email text,
  sender_role  text not null check (sender_role in ('advisor', 'client')),
  type         text not null default 'comment' check (type in ('comment', 'approval', 'change_request')),
  text         text not null,
  created_at   timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Users can read messages for their portfolios"
  on public.messages for select using (
    auth.uid() = sender_id
    or exists (
      select 1 from public.invites i
      where i.portfolio_ids @> array[messages.portfolio_id]
        and (i.advisor_id = auth.uid() or i.accepted_by = auth.uid())
    )
  );

create policy "Users can send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

-- ────────────────────────────────────────────────────────────
-- Invites (advisor → client invite links)
-- ────────────────────────────────────────────────────────────
create table if not exists public.invites (
  token              text primary key,
  advisor_id         uuid not null references auth.users(id) on delete cascade,
  client_email       text,
  portfolio_ids      uuid[],
  portfolio_snapshot jsonb,
  accepted_by        uuid references auth.users(id) on delete set null,
  accepted_at        timestamptz,
  created_at         timestamptz not null default now()
);

alter table public.invites enable row level security;

create policy "Anyone can read invites by token"
  on public.invites for select using (true);

create policy "Advisors can create invites"
  on public.invites for insert
  with check (auth.uid() = advisor_id);
