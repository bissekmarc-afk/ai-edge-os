// ─── lib/finance/reforecast-overlay.ts ───────────────────────────────────────
//
// Merges budget_initial and reforecast_6m scenarios into a single "active
// budget" view, applying per-category overlay rules.
//
// Key rules:
//   • Income, One-off, CAPEX → prefer reforecast_6m if present, else budget_initial
//   • Fixed Costs, Taxes, Debt Service → always use budget_initial
//   • Entry absent from both scenarios → amount 0, non_budgete flag true

import type { FinanceEntry } from "./aggregations"

// ─── Types ────────────────────────────────────────────────────────────────────

export type Scenario = "actual" | "budget_initial" | "reforecast_6m"

/** A finance entry augmented with scenario metadata. */
export type FinanceEntryWithScenario = FinanceEntry & {
  scenario: Scenario
  /** True when no budget row exists for this entry (computed, not a DB column). */
  non_budgete?: boolean
  /** Normalised label used as match key (lower-cased, diacritics stripped). */
  normalized_label?: string
}

/** The resolved "active budget" entry: either budget_initial or reforecast_6m,
 *  depending on the category overlay rules. */
export interface ActiveBudgetEntry extends FinanceEntry {
  scenario_source: Scenario
  non_budgete: boolean
}

// ─── Category helpers ─────────────────────────────────────────────────────────

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

/**
 * Returns true for categories that must always use budget_initial,
 * regardless of whether a reforecast_6m row exists.
 */
function isFixedBudgetCategory(category: string | null, subtype: string | null): boolean {
  const cat = normalizeText(category)
  const sub = normalizeText(subtype)

  // Fixed Costs
  if (sub === "fixed") return true

  // Taxes
  if (cat === "tax" || cat === "taxes") return true

  // Debt Service
  if (
    cat === "debt repayments" ||
    cat === "debt repayment" ||
    cat === "debt"
  ) return true

  return false
}

// ─── Match key ────────────────────────────────────────────────────────────────

/**
 * Builds a stable match key for an entry: category + normalized_label + month + year.
 * Used to join budget_initial rows with reforecast_6m rows.
 */
export function matchKey(entry: FinanceEntry): string {
  const cat   = normalizeText(entry.category)
  const label = normalizeText(entry.label)
  const m     = entry.month ?? 0
  const y     = entry.year ?? 0
  return `${cat}|${label}|${m}|${y}`
}

// ─── Main overlay function ────────────────────────────────────────────────────

/**
 * Resolves the "active budget" for a set of entries by overlaying reforecast_6m
 * on top of budget_initial according to category rules.
 *
 * @param budgetInitialRows  All budget_initial entries for the period
 * @param reforecast6mRows   All reforecast_6m entries for the same period (may be empty)
 * @returns                  Resolved ActiveBudgetEntry[] — one per budget_initial row,
 *                           with reforecast_6m amounts applied where the rules allow it.
 */
export function applyReforecastOverlay(
  budgetInitialRows: FinanceEntry[],
  reforecast6mRows:  FinanceEntry[],
): ActiveBudgetEntry[] {
  // Index reforecast rows by match key for O(1) lookup
  const reforecastIndex = new Map<string, FinanceEntry>()
  for (const row of reforecast6mRows) {
    reforecastIndex.set(matchKey(row), row)
  }

  return budgetInitialRows.map((base): ActiveBudgetEntry => {
    const key          = matchKey(base)
    const reforecast   = reforecastIndex.get(key)
    const useFixed     = isFixedBudgetCategory(base.category, base.entry_subtype)

    let resolved: FinanceEntry
    let scenario_source: Scenario

    if (useFixed || !reforecast) {
      // Always budget_initial for fixed-budget categories,
      // and fall back to budget_initial when no reforecast row exists.
      resolved        = base
      scenario_source = "budget_initial"
    } else {
      // Variable categories: prefer reforecast_6m
      resolved        = reforecast
      scenario_source = "reforecast_6m"
    }

    return {
      ...resolved,
      scenario_source,
      non_budgete: false,
    }
  })
}

/**
 * Computes the active budget for entries that appear in actual but NOT in any
 * budget scenario — these are flagged as non_budgete = true with amount 0.
 *
 * Used by VarianceTable to show unbudgeted actual lines.
 */
export function findUnbudgetedActuals(
  actualRows:         FinanceEntry[],
  budgetInitialRows:  FinanceEntry[],
  reforecast6mRows:   FinanceEntry[],
): ActiveBudgetEntry[] {
  const allBudgetKeys = new Set([
    ...budgetInitialRows.map(matchKey),
    ...reforecast6mRows.map(matchKey),
  ])

  return actualRows
    .filter(row => !allBudgetKeys.has(matchKey(row)))
    .map((row): ActiveBudgetEntry => ({
      ...row,
      amount:         0,
      scenario_source: "budget_initial",
      non_budgete:    true,
    }))
}
