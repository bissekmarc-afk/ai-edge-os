import { createSupabaseServerClient } from "@/lib/supabase/server"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ManualEntry {
  id:            string
  external_id:   string
  date:          string
  label:         string
  category:      string
  entry_subtype: string | null
  flux_nature:   string
  amount:        number
  month:         number
  year:          number
  sync_status:   string | null
  created_at:    string | null
}

// ─── Query ────────────────────────────────────────────────────────────────────

export async function getManualEntries(): Promise<ManualEntry[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("finance_entries")
    .select("id, external_id, date, label, category, entry_subtype, flux_nature, amount, month, year, sync_status, created_at")
    .eq("user_id",  user.id)
    .eq("source",   "manual_saisie")
    .neq("sync_status", "deleted")
    .order("created_at", { ascending: false })
    .limit(30)

  if (error || !data) return []
  return data as ManualEntry[]
}
