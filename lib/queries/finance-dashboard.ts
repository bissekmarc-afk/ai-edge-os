import { createSupabaseServerClient } from "@/lib/supabase/server"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthKpis {
  income: number
  expenses: number
  netCashFlow: number
  savingsRate: number
  debtService: number
  debtServiceRatio: number
}

export interface CashflowMonth {
  month: number
  monthLabel: string
  income: number
  expenses: number
}

export interface CategoryBreakdownItem {
  category: string
  amount: number
  percentage: number
}

export interface WealthAsset {
  asset_name: string
  asset_class: string
  amount: number
  snapshot_date: string
  currency: string
}

export interface FinanceAlert {
  type: "danger" | "warning"
  message: string
}

// ─── French month labels ──────────────────────────────────────────────────────

const MONTHS_FR = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc",
]

export function monthName(month: number, year: number): string {
  return `${MONTHS_FR[month - 1]} ${year}`
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Returns the most recent month/year that has real data. */
export async function getLastDataMonth(): Promise<{ month: number; year: number } | null> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("finance_entries")
    .select("month, year")
    .eq("is_subtotal", false)
    .eq("is_non_cash", false)
    .not("month", "is", null)
    .not("year", "is", null)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return { month: data.month as number, year: data.year as number }
}

/** KPIs for a given month — excludes non-cash, includes debt service separately. */
export async function getMonthKpis(
  month: number,
  year: number
): Promise<MonthKpis> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return EMPTY_KPIS

  const { data, error } = await supabase
    .from("finance_entries")
    .select("amount, entry_type, is_non_cash, is_subtotal")
    .eq("month", month)
    .eq("year", year)

  if (error || !data) return EMPTY_KPIS

  let income = 0
  let expenses = 0
  let debtService = 0

  for (const row of data) {
    const amount = Number(row.amount)
    if (row.is_subtotal) {
      // DEBT SERVICE rows
      if (row.entry_type === "expense") debtService += amount
      continue
    }
    if (row.is_non_cash) continue

    if (row.entry_type === "income") income += amount
    else expenses += amount
  }

  const netCashFlow = income - expenses
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0
  const debtServiceRatio = income > 0 ? (debtService / income) * 100 : 0

  return { income, expenses, netCashFlow, savingsRate, debtService, debtServiceRatio }
}

/** 12-month cashflow series for the given year — excludes non-cash. */
export async function getCashflowByMonth(year: number): Promise<CashflowMonth[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return emptyYearSeries()

  const { data, error } = await supabase
    .from("finance_entries")
    .select("month, entry_type, amount")
    .eq("year", year)
    .eq("is_non_cash", false)
    .eq("is_subtotal", false)
    .not("month", "is", null)

  const agg: Record<number, { income: number; expenses: number }> = {}
  for (let m = 1; m <= 12; m++) agg[m] = { income: 0, expenses: 0 }

  for (const row of data ?? []) {
    const m = row.month as number
    if (m < 1 || m > 12) continue
    if (row.entry_type === "income") agg[m].income += Number(row.amount)
    else agg[m].expenses += Number(row.amount)
  }

  if (error) return emptyYearSeries()

  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    monthLabel: MONTHS_FR[i],
    income: agg[i + 1].income,
    expenses: agg[i + 1].expenses,
  }))
}

/** Expense breakdown by category for a given month. */
export async function getExpenseBreakdown(
  month: number,
  year: number
): Promise<CategoryBreakdownItem[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("finance_entries")
    .select("category, amount")
    .eq("month", month)
    .eq("year", year)
    .eq("entry_type", "expense")
    .eq("is_non_cash", false)
    .eq("is_subtotal", false)

  if (error || !data) return []

  const byCategory: Record<string, number> = {}
  for (const row of data) {
    const cat = row.category?.trim() || "Autre"
    byCategory[cat] = (byCategory[cat] ?? 0) + Number(row.amount)
  }

  const total = Object.values(byCategory).reduce((a, b) => a + b, 0)
  if (total === 0) return []

  return Object.entries(byCategory)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: (amount / total) * 100,
    }))
    .sort((a, b) => b.amount - a.amount)
}

/** Most recent wealth snapshot (all assets). */
export async function getLatestWealthSnapshots(): Promise<WealthAsset[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  // Find the latest snapshot date
  const { data: dateRow } = await supabase
    .from("wealth_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!dateRow) return []

  const { data, error } = await supabase
    .from("wealth_snapshots")
    .select("asset_name, asset_class, amount, snapshot_date, currency")
    .eq("snapshot_date", dateRow.snapshot_date)
    .order("amount", { ascending: false })

  if (error || !data) return []
  return data as WealthAsset[]
}

// ─── Alert computation (pure — no DB call) ────────────────────────────────────

export function computeAlerts(
  kpis: MonthKpis,
  breakdown: CategoryBreakdownItem[]
): FinanceAlert[] {
  const alerts: FinanceAlert[] = []

  if (kpis.netCashFlow < 0) {
    alerts.push({
      type: "danger",
      message: `Cash flow négatif ce mois : ${formatEur(kpis.netCashFlow)}`,
    })
  }

  if (kpis.income > 0 && kpis.debtServiceRatio > 10) {
    alerts.push({
      type: "warning",
      message: `Debt service à ${kpis.debtServiceRatio.toFixed(1)} % des revenus (seuil : 10 %)`,
    })
  }

  for (const item of breakdown) {
    if (item.percentage > 30) {
      alerts.push({
        type: "warning",
        message: `"${item.category}" représente ${item.percentage.toFixed(1)} % des dépenses`,
      })
    }
  }

  return alerts
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)} %`
}

// ─── Dev mock data ────────────────────────────────────────────────────────────
// Used only when NODE_ENV === 'development' and no real data is found.

export const MOCK_KPIS: MonthKpis = {
  income: 3800,
  expenses: 2158,
  netCashFlow: 1642,
  savingsRate: 43.2,
  debtService: 450,
  debtServiceRatio: 11.8,
}

export const MOCK_CASHFLOW: CashflowMonth[] = [
  { month: 1,  monthLabel: "Jan",  income: 3800, expenses: 2050 },
  { month: 2,  monthLabel: "Fév",  income: 3800, expenses: 2200 },
  { month: 3,  monthLabel: "Mar",  income: 4100, expenses: 2400 },
  { month: 4,  monthLabel: "Avr",  income: 3800, expenses: 2100 },
  { month: 5,  monthLabel: "Mai",  income: 3800, expenses: 2158 },
  { month: 6,  monthLabel: "Juin", income: 3800, expenses: 2600 },
  { month: 7,  monthLabel: "Juil", income: 3800, expenses: 2800 },
  { month: 8,  monthLabel: "Aoû",  income: 3800, expenses: 2300 },
  { month: 9,  monthLabel: "Sep",  income: 3800, expenses: 2150 },
  { month: 10, monthLabel: "Oct",  income: 3800, expenses: 2200 },
  { month: 11, monthLabel: "Nov",  income: 3800, expenses: 2450 },
  { month: 12, monthLabel: "Déc",  income: 3800, expenses: 3100 },
]

export const MOCK_BREAKDOWN: CategoryBreakdownItem[] = [
  { category: "Logement",    amount: 1100, percentage: 51.0 },
  { category: "Alimentation", amount: 380, percentage: 17.6 },
  { category: "Transport",   amount: 220,  percentage: 10.2 },
  { category: "Loisirs",     amount: 180,  percentage: 8.3  },
  { category: "Santé",       amount: 158,  percentage: 7.3  },
  { category: "Autre",       amount: 120,  percentage: 5.6  },
]

export const MOCK_WEALTH: WealthAsset[] = [
  { asset_name: "Immo",           asset_class: "real_estate",   amount: 280000, snapshot_date: "2026-05-31", currency: "EUR" },
  { asset_name: "Actions Valeur", asset_class: "equities",      amount: 45000,  snapshot_date: "2026-05-31", currency: "EUR" },
  { asset_name: "Épargne Cumulée",asset_class: "savings",       amount: 28000,  snapshot_date: "2026-05-31", currency: "EUR" },
  { asset_name: "Art/Collectibles",asset_class: "alternatives", amount: 12000,  snapshot_date: "2026-05-31", currency: "EUR" },
]

// ─── Private helpers ──────────────────────────────────────────────────────────

const EMPTY_KPIS: MonthKpis = {
  income: 0, expenses: 0, netCashFlow: 0,
  savingsRate: 0, debtService: 0, debtServiceRatio: 0,
}

function emptyYearSeries(): CashflowMonth[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    monthLabel: MONTHS_FR[i],
    income: 0,
    expenses: 0,
  }))
}
