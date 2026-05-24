create table if not exists tasks_sync (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  source       text not null default 'todoist',
  external_id  text not null,
  title        text not null,
  project_name text,
  priority     text not null default 'low' check (priority in ('urgent','high','medium','low')),
  due_date     date,
  url          text,
  is_completed boolean not null default false,
  synced_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  constraint tasks_sync_unique unique (user_id, source, external_id)
);

alter table tasks_sync enable row level security;

create policy "Users see own tasks"
  on tasks_sync for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index tasks_sync_user_priority on tasks_sync (user_id, priority, due_date);
