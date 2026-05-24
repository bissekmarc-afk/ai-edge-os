create table if not exists ai_memory (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  title             text not null,
  content           text not null,
  category          text not null default 'general'
                      check (category in ('general','goals','habits','preferences','projects','personal')),
  sensitivity_level text not null default 'low'
                      check (sensitivity_level in ('low','medium','high')),
  confidence_score  numeric(3,2) not null default 0.90
                      check (confidence_score between 0 and 1),
  confirmed_by_user boolean not null default false,
  source            text not null default 'claude',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table ai_memory enable row level security;

create policy "Users manage own memories"
  on ai_memory for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Most common query: recent confirmed memories for context injection
create index ai_memory_user_confirmed
  on ai_memory (user_id, confirmed_by_user, created_at desc);

-- Secondary: filter by category
create index ai_memory_user_category
  on ai_memory (user_id, category);
