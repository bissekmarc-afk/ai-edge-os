// ─── Re-exports from aggregations (convenience for consumers) ────────────────
export type {
  EntryType,
  FluxNature,
  EntrySubtype,
  FinanceEntry,
  PLBucket,
  ClassifiedEntry,
  PLResult,
} from "./aggregations"

// ─── Raw row from finance_entries (non-cash / balance sheet entries) ──────────

export interface NonCashRow {
  label:  string
  amount: number
  month:  number
  year:   number
}

// ─── Balance sheet ────────────────────────────────────────────────────────────

export interface BalanceSheet {
  month: number
  year:  number

  assets: {
    immo:     number
    equities: number
    art:      number
    savings:  number
    total:    number
  }

  liabilities: {
    credits: Array<{ label: string; amount: number }>
    total:   number
  }

  netWorth:       number
  prevNetWorth?:  number
  netWorthDelta?: number
}

// ─── One-row summary per month for the annual chart ───────────────────────────

export interface MonthlySummary {
  month:       number
  year:        number
  monthLabel:  string
  grossIncome: number
  opex:        number
  debtService: number
  netCashFlow: number
}
