import type { FinanceRow, PLMonth, MonthlySummary, SectionKey } from "./types"

// ─── Category → section mapping ───────────────────────────────────────────────
//
// All comparisons are done against the lowercased, trimmed category string.
// Income entry_type always maps to gross_income regardless of category.

const CATEGORY_SECTION: ReadonlyMap<string, SectionKey> = new Map([
  // taxes
  ["tax",                           "taxes"],
  // fixed_costs
  ["housing",                       "fixed_costs"],
  ["motoring & transportation",     "fixed_costs"],
  // debt_service
  ["debt repayments",               "debt_service"],
  // capex
  ["tontine",                       "capex"],
  ["investment",                    "capex"],
  ["art",                           "capex"],
  ["art/collectibles",              "capex"],
  ["savings or investments",        "capex"],
  // one_off
  ["big & one-offs",                "one_off"],
  ["gifts",                         "one_off"],
  ["legal",                         "one_off"],
  // variable_costs
  ["entertainment",                 "variable_costs"],
  ["entertainment + dating",        "variable_costs"],
  ["clothes, health & beauty",      "variable_costs"],   // actual DB value
  ["clothes health & beauty",       "variable_costs"],   // spec name (no comma)
  ["food",                          "variable_costs"],
  ["health",                        "variable_costs"],
  ["leisure",                       "variable_costs"],
  ["personal",                      "variable_costs"],
  ["odds & sods",                   "variable_costs"],
  ["photo",                         "variable_costs"],
  ["photoshop",                     "variable_costs"],
])

function resolveSection(row: FinanceRow): SectionKey | null {
  if (row.entry_type === "income") return "gross_income"
  return CATEGORY_SECTION.get(row.category.toLowerCase().trim()) ?? null
}

// ─── Core P&L computation ─────────────────────────────────────────────────────

export function computePL(
  rows:  FinanceRow[],
  month: number,
  year:  number,
): PLMonth {
  const sums: Record<SectionKey, number> = {
    gross_income:   0,
    taxes:          0,
    fixed_costs:    0,
    variable_costs: 0,
    one_off:        0,
    debt_service:   0,
    capex:          0,
  }

  const unmapped = new Set<string>()

  for (const row of rows) {
    const section = resolveSection(row)
    if (section === null) {
      unmapped.add(row.category)
      continue
    }
    sums[section] += Math.abs(row.amount)
  }

  const grossIncome   = sums.gross_income
  const taxes         = sums.taxes
  const netIncome     = grossIncome - taxes
  const fixedCosts    = sums.fixed_costs
  const variableCosts = sums.variable_costs
  const oneOff        = sums.one_off
  const debtService   = sums.debt_service
  const ebitda        = netIncome - fixedCosts - variableCosts - oneOff - debtService
  const capex         = sums.capex
  const netCashFlow   = ebitda - capex

  const ebitdaRate       = grossIncome > 0 ? ebitda / grossIncome        : 0
  const debtServiceRatio = netIncome   > 0 ? debtService / netIncome     : 0
  const savingsRate      = netIncome   > 0 ? (capex + netCashFlow) / netIncome : 0

  return {
    month, year,
    grossIncome, taxes, netIncome,
    fixedCosts, variableCosts, oneOff, debtService,
    ebitda, capex, netCashFlow,
    ebitdaRate, debtServiceRatio, savingsRate,
    unmappedCategories: [...unmapped].sort(),
  }
}

// ─── Annual chart summaries ───────────────────────────────────────────────────

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"]

export function computeYearSummaries(
  rows: FinanceRow[],
  year: number,
): MonthlySummary[] {
  // Group rows by month
  const byMonth = new Map<number, FinanceRow[]>()
  for (const row of rows) {
    const list = byMonth.get(row.month) ?? []
    list.push(row)
    byMonth.set(row.month, list)
  }

  // Build one summary per calendar month
  return Array.from({ length: 12 }, (_, i) => {
    const month     = i + 1
    const monthRows = byMonth.get(month) ?? []
    const pl        = computePL(monthRows, month, year)

    return {
      month,
      year,
      monthLabel:  MONTHS_FR[i],
      grossIncome: pl.grossIncome,
      opex:        pl.fixedCosts + pl.variableCosts + pl.oneOff,
      debtService: pl.debtService,
      netCashFlow: pl.netCashFlow,
    } satisfies MonthlySummary
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const MONTHS_FR_FULL = MONTHS_FR

export function monthName(month: number, year: number): string {
  return `${MONTHS_FR[month - 1]} ${year}`
}
