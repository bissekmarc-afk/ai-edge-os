-- ── Extend finance_entries with DAF-specific columns ──────────────────────────
alter table finance_entries
  add column if not exists entry_subtype text,           -- Fixed / Variable / One-off / Seasonal
  add column if not exists flux_nature   text,           -- Cash In / Cash Out / Non-cash
  add column if not exists is_non_cash   boolean not null default false,
  add column if not exists is_subtotal   boolean not null default false,
  add column if not exists month         smallint,       -- 1–12
  add column if not exists year          smallint,       -- 2026
  add column if not exists scenario      text    not null default 'actual';

-- Fast path for the dashboard's primary queries
create index if not exists finance_entries_user_year_month
  on finance_entries (user_id, year, month, entry_type, is_non_cash, is_subtotal);

-- ── Wealth snapshots ──────────────────────────────────────────────────────────
create table if not exists wealth_snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  asset_name    text not null,
  asset_class   text not null default 'other',
  amount        numeric(14,2) not null,
  currency      text not null default 'EUR',
  source        text not null default 'google_sheets',
  created_at    timestamptz not null default now(),
  constraint wealth_snapshots_unique unique (user_id, snapshot_date, asset_name)
);

alter table wealth_snapshots enable row level security;

create policy "Users manage own wealth snapshots"
  on wealth_snapshots for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists wealth_snapshots_user_date
  on wealth_snapshots (user_id, snapshot_date desc);
