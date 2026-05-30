// ─── lib/finance/budget-queries.ts ───────────────────────────────────────────
//
// Supabase queries for budget_initial and reforecast_6m scenarios,
// used by VarianceTable and FYForecastCard.

import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { FinanceEntry } from "./aggregations"

// ─── Budget scope constants ───────────────────────────────────────────────────
//
// The Google Sheets budget covers May 2026 → December 2026.
// Any request for an earlier month must return an empty array — there is no
// budget data before May 2026 and stale rows must never leak through.

const BUDGET_START_MONTH = 5
const BUDGET_START_YEAR  = 2026

// ─── Common select fragment ───────────────────────────────────────────────────

const ENTRY_SELECT =
  "id, category, label, amount, entry_type, entry_subtype, flux_nature, month, year, is_non_cash, is_subtotal, scenario"

// ─── Single-month queries ─────────────────────────────────────────────────────

/** Fetch actual entries for a given month (cash only, non-deleted). */
export async function getActualMonthRows(
  month: number,
  year:  number,
): Promise<FinanceEntry[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("finance_entries")
    .select(ENTRY_SELECT)
    .eq("month",       month)
    .eq("year",        year)
    .eq("scenario",    "actual")
    .eq("is_subtotal", false)
    .eq("is_non_cash", false)
    .neq("sync_status", "deleted")

  if (error || !data) return []
  return data as FinanceEntry[]
}

/** Fetch budget_initial entries for a given month. */
export async function getBudgetMonthRows(
  month: number,
  year:  number,
): Promise<FinanceEntry[]> {
  // Budget scope: May 2026 → December 2026 — reject out-of-scope months
  if (year !== BUDGET_START_YEAR || month < BUDGET_START_MONTH) return []

  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("finance_entries")
    .select(ENTRY_SELECT)
    .eq("month",       month)
    .eq("year",        year)
    .eq("scenario",    "budget_initial")
    .eq("is_subtotal", false)
    .eq("is_non_cash", false)

  if (error || !data) return []
  return data as FinanceEntry[]
}

/** Fetch reforecast_6m entries for a given month. */
export async function getReforecastMonthRows(
  month: number,
  year:  number,
): Promise<FinanceEntry[]> {
  // Reforecast shares the same budget scope: May 2026 → December 2026
  if (year !== BUDGET_START_YEAR || month < BUDGET_START_MONTH) return []

  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("finance_entries")
    .select(ENTRY_SELECT)
    .eq("month",       month)
    .eq("year",        year)
    .eq("scenario",    "reforecast_6m")
    .eq("is_subtotal", false)
    .eq("is_non_cash", false)

  if (error || !data) return []
  return data as FinanceEntry[]
}

// ─── Full-year queries (for FYForecastCard) ───────────────────────────────────

export interface YearScenarioRows {
  actual:          FinanceEntry[]
  budget_initial:  FinanceEntry[]
  reforecast_6m:   FinanceEntry[]
}

/**
 * Fetches all three scenarios for a full year in a single query, then splits
 * by scenario.  This avoids three round-trips and keeps the RLS check once.
 */
export async function getAllScenariosForYear(year: number): Promise<YearScenarioRows> {
  const supabase = await createSupabaseServerClient()
  const empty: YearScenarioRows = { actual: [], budget_initial: [], reforecast_6m: [] }
  if (!supabase) return empty

  const { data, error } = await supabase
    .from("finance_entries")
    .select(ENTRY_SELECT)
    .eq("year",        year)
    .eq("is_subtotal", false)
    .eq("is_non_cash", false)
    .in("scenario",    ["actual", "budget_initial", "reforecast_6m"])
    .neq("sync_status", "deleted")
    .not("month",      "is", null)   // exclude rows with null month

  if (error || !data) return empty

  const result: YearScenarioRows = { actual: [], budget_initial: [], reforecast_6m: [] }
  for (const row of data) {
    const s = (row as { scenario: string; month: number }).scenario
    const m = (row as { scenario: string; month: number }).month
    if (s === "actual") {
      result.actual.push(row as FinanceEntry)
    } else if (s === "budget_initial") {
      // Budget scope: May 2026 → December 2026 only
      if (year === BUDGET_START_YEAR && m >= BUDGET_START_MONTH) {
        result.budget_initial.push(row as FinanceEntry)
      }
    } else if (s === "reforecast_6m") {
      // Reforecast shares the same scope
      if (year === BUDGET_START_YEAR && m >= BUDGET_START_MONTH) {
        result.reforecast_6m.push(row as FinanceEntry)
      }
    }
  }

  // ── Debug: show which months are present per scenario ──────────────────────
  const months = (arr: FinanceEntry[]) =>
    [...new Set(arr.map(r => r.month))].sort((a, b) => (a ?? 0) - (b ?? 0)).join(",")

  console.log(
    `[getAllScenariosForYear] year=${year}` +
    ` | actual: ${result.actual.length} rows, months=[${months(result.actual)}]` +
    ` | budget_initial: ${result.budget_initial.length} rows, months=[${months(result.budget_initial)}]` +
    ` | reforecast_6m: ${result.reforecast_6m.length} rows, months=[${months(result.reforecast_6m)}]`,
  )

  return result
}
