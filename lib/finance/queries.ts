import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { FinanceRow } from "./types"

// ─── Last month that has real data ────────────────────────────────────────────

export async function getLastDataMonth(): Promise<{ month: number; year: number } | null> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("finance_entries")
    .select("month, year")
    .eq("is_subtotal", false)
    .eq("is_non_cash",  false)
    .not("month", "is", null)
    .not("year",  "is", null)
    .order("year",  { ascending: false })
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return { month: data.month as number, year: data.year as number }
}

// ─── All rows for a given month (P&L computation) ─────────────────────────────

export async function getMonthRows(month: number, year: number): Promise<FinanceRow[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("finance_entries")
    .select("category, label, amount, entry_type, month, year")
    .eq("month",       month)
    .eq("year",        year)
    .eq("is_subtotal", false)
    .eq("is_non_cash", false)

  if (error || !data) return []
  return data as FinanceRow[]
}

// ─── All rows for a given year (annual chart) ─────────────────────────────────

export async function getYearRows(year: number): Promise<FinanceRow[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("finance_entries")
    .select("category, label, amount, entry_type, month, year")
    .eq("year",        year)
    .eq("is_subtotal", false)
    .eq("is_non_cash", false)

  if (error || !data) return []
  return data as FinanceRow[]
}
