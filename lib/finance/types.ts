// ─── Section keys ─────────────────────────────────────────────────────────────

export type SectionKey =
  | "gross_income"
  | "taxes"
  | "fixed_costs"
  | "variable_costs"
  | "one_off"
  | "debt_service"
  | "capex"

// ─── Raw row from finance_entries ─────────────────────────────────────────────

export interface FinanceRow {
  category: string
  label:    string
  amount:   number
  entry_type: "income" | "expense"
  month:    number
  year:     number
}

// ─── Computed P&L for one month ───────────────────────────────────────────────

export interface PLMonth {
  month:    number
  year:     number

  // Income
  grossIncome:  number   // Σ income cash
  taxes:        number   // Σ Tax category
  netIncome:    number   // grossIncome − taxes

  // Expenses
  fixedCosts:    number   // Σ fixed_costs
  variableCosts: number   // Σ variable_costs
  oneOff:        number   // Σ one_off
  debtService:   number   // Σ debt_service

  // Subtotals
  ebitda:       number   // netIncome − fixedCosts − variableCosts − oneOff − debtService
  capex:        number   // Σ capex
  netCashFlow:  number   // ebitda − capex

  // Ratios
  ebitdaRate:         number   // ebitda / grossIncome
  debtServiceRatio:   number   // debtService / netIncome
  savingsRate:        number   // (capex + netCashFlow) / netIncome

  // Diagnostics
  unmappedCategories: string[]
}

// ─── One-row summary per month for the annual chart ───────────────────────────

export interface MonthlySummary {
  month:       number
  year:        number
  monthLabel:  string
  grossIncome: number
  opex:        number   // fixedCosts + variableCosts + oneOff
  debtService: number
  netCashFlow: number
}
