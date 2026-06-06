-- ── Module réconciliation CSV ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS csv_imports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename     text        NOT NULL,
  type         text        NOT NULL CHECK (type IN ('carte','compte')),
  uploaded_at  timestamptz NOT NULL DEFAULT now(),
  row_count    integer     NOT NULL DEFAULT 0,
  status       text        NOT NULL DEFAULT 'parsed'
                           CHECK (status IN ('parsed','confirmed','error'))
);

ALTER TABLE csv_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own csv_imports"
  ON csv_imports FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX csv_imports_user_uploaded ON csv_imports (user_id, uploaded_at DESC);

-- ── Bank transactions (données brutes du relevé bancaire) ─────────────────────

CREATE TABLE IF NOT EXISTS bank_transactions (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  import_id        uuid          NOT NULL REFERENCES csv_imports(id) ON DELETE CASCADE,
  date             date          NOT NULL,
  label            text          NOT NULL,
  amount           numeric(12,2) NOT NULL,  -- signed: négatif = débit, positif = crédit
  category_bank    text,                    -- Catégorie SG (Carte CSV uniquement)
  type_operation   text,                    -- Virement / Prélèvement / … (Compte CSV)
  matched_entry_id uuid          REFERENCES finance_entries(id) ON DELETE SET NULL,
  match_status     text          NOT NULL DEFAULT 'unmatched'
                                 CHECK (match_status IN ('matched','unmatched','excluded'))
);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bank_transactions"
  ON bank_transactions FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX bank_transactions_import   ON bank_transactions (import_id);
CREATE INDEX bank_transactions_user_date ON bank_transactions (user_id, date DESC);
CREATE INDEX bank_transactions_status   ON bank_transactions (user_id, match_status);
