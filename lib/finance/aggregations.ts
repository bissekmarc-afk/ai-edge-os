import type { NonCashRow, BalanceSheet, MonthlySummary } from "./types"

// ─── Types ────────────────────────────────────────────────────────────────────

export type EntryType    = "income" | "expense"
export type FluxNature   = "Cash In" | "Cash Out" | "Non-cash"
export type EntrySubtype = "Fixed" | "Variable" | "One-off" | "Seasonal"

export type FinanceEntry = {
  id?:           string
  label:         string | null
  category:      string | null
  amount:        number | null
  entry_type:    EntryType | null
  month?:        number | null
  year?:         number | null
  flux_nature:   FluxNature | string | null
  entry_subtype: EntrySubtype | string | null
  is_non_cash:   boolean | null
  is_subtotal:   boolean | null
}

export type PLBucket =
  | "recurringIncome"
  | "nonRecurringIncome"
  | "taxes"
  | "fixedCosts"
  | "variableCosts"
  | "oneOff"
  | "debtService"
  | "capex"
  | "ignored"
  | "unmapped"

export type ClassifiedEntry = {
  entry:            FinanceEntry
  bucket:           PLBucket
  normalizedAmount: number
  reason:           string
}

export type PLResult = {
  recurringIncome:    number
  nonRecurringIncome: number
  grossIncome:        number

  taxes:     number
  netIncome: number

  fixedCosts:    number
  variableCosts: number
  oneOff:        number
  debtService:   number

  ebitda:     number
  ebitdaRate: number | null

  capex:       number
  netCashFlow: number

  recurringIncomeRate:    number | null
  nonRecurringIncomeRate: number | null
  debtServiceRatio:       number | null
  savingsRate:            number | null

  classifiedEntries: ClassifiedEntry[]
  unmappedEntries:   ClassifiedEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function normalizeAmount(entry: FinanceEntry): number {
  const amount = Number(entry.amount ?? 0)
  if (!Number.isFinite(amount)) return 0
  return Math.abs(amount)
}

function isCashEntry(entry: FinanceEntry): boolean {
  return (
    entry.is_subtotal !== true &&
    entry.is_non_cash !== true &&
    normalizeText(entry.flux_nature) !== "non-cash" &&
    entry.amount !== null &&
    Number.isFinite(Number(entry.amount))
  )
}

function isOneOf(value: string, values: string[]): boolean {
  return values.includes(value)
}

// ─── Entry classifier ─────────────────────────────────────────────────────────

function classifyEntry(entry: FinanceEntry): ClassifiedEntry {
  const category = normalizeText(entry.category)
  const subtype  = normalizeText(entry.entry_subtype)
  const label    = normalizeText(entry.label)
  const flux     = normalizeText(entry.flux_nature)
  const amount   = normalizeAmount(entry)

  if (!isCashEntry(entry)) {
    return {
      entry,
      bucket: "ignored",
      normalizedAmount: 0,
      reason: "Subtotal, non-cash, null amount, or invalid amount",
    }
  }

  // 1. Revenus ── all income or Cash In entries ──────────────────────────────
  if (entry.entry_type === "income" || flux === "cash in" || category === "income") {
    const isRecurringIncome =
      category === "income" &&
      isOneOf(subtype, ["fixed", "variable"]) &&
      !isOneOf(subtype, ["one-off", "seasonal"])

    const looksLikeRecurringIncome =
      label.includes("salaire") ||
      label.includes("salary")  ||
      label.includes("immo")    ||
      label.includes("loyer")   ||
      label.includes("rent")

    if (isRecurringIncome || looksLikeRecurringIncome) {
      return {
        entry,
        bucket: "recurringIncome",
        normalizedAmount: amount,
        reason: "Income Fixed/Variable or recurring income label",
      }
    }

    return {
      entry,
      bucket: "nonRecurringIncome",
      normalizedAmount: amount,
      reason: "Income One-off/Seasonal or exceptional Cash In",
    }
  }

  // 1b. Housing — absolute priority (beats any label-based check below) ────────
  if (category === "housing") {
    return {
      entry,
      bucket: "fixedCosts",
      normalizedAmount: amount,
      reason: "Housing category → fixed costs (priority)",
    }
  }

  // 2. Taxes — category only; label fallback is at the end of this function ────
  if (category === "tax" || category === "taxes") {
    return {
      entry,
      bucket: "taxes",
      normalizedAmount: amount,
      reason: "Tax category",
    }
  }

  // 3. Debt Service ──────────────────────────────────────────────────────────
  if (
    category === "debt repayments" ||
    category === "debt repayment"  ||
    category === "debt"            ||
    label.includes("credit")       ||
    label.includes("loan")         ||
    label.includes("remboursement")
  ) {
    return {
      entry,
      bucket: "debtService",
      normalizedAmount: amount,
      reason: "Debt repayment category or debt-like label",
    }
  }

  // 4. CAPEX ─────────────────────────────────────────────────────────────────
  if (
    isOneOf(category, ["savings", "saving", "tontine", "investment", "investments", "savings or investments"]) ||
    label.includes("epargne")        ||
    label.includes("investissement") ||
    label.includes("tontine")
  ) {
    return {
      entry,
      bucket: "capex",
      normalizedAmount: amount,
      reason: "Savings, tontine, or investment category",
    }
  }

  // 5. One-off ───────────────────────────────────────────────────────────────
  if (
    subtype === "one-off"  ||
    subtype === "seasonal" ||
    isOneOf(category, ["big & one-offs", "big one-offs", "one-off", "one off", "gifts", "gift"]) ||
    label.includes("cadeau")   ||
    label.includes("vacances") ||
    label.includes("event")
  ) {
    return {
      entry,
      bucket: "oneOff",
      normalizedAmount: amount,
      reason: "One-off/Seasonal subtype or one-off category",
    }
  }

  // 6. Coûts fixes ───────────────────────────────────────────────────────────
  if (
    subtype === "fixed" ||
    (category === "transport" && subtype === "fixed")
  ) {
    return {
      entry,
      bucket: "fixedCosts",
      normalizedAmount: amount,
      reason: "Housing or Fixed expense",
    }
  }

  // 7. Coûts variables
  // Note: "personal" is intentionally excluded here — handled specifically below
  if (
    subtype === "variable" ||
    isOneOf(category, ["food", "health", "leisure"]) ||
    (category === "transport" && subtype === "variable")
  ) {
    return {
      entry,
      bucket: "variableCosts",
      normalizedAmount: amount,
      reason: "Variable expense category or subtype",
    }
  }

  // ── Mappings manquants ────────────────────────────────────────────────────

  if (category === "odd") {
    return { entry, bucket: "fixedCosts", normalizedAmount: amount, reason: "Odd → fixed costs" }
  }

  if (category === "personal") {
    if (subtype === "one-off") {
      return { entry, bucket: "oneOff", normalizedAmount: amount, reason: "Personal One-off → one-off" }
    }
    return { entry, bucket: "variableCosts", normalizedAmount: amount, reason: "Personal → variable costs" }
  }

  // Transport default (no subtype match from blocks 6/7)
  if (category === "transport") {
    return { entry, bucket: "fixedCosts", normalizedAmount: amount, reason: "Transport (default) → fixed costs" }
  }

  if (category === "investment") {
    return { entry, bucket: "capex", normalizedAmount: amount, reason: "Investment → capex" }
  }

  if (category === "art" || category.includes("art")) {
    return { entry, bucket: "capex", normalizedAmount: amount, reason: "Art → capex" }
  }

  if (label.includes("legal") && flux === "cash out") {
    return { entry, bucket: "oneOff", normalizedAmount: amount, reason: "Legal Cash Out → one-off" }
  }

  if (label.includes("legal") && flux === "cash in") {
    return { entry, bucket: "nonRecurringIncome", normalizedAmount: amount, reason: "Legal Cash In → non-recurring income" }
  }

  // Label-based fiscal fallback — only when category is null / empty / unknown
  if (!category && (label.includes("impot") || label.includes("cotisation"))) {
    return { entry, bucket: "taxes", normalizedAmount: amount, reason: "Fiscal label fallback (no category)" }
  }

  return {
    entry,
    bucket: "unmapped",
    normalizedAmount: amount,
    reason: "No matching DAF bucket",
  }
}

// ─── P&L computation ──────────────────────────────────────────────────────────

function safeRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null
  if (denominator === 0) return null
  return numerator / denominator
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function computePL(entries: FinanceEntry[]): PLResult {
  const classifiedEntries = entries.map(classifyEntry)

  let recurringIncome    = 0
  let nonRecurringIncome = 0
  let taxes              = 0
  let fixedCosts         = 0
  let variableCosts      = 0
  let oneOff             = 0
  let debtService        = 0
  let capex              = 0

  for (const item of classifiedEntries) {
    const amount = item.normalizedAmount
    switch (item.bucket) {
      case "recurringIncome":    recurringIncome    += amount; break
      case "nonRecurringIncome": nonRecurringIncome += amount; break
      case "taxes":              taxes              += amount; break
      case "fixedCosts":         fixedCosts         += amount; break
      case "variableCosts":      variableCosts      += amount; break
      case "oneOff":             oneOff             += amount; break
      case "debtService":        debtService        += amount; break
      case "capex":              capex              += amount; break
      case "ignored":
      case "unmapped":           break
    }
  }

  recurringIncome    = roundCurrency(recurringIncome)
  nonRecurringIncome = roundCurrency(nonRecurringIncome)
  const grossIncome  = roundCurrency(recurringIncome + nonRecurringIncome)
  taxes              = roundCurrency(taxes)
  const netIncome    = roundCurrency(grossIncome - taxes)
  fixedCosts         = roundCurrency(fixedCosts)
  variableCosts      = roundCurrency(variableCosts)
  oneOff             = roundCurrency(oneOff)
  debtService        = roundCurrency(debtService)
  const ebitda       = roundCurrency(grossIncome - taxes - fixedCosts - variableCosts - oneOff - debtService)
  capex              = roundCurrency(capex)
  const netCashFlow  = roundCurrency(ebitda - capex)

  const unmappedEntries = classifiedEntries.filter(item => item.bucket === "unmapped")

  return {
    recurringIncome,
    nonRecurringIncome,
    grossIncome,
    taxes,
    netIncome,
    fixedCosts,
    variableCosts,
    oneOff,
    debtService,
    ebitda,
    ebitdaRate:             safeRatio(ebitda, grossIncome),
    capex,
    netCashFlow,
    recurringIncomeRate:    safeRatio(recurringIncome,    grossIncome),
    nonRecurringIncomeRate: safeRatio(nonRecurringIncome, grossIncome),
    debtServiceRatio:       safeRatio(debtService, netIncome),
    savingsRate:            safeRatio(capex + netCashFlow, netIncome),
    classifiedEntries,
    unmappedEntries,
  }
}

// ─── Balance sheet computation ────────────────────────────────────────────────

/** Case-insensitive: exact label match first, then startsWith, then contains */
function findOne(rows: NonCashRow[], search: string): number {
  const s        = search.toLowerCase().trim()
  const exact    = rows.find(r => r.label.toLowerCase().trim() === s)
  const starts   = rows.find(r => r.label.toLowerCase().trim().startsWith(s))
  const contains = rows.find(r => r.label.toLowerCase().includes(s))
  const match    = exact ?? starts ?? contains
  return match ? Math.abs(Number(match.amount)) : 0
}

/** All rows whose label contains `search` (case-insensitive) */
function findAll(rows: NonCashRow[], search: string): NonCashRow[] {
  const s = search.toLowerCase().trim()
  return rows.filter(r => r.label.toLowerCase().includes(s))
}

function netWorthFrom(rows: NonCashRow[]): number {
  const immo     = findOne(rows, "immo")
  const equities = findOne(rows, "actions valeur")
  const art      = findOne(rows, "art valeur")
  const savings  = findOne(rows, "épargne cumulée")
  const credits  = findAll(rows, "principal restant")
    .reduce((s, r) => s + Math.abs(Number(r.amount)), 0)
  return immo + equities + art + savings - credits
}

export function computeBalanceSheet(
  rows:      NonCashRow[],
  month:     number,
  year:      number,
  prevRows?: NonCashRow[],
): BalanceSheet {
  const immo     = findOne(rows, "immo")
  const equities = findOne(rows, "actions valeur")
  const art      = findOne(rows, "art valeur")
  const savings  = findOne(rows, "épargne cumulée")
  const totalAssets = immo + equities + art + savings

  const creditRows       = findAll(rows, "principal restant")
  const credits          = creditRows.map((r, i) => ({
    label:  r.label.trim() || `Crédit ${i + 1}`,
    amount: Math.abs(Number(r.amount)),
  }))
  const totalLiabilities = credits.reduce((s, c) => s + c.amount, 0)

  const netWorth     = totalAssets - totalLiabilities
  const prevNetWorth = prevRows ? netWorthFrom(prevRows) : undefined

  return {
    month, year,
    assets:      { immo, equities, art, savings, total: totalAssets },
    liabilities: { credits, total: totalLiabilities },
    netWorth,
    prevNetWorth,
    netWorthDelta: prevNetWorth !== undefined ? netWorth - prevNetWorth : undefined,
  }
}

// ─── Annual chart summaries ───────────────────────────────────────────────────

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"]

export function computeYearSummaries(rows: FinanceEntry[], year: number): MonthlySummary[] {
  const byMonth = new Map<number, FinanceEntry[]>()
  for (const row of rows) {
    const m    = row.month ?? 0
    const list = byMonth.get(m) ?? []
    list.push(row)
    byMonth.set(m, list)
  }

  return Array.from({ length: 12 }, (_, i) => {
    const month     = i + 1
    const monthRows = byMonth.get(month) ?? []
    const pl        = computePL(monthRows)

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

export const MONTHS_FR_FULL = MONTHS_FR

export function monthName(month: number, year: number): string {
  return `${MONTHS_FR[month - 1]} ${year}`
}
