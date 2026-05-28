-- ─── 008_budget_scenarios.sql ────────────────────────────────────────────────
--
-- Adds first-class budget/reforecast scenario support to finance_entries.
--
-- Ordre d'exécution impératif :
--   1. Backfill scenario NULL/'budget' → 'budget_initial'  (données propres d'abord)
--   2. Ajouter CHECK constraint                            (valide les données déjà propres)
--   3. Créer UNIQUE(user_id, source, scenario, external_id)
--   4. Supprimer ancienne UNIQUE(user_id, source, external_id)
--   5. Créer index couvrant (user_id, scenario, year, month)

BEGIN;

-- ── 1. Backfill : normaliser les valeurs legacy AVANT toute contrainte ─────────
--
--    Le CHECK (étape 2) valide les lignes existantes au moment de son ajout.
--    Le backfill doit donc précéder la contrainte, sans exception.

UPDATE finance_entries
SET scenario = 'budget_initial'
WHERE scenario IS NULL OR scenario = 'budget';

-- ── 2. CHECK constraint sur les valeurs de scenario ───────────────────────────
--
--    Après le backfill, toutes les lignes sont dans ('actual', 'budget_initial').
--    DROP IF EXISTS d'abord pour rendre la migration idempotente.

ALTER TABLE finance_entries
  DROP CONSTRAINT IF EXISTS finance_entries_scenario_check;

ALTER TABLE finance_entries
  ADD CONSTRAINT finance_entries_scenario_check
  CHECK (scenario IN ('actual', 'budget_initial', 'reforecast_6m'));

-- ── 3. Nouvelle UNIQUE incluant scenario ──────────────────────────────────────
--
--    CREATE UNIQUE INDEX IF NOT EXISTS évite l'erreur si l'index existe déjà.
--    Le RPC utilise ON CONFLICT (colonnes), pas le nom de contrainte — l'index suffit.

CREATE UNIQUE INDEX IF NOT EXISTS finance_entries_unique_scenario
  ON finance_entries (user_id, source, scenario, external_id);

-- ── 4. Supprimer l'ancienne UNIQUE sans scenario ──────────────────────────────
--
--    Idempotent : vérifie via pg_constraint avant de dropper.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'finance_entries'
      AND c.conname  = 'finance_entries_unique'
      AND c.contype  = 'u'
  ) THEN
    ALTER TABLE finance_entries DROP CONSTRAINT finance_entries_unique;
  END IF;
END;
$$;

-- ── 5. Index couvrant pour les requêtes Budget vs Actual ──────────────────────

CREATE INDEX IF NOT EXISTS finance_entries_user_scenario_year_month
  ON finance_entries (user_id, scenario, year, month);

-- ── Mise à jour du RPC upsert — ON CONFLICT sur la nouvelle clé ───────────────
--
--    L'ancienne clé (user_id, source, external_id) n'existe plus.
--    La nouvelle clé inclut scenario — chaque ligne de scénario est indépendante.

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
  ON CONFLICT (user_id, source, scenario, external_id) DO UPDATE SET
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
    validated     = EXCLUDED.validated,
    sync_status   = EXCLUDED.sync_status,
    synced_at     = EXCLUDED.synced_at;
  -- scenario est exclu du DO UPDATE : chaque ligne de scénario est indépendante.

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_finance_entries_batch(jsonb) TO authenticated;

COMMIT;
