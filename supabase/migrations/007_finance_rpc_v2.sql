-- ─── 007_finance_rpc_v2.sql ───────────────────────────────────────────────────
--
-- Extends the bulk upsert RPC to cover sync_status and validated columns,
-- and adds a dedicated RPC to update sync_status after a Google Sheets write.
--
-- Both columns exist in PostgreSQL (added in migration 002) but were absent
-- from upsert_finance_entries_batch, causing the direct .upsert() in the
-- /saisie route to hit PostgREST's stale schema cache.


-- ── 1. Updated bulk upsert — now includes sync_status + validated ─────────────

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
    validated,
    sync_status,
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
    COALESCE((e->>'validated')::boolean, false),
    COALESCE(e->>'sync_status', 'pending'),
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
    validated     = EXCLUDED.validated,
    sync_status   = EXCLUDED.sync_status,
    synced_at     = EXCLUDED.synced_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_finance_entries_batch(jsonb) TO authenticated;


-- ── 2. Point update — sync_status only ───────────────────────────────────────
--
-- Called after the Google Sheets write attempt so the row reflects whether
-- the sheet sync succeeded or failed.  SECURITY INVOKER ensures RLS applies
-- (only the authenticated user's own rows are reachable).

CREATE OR REPLACE FUNCTION public.update_finance_entry_sync_status(
  p_user_id    uuid,
  p_external_id text,
  p_sync_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE finance_entries
  SET sync_status = p_sync_status
  WHERE user_id    = p_user_id
    AND external_id = p_external_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_finance_entry_sync_status(uuid, text, text) TO authenticated;
