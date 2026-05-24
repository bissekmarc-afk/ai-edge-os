create table if not exists finance_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  source       text not null default 'google_sheets',
  external_id  text not null,
  date         date not null,
  category     text not null default '',
  label        text not null,
  amount       numeric(12,2) not null,
  currency     text not null default 'EUR',
  entry_type   text not null check (entry_type in ('income','expense')),
  is_recurring boolean not null default false,
  synced_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  constraint finance_entries_unique unique (user_id, source, external_id)
);

alter table finance_entries enable row level security;

create policy "Users see own finance entries"
  on finance_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index finance_entries_user_date on finance_entries (user_id, date desc);
create index finance_entries_user_type on finance_entries (user_id, entry_type);
