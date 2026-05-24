-- ─── 006_finance_rpc.sql ─────────────────────────────────────────────────────
--
-- RPC helpers that bypass PostgREST's schema cache.
--
-- Problem: PostgREST caches the table schema at startup. If migration 005 was
-- applied while PostgREST was running (i.e. on a live Supabase project), the
-- new columns (flux_nature, month, year, scenario, ...) are invisible to
-- PostgREST's column parser. Any .select()/.upsert() that references them
-- returns "column does not exist" — even though PostgreSQL knows about them.
--
-- Solution: move the critical operations into SQL functions called via rpc().
-- PostgREST forwards the JSONB args to PostgreSQL without resolving column
-- names, so the function body executes against the real current schema.


-- ── 1. Column introspection ───────────────────────────────────────────────────
--
-- Returns every column of a public table with its data type.
-- Used by the debug route to verify migration 005 was applied.

CREATE OR REPLACE FUNCTION public.check_finance_columns()
RETURNS TABLE(column_name text, data_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.column_name::text,
    c.data_type::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name   = 'finance_entries'
  ORDER BY c.ordinal_position;
$$;

GRANT EXECUTE ON FUNCTION public.check_finance_columns() TO authenticated;


-- ── 2. PostgREST schema-cache reload ─────────────────────────────────────────
--
-- Sends the standard NOTIFY that causes PostgREST to re-read the DB schema.
-- After this fires, all subsequent direct .select()/.upsert() calls will work.
-- The reload is asynchronous (PostgREST acts on the next request cycle), so
-- callers that need the new columns immediately should still use the batch
-- upsert below.

CREATE OR REPLACE FUNCTION public.reload_pgrst_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

GRANT EXECUTE ON FUNCTION public.reload_pgrst_schema() TO authenticated;


-- ── 3. Bulk upsert — finance_entries ─────────────────────────────────────────
--
-- Receives a JSONB array of entry objects and upserts them in a single
-- INSERT … ON CONFLICT statement.  Runs as SECURITY INVOKER so RLS applies
-- (only rows where user_id = auth.uid() are accepted).

CREATE OR REPLACE FUNCTION public.upsert_finance_entries_batch(p_entries jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO finance_entries (
    user_id,
    source,
    external_id,
    date,
    category,
    label,
    amount,
    currency,
    entry_type,
    entry_subtype,
    flux_nature,
    is_non_cash,
    is_subtotal,
    is_recurring,
    month,
    year,
    scenario,
    synced_at
  )
  SELECT
    (e->>'user_id')::uuid,
    e->>'source',
    e->>'external_id',
    (e->>'date')::date,
    COALESCE(e->>'category', ''),
    e->>'label',
    (e->>'amount')::numeric,
    COALESCE(e->>'currency', 'EUR'),
    e->>'entry_type',
    e->>'entry_subtype',
    e->>'flux_nature',
    COALESCE((e->>'is_non_cash')::boolean,  false),
    COALESCE((e->>'is_subtotal')::boolean,  false),
    COALESCE((e->>'is_recurring')::boolean, false),
    (e->>'month')::smallint,
    (e->>'year')::smallint,
    COALESCE(e->>'scenario', 'actual'),
    COALESCE((e->>'synced_at')::timestamptz, now())
  FROM jsonb_array_elements(p_entries) AS e
  ON CONFLICT (user_id, source, external_id) DO UPDATE SET
    date          = EXCLUDED.date,
    category      = EXCLUDED.category,
    label         = EXCLUDED.label,
    amount        = EXCLUDED.amount,
    entry_type    = EXCLUDED.entry_type,
    entry_subtype = EXCLUDED.entry_subtype,
    flux_nature   = EXCLUDED.flux_nature,
    is_non_cash   = EXCLUDED.is_non_cash,
    is_subtotal   = EXCLUDED.is_subtotal,
    is_recurring  = EXCLUDED.is_recurring,
    month         = EXCLUDED.month,
    year          = EXCLUDED.year,
    scenario      = EXCLUDED.scenario,
    synced_at     = EXCLUDED.synced_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_finance_entries_batch(jsonb) TO authenticated;


-- ── 4. Bulk upsert — wealth_snapshots ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_wealth_snapshots_batch(p_entries jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO wealth_snapshots (
    user_id,
    snapshot_date,
    asset_name,
    asset_class,
    amount,
    currency,
    source
  )
  SELECT
    (e->>'user_id')::uuid,
    (e->>'snapshot_date')::date,
    e->>'asset_name',
    COALESCE(e->>'asset_class', 'other'),
    (e->>'amount')::numeric,
    COALESCE(e->>'currency', 'EUR'),
    COALESCE(e->>'source', 'google_sheets')
  FROM jsonb_array_elements(p_entries) AS e
  ON CONFLICT (user_id, snapshot_date, asset_name) DO UPDATE SET
    asset_class = EXCLUDED.asset_class,
    amount      = EXCLUDED.amount,
    currency    = EXCLUDED.currency,
    source      = EXCLUDED.source;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_wealth_snapshots_batch(jsonb) TO authenticated;
