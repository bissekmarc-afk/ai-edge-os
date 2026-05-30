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
//
// scenario must be a valid DB value: 'actual' | 'budget_initial' | 'reforecast_6m'
// Never mix scenarios — the P&L must show a single coherent view.

export async function getMonthRows(
  month:    number,
  year:     number,
  scenario: "actual" | "budget_initial" | "reforecast_6m" = "actual",
): Promise<FinanceEntry[]> {
  // Budget scope: May 2026 → December 2026.
  // Requesting a budget/reforecast month outside this scope returns nothing.
  if (
    (scenario === "budget_initial" || scenario === "reforecast_6m") &&
    (year !== 2026 || month < 5)
  ) {
    return []
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("finance_entries")
    .select("id, category, label, amount, entry_type, entry_subtype, flux_nature, month, year, is_non_cash, is_subtotal, scenario")
    .eq("month",       month)
    .eq("year",        year)
    .eq("scenario",    scenario)
    .eq("is_subtotal", false)
    .eq("is_non_cash", false)
    .neq("sync_status", "deleted")

  if (error || !data) return []
  return data as FinanceEntry[]
}

// ─── All rows for a given year (annual chart) ─────────────────────────────────

export async function getYearRows(
  year:     number,
  scenario: "actual" | "budget_initial" | "reforecast_6m" = "actual",
): Promise<FinanceEntry[]> {
  // Budget scope: May 2026 → December 2026 — reject the whole year if out of scope.
  if (
    (scenario === "budget_initial" || scenario === "reforecast_6m") &&
    year !== 2026
  ) {
    return []
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  let query = supabase
    .from("finance_entries")
    .select("id, category, label, amount, entry_type, entry_subtype, flux_nature, month, year, is_non_cash, is_subtotal, scenario")
    .eq("year",        year)
    .eq("scenario",    scenario)
    .eq("is_subtotal", false)
    .eq("is_non_cash", false)
    .neq("sync_status", "deleted")

  // Enforce month >= 5 at the DB level so January-April rows are never fetched
  if (scenario === "budget_initial" || scenario === "reforecast_6m") {
    query = query.gte("month", 5)
  }

  const { data, error } = await query

  if (error || !data) return []
  return data as FinanceEntry[]
}

// ─── Distinct labels from budget_initial (for saisie combobox) ───────────────

export interface BudgetLabel {
  label:    string
  category: string
}

/**
 * Returns deduplicated (label, category) pairs from budget_initial entries.
 * Used to populate the label combobox in FinanceEntryForm so manual entries
 * can match budget lines exactly.
 */
export async function getBudgetLabels(): Promise<BudgetLabel[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("finance_entries")
    .select("label, category")
    .eq("scenario",    "budget_initial")
    .eq("is_subtotal", false)
    .not("label", "is", null)
    .order("category", { ascending: true })
    .order("label",    { ascending: true })
    .limit(500)

  if (error || !data) return []

  // Deduplicate by label text (keep first category encountered)
  const seen   = new Set<string>()
  const result: BudgetLabel[] = []
  for (const row of data) {
    const lbl = (row.label as string | null)?.trim() ?? ""
    if (lbl && !seen.has(lbl)) {
      seen.add(lbl)
      result.push({ label: lbl, category: (row.category as string | null) ?? "" })
    }
  }
  return result
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
