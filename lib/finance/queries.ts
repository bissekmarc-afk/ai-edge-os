import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { FinanceEntry } from "./aggregations"
import type { NonCashRow } from "./types"

// ─── Last month that has real data ────────────────────────────────────────────

export async function getLastDataMonth(): Promise<{ month: number; year: number } | null> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return null

  const today  = new Date()
  const todayY = today.getFullYear()
  const todayM = today.getMonth() + 1   // 1-based

  // Fetch all cash entry (year, month) pairs from 2026 onward.
  // We count entries per pair client-side so we can pick the most-populated
  // month ≤ today — handles sparse future budget columns in the spreadsheet.
  const { data, error } = await supabase
    .from("finance_entries")
    .select("month, year")
    .eq("is_subtotal", false)
    .eq("is_non_cash",  false)
    .gte("year", 2026)
    .not("month", "is", null)
    .not("year",  "is", null)
    .order("year",  { ascending: false })
    .order("month", { ascending: false })
    .limit(2000)

  if (error || !data || data.length === 0) return null

  // Count entries per (year, month), excluding months that haven't arrived yet
  const counts = new Map<string, { month: number; year: number; count: number }>()
  for (const row of data) {
    const m = row.month as number
    const y = row.year  as number
    if (y > todayY || (y === todayY && m > todayM)) continue
    const key = `${y}-${m}`
    const entry = counts.get(key)
    if (entry) entry.count++
    else counts.set(key, { month: m, year: y, count: 1 })
  }

  if (counts.size === 0) return null

  // Most recent month ≤ today; tie-break by most entries (densest data)
  const best = [...counts.values()].sort((a, b) => {
    const delta = (b.year * 12 + b.month) - (a.year * 12 + a.month)
    return delta !== 0 ? delta : b.count - a.count
  })[0]

  return { month: best.month, year: best.year }
}

// ─── All rows for a given month (P&L computation) ─────────────────────────────

export async function getMonthRows(month: number, year: number): Promise<FinanceEntry[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("finance_entries")
    .select("id, category, label, amount, entry_type, entry_subtype, flux_nature, month, year, is_non_cash, is_subtotal")
    .eq("month",       month)
    .eq("year",        year)
    .eq("is_subtotal", false)
    .eq("is_non_cash", false)

  if (error || !data) return []
  return data as FinanceEntry[]
}

// ─── All rows for a given year (annual chart) ─────────────────────────────────

export async function getYearRows(year: number): Promise<FinanceEntry[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("finance_entries")
    .select("id, category, label, amount, entry_type, entry_subtype, flux_nature, month, year, is_non_cash, is_subtotal")
    .eq("year",        year)
    .eq("is_subtotal", false)
    .eq("is_non_cash", false)

  if (error || !data) return []
  return data as FinanceEntry[]
}

// ─── Non-cash rows for a given month (balance sheet items) ────────────────────

export async function getNonCashRows(month: number, year: number): Promise<NonCashRow[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("finance_entries")
    .select("label, amount, month, year")
    .eq("month",       month)
    .eq("year",        year)
    .eq("is_subtotal", false)
    .eq("is_non_cash", true)

  if (error || !data) return []
  return data as NonCashRow[]
}
