CREATE TABLE IF NOT EXISTS sync_runs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source         text        NOT NULL,
  status         text        NOT NULL DEFAULT 'running'
                             CHECK (status IN ('running','success','partial','failed')),
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  inserted_count integer,
  error          text,
  result         jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own sync_runs"
  ON sync_runs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX sync_runs_user_status ON sync_runs (user_id, status);
CREATE INDEX sync_runs_user_started ON sync_runs (user_id, started_at DESC);
