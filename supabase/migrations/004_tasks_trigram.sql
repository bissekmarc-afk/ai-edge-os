-- Enable pg_trgm for efficient ILIKE / full-text search on task titles
create extension if not exists pg_trgm;

create index if not exists tasks_sync_title_trgm
  on tasks_sync using gin (title gin_trgm_ops);

-- Composite index for the "All Tasks" view (search + filter + sort by due_date)
create index if not exists tasks_sync_user_completed_due
  on tasks_sync (user_id, is_completed, due_date asc nulls last);
