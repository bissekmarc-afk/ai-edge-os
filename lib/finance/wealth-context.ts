// ── lib/finance/wealth-context.ts ────────────────────────────────────────────
//
// Construit le contexte patrimonial 6-mois pour le brief IA Claude.
// Réutilise computePL() et computeBalanceSheet() existants.
// Aucune nouvelle table Supabase.
//
// Spec : Promise.allSettled, clés YYYY-MM, mois courant ≠ high alert,
// seuils alertes renforcés, logging non-sensible.

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { computePL, computeBalanceSheet } from "@/lib/finance/aggregations"
import type { FinanceEntry, PLResult } from "@/lib/finance/types"
import type { NonCashRow, BalanceSheet } from "@/lib/finance/types"

// ─── Types publics ────────────────────────────────────────────────────────────

type Trend      = "improving" | "stable" | "deteriorating"
type Trajectory = "improving" | "stable" | "worsening" | "unknown"
type Confidence = "high" | "medium" | "low"
type Severity   = "low" | "medium" | "high" | "critical"

interface MonthlyNCF {
  month:       string   // "YYYY-MM"
  income:      number
  expenses:    number
  debtService: number
  ncf:         number
  momPct:      number | null
}

interface CategoryTrend {
  cat:      string
  avg6m:    number
  sharePct: number
  trend:    "up" | "flat" | "down"
  risk:     "low" | "medium" | "high"
}

interface Alert {
  type:           string
  severity:       Severity
  evidence:       string
  recommendation: string
}

export interface WealthContext {
  period: {
    from:                string | null
    to:                  string | null
    months:              number
    completeness:        Confidence
    currentMonthPartial: boolean
  } | null
  cashFlow: {
    monthly:        MonthlyNCF[]
    trend:          Trend
    avgNCF:         number
    negativeMonths: number
  } | null
  spending: {
    top5:          CategoryTrend[]
    accelerating:  string[]
  } | null
  debt: {
    avgMonthlyService: number
    dsRatio:           number
    trajectory:        Trajectory
  } | null
  netWorth: {
    current:    number | null
    delta6m:    number | null
    trend:      "up" | "flat" | "down" | "unknown"
    confidence: Confidence
  } | null
  alerts: Alert[]
  dataQuality: {
    confidence: { ncf: Confidence; spending: Confidence; debt: Confidence; netWorth: Confidence }
    missing:     string[]
    assumptions: string[]
  }
}

// ─── Fallback global ──────────────────────────────────────────────────────────

export const WEALTH_CONTEXT_FALLBACK: WealthContext = {
  period:    null,
  cashFlow:  null,
  spending:  null,
  debt:      null,
  netWorth:  null,
  alerts:    [],
  dataQuality: {
    confidence: { ncf: "low", spending: "low", debt: "low", netWorth: "low" },
    missing:    ["wealth_context_unavailable"],
    assumptions: [],
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clé mois "YYYY-MM" avec padding. */
function toYYYYMM(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

/** Wrapper fail-open : capture les exceptions par section. */
async function safeSection<T>(
  name: string,
  fn: () => T | Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const errType = err instanceof Error ? err.constructor.name : "UnknownError"
    console.warn(`[wealth-context] ${name} failed (${errType})`)
    return fallback
  }
}

/** Tendance sur une série de valeurs (compare deux moitiés). */
function computeTrend(values: number[]): Trend {
  if (values.length < 2) return "stable"
  const mid    = Math.floor(values.length / 2)
  const first  = values.slice(0, mid)
  const second = values.slice(mid)
  const avgF   = first.reduce((s, v) => s + v, 0) / first.length
  const avgS   = second.reduce((s, v) => s + v, 0) / second.length
  const delta  = avgS - avgF
  if (delta > 100)  return "improving"
  if (delta < -100) return "deteriorating"
  return "stable"
}

// ─── Libellés PLBucket (sans données sensibles) ───────────────────────────────

const BUCKET_LABEL: Partial<Record<string, string>> = {
  fixedCosts:    "Charges fixes",
  variableCosts: "Dépenses variables",
  oneOff:        "Achats exceptionnels",
  taxes:         "Fiscalité",
  capex:         "Épargne/Investissement",
  debtService:   "Remboursements dette",
}

const EXPENSE_BUCKETS = ["fixedCosts", "variableCosts", "oneOff", "taxes", "capex"] as const

// ─── Fetch Supabase ───────────────────────────────────────────────────────────

async function fetchRollingCash(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  cutoffDateStr: string,
): Promise<Map<string, FinanceEntry[]>> {
  const { data, error } = await supabase
    .from("finance_entries")
    .select("category, label, amount, entry_type, entry_subtype, flux_nature, month, year, is_non_cash, is_subtotal, scenario")
    .eq("scenario",    "actual")
    .eq("is_subtotal", false)
    .eq("is_non_cash", false)
    .or("sync_status.neq.deleted,sync_status.is.null")
    .gte("date", cutoffDateStr)
    .not("month", "is", null)
    .not("year",  "is", null)

  if (error || !data) return new Map()

  const byMonth = new Map<string, FinanceEntry[]>()
  for (const row of data as FinanceEntry[]) {
    if (!row.month || !row.year) continue
    const key  = toYYYYMM(row.year, row.month)
    const list = byMonth.get(key) ?? []
    list.push(row)
    byMonth.set(key, list)
  }
  return byMonth
}

async function fetchNonCash(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  cutoffDateStr: string,
): Promise<Map<string, NonCashRow[]>> {
  const { data, error } = await supabase
    .from("finance_entries")
    .select("label, amount, month, year")
    .eq("scenario",    "actual")
    .eq("is_non_cash", true)
    .eq("is_subtotal", false)
    .or("sync_status.neq.deleted,sync_status.is.null")
    .gte("date", cutoffDateStr)
    .not("month", "is", null)
    .not("year",  "is", null)

  if (error || !data) return new Map()

  const byMonth = new Map<string, NonCashRow[]>()
  for (const row of data as NonCashRow[]) {
    if (!row.month || !row.year) continue
    const key  = toYYYYMM(row.year, row.month)
    const list = byMonth.get(key) ?? []
    list.push({ label: row.label, amount: Number(row.amount), month: row.month, year: row.year })
    byMonth.set(key, list)
  }
  return byMonth
}

// ─── Builders par section ─────────────────────────────────────────────────────

function buildCashFlow(
  plByMonth: Map<string, PLResult>,
  sortedKeys: string[],
): WealthContext["cashFlow"] {
  if (sortedKeys.length === 0) return null

  const monthly: MonthlyNCF[] = sortedKeys.map((key, i) => {
    const pl    = plByMonth.get(key)!
    const prevPL = i > 0 ? plByMonth.get(sortedKeys[i - 1]) : undefined

    const momPct =
      prevPL && prevPL.netCashFlow !== 0
        ? Math.round(((pl.netCashFlow - prevPL.netCashFlow) / Math.abs(prevPL.netCashFlow)) * 100)
        : null

    return {
      month:       key,
      income:      Math.round(pl.grossIncome),
      expenses:    Math.round(pl.fixedCosts + pl.variableCosts + pl.oneOff),
      debtService: Math.round(pl.debtService),
      ncf:         Math.round(pl.netCashFlow),
      momPct,
    }
  })

  const ncfValues      = monthly.map(m => m.ncf)
  const negativeMonths = ncfValues.filter(v => v < 0).length
  const avgNCF         = ncfValues.length
    ? Math.round(ncfValues.reduce((s, v) => s + v, 0) / ncfValues.length)
    : 0

  return { monthly, trend: computeTrend(ncfValues), avgNCF, negativeMonths }
}

function buildSpending(
  plByMonth: Map<string, PLResult>,
  sortedKeys: string[],
  currentMonthKey: string,
): WealthContext["spending"] {
  if (sortedKeys.length === 0) return null

  // Agréger par bucket sur tous les mois disponibles
  const bucketByMonth = new Map<string, Map<string, number>>()
  for (const key of sortedKeys) {
    const pl      = plByMonth.get(key)!
    const buckets = new Map<string, number>([
      ["fixedCosts",    pl.fixedCosts],
      ["variableCosts", pl.variableCosts],
      ["oneOff",        pl.oneOff],
      ["taxes",         pl.taxes],
      ["capex",         pl.capex],
    ])
    bucketByMonth.set(key, buckets)
  }

  const months = sortedKeys.length

  // Top5 par moyenne 6 mois
  const top5: CategoryTrend[] = EXPENSE_BUCKETS.map(bucket => {
    const values = sortedKeys.map(k => bucketByMonth.get(k)?.get(bucket) ?? 0)
    const total  = values.reduce((s, v) => s + v, 0)
    const avg6m  = Math.round(total / months)

    // Tendance par moitiés
    const mid   = Math.floor(values.length / 2)
    const avgF  = values.slice(0, mid).reduce((s, v) => s + v, 0) / (mid || 1)
    const avgS  = values.slice(mid).reduce((s, v) => s + v, 0) / ((values.length - mid) || 1)
    const trendDelta = avgS - avgF
    const trend: CategoryTrend["trend"] = trendDelta > 50 ? "up" : trendDelta < -50 ? "down" : "flat"
    const risk:  CategoryTrend["risk"]  = trend === "up" && avg6m > 500 ? "high" : trend === "up" ? "medium" : "low"

    return { cat: BUCKET_LABEL[bucket] ?? bucket, avg6m, sharePct: 0, trend, risk }
  })

  // Calculer sharePct sur le total global
  const globalTotal = top5.reduce((s, c) => s + c.avg6m, 0)
  for (const c of top5) {
    c.sharePct = globalTotal > 0 ? Math.round((c.avg6m / globalTotal) * 100) : 0
  }

  // Tri par avg6m DESC, prendre top 5
  const sorted = [...top5].sort((a, b) => b.avg6m - a.avg6m).slice(0, 5)

  // Catégories en accélération : mois complétés uniquement, >25% MoM ET >100€
  const completedKeys = sortedKeys.filter(k => k < currentMonthKey)
  const accelerating: string[] = []

  if (completedKeys.length >= 2) {
    const lastKey = completedKeys[completedKeys.length - 1]
    const prevKey = completedKeys[completedKeys.length - 2]

    for (const bucket of EXPENSE_BUCKETS) {
      const lastAmt = bucketByMonth.get(lastKey)?.get(bucket) ?? 0
      const prevAmt = bucketByMonth.get(prevKey)?.get(bucket) ?? 0

      if (prevAmt > 0) {
        const momPct = (lastAmt - prevAmt) / prevAmt
        const momAbs = lastAmt - prevAmt
        if (momPct > 0.25 && momAbs > 100) {
          accelerating.push(BUCKET_LABEL[bucket] ?? bucket)
        }
      }
    }
  }

  return { top5: sorted, accelerating }
}

function buildDebt(
  plByMonth: Map<string, PLResult>,
  sortedKeys: string[],
): WealthContext["debt"] {
  if (sortedKeys.length === 0) return null

  const services = sortedKeys.map(k => plByMonth.get(k)?.debtService ?? 0)
  const ratios   = sortedKeys
    .map(k => plByMonth.get(k)?.debtServiceRatio ?? null)
    .filter((r): r is number => r !== null)

  const avgMonthlyService = services.length
    ? Math.round(services.reduce((s, v) => s + v, 0) / services.length)
    : 0
  const avgDSR = ratios.length
    ? Math.round((ratios.reduce((s, v) => s + v, 0) / ratios.length) * 1000) / 1000
    : 0

  const trend = computeTrend(services)
  const trajectory: Trajectory =
    trend === "improving"    ? "improving" :
    trend === "deteriorating"? "worsening" : "stable"

  return { avgMonthlyService, dsRatio: avgDSR, trajectory }
}

function buildNetWorth(
  bsByMonth: Map<string, BalanceSheet>,
  sortedKeys: string[],
): WealthContext["netWorth"] {
  const sheets = sortedKeys
    .map(k => bsByMonth.get(k))
    .filter((s): s is BalanceSheet => s !== undefined)

  if (sheets.length === 0) {
    return { current: null, delta6m: null, trend: "unknown", confidence: "low" }
  }

  const current = sheets[sheets.length - 1].netWorth
  const delta6m = sheets.length >= 2 ? current - sheets[0].netWorth : null
  const trend: "up" | "flat" | "down" | "unknown" =
    delta6m === null ? "unknown" :
    delta6m > 0      ? "up"      :
    delta6m < 0      ? "down"    : "flat"

  const confidence: Confidence =
    sheets.length >= 5 ? "high" : sheets.length >= 2 ? "medium" : "low"

  return {
    current:    Math.round(current),
    delta6m:    delta6m !== null ? Math.round(delta6m) : null,
    trend,
    confidence,
  }
}

function buildAlerts(
  cashFlow: WealthContext["cashFlow"],
  debt:     WealthContext["debt"],
  spending: WealthContext["spending"],
  currentMonthKey: string,
): Alert[] {
  const alerts: Alert[] = []

  if (cashFlow) {
    // NCF négatif sur mois complétés (pas le mois courant partiel)
    const completedNeg = cashFlow.monthly.filter(m => m.month < currentMonthKey && m.ncf < 0).length
    if (completedNeg >= 3) {
      alerts.push({
        type:           "cashflow_negative",
        severity:       "high",
        evidence:       `NCF négatif ${completedNeg} mois complétés`,
        recommendation: "Stabiliser le cash-flow en priorité",
      })
    } else if (completedNeg >= 2) {
      alerts.push({
        type:           "cashflow_negative",
        severity:       "medium",
        evidence:       `NCF négatif ${completedNeg} mois complétés`,
        recommendation: "Surveiller l'évolution du cash-flow",
      })
    }

    // Tendance dégradée (mois complets requis pour fiabilité)
    const completedMonths = cashFlow.monthly.filter(m => m.month < currentMonthKey)
    if (cashFlow.trend === "deteriorating" && completedMonths.length >= 3) {
      alerts.push({
        type:           "cashflow_deteriorating",
        severity:       "medium",
        evidence:       "Tendance NCF dégradée sur mois complétés",
        recommendation: "Analyser la dérive des dépenses",
      })
    }
  }

  if (debt && debt.dsRatio > 0) {
    if (debt.dsRatio > 0.35) {
      alerts.push({
        type:           "debt_service_high",
        severity:       "high",
        evidence:       `DSR ${(debt.dsRatio * 100).toFixed(0)}% > 35%`,
        recommendation: "Envisager une restructuration de la dette",
      })
    } else if (debt.dsRatio > 0.25) {
      alerts.push({
        type:           "debt_service_elevated",
        severity:       "medium",
        evidence:       `DSR ${(debt.dsRatio * 100).toFixed(0)}% > 25%`,
        recommendation: "Surveiller le ratio dette/revenus",
      })
    }
  }

  if (spending?.accelerating.length) {
    // N'utilise que des catégories (pas d'amounts), donc safe à logger
    alerts.push({
      type:           "spending_acceleration",
      severity:       "medium",
      evidence:       `Hausse MoM >25% +100€ : ${spending.accelerating.join(", ")}`,
      recommendation: "Revoir les postes en dérive",
    })
  }

  return alerts
}

function buildDataQuality(
  cashMonths:    number,
  nonCashMonths: number,
  missing:       string[],
  assumptions:   string[],
): WealthContext["dataQuality"] {
  const confidence = (n: number): Confidence =>
    n >= 5 ? "high" : n >= 2 ? "medium" : "low"

  return {
    confidence: {
      ncf:      confidence(cashMonths),
      spending: confidence(cashMonths),
      debt:     confidence(cashMonths),
      netWorth: confidence(nonCashMonths),
    },
    missing,
    assumptions,
  }
}

// ─── Point d'entrée public ────────────────────────────────────────────────────

export async function buildFinancialWealthContext(): Promise<WealthContext> {
  const t0 = Date.now()

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    console.warn("[wealth-context] Supabase unavailable — returning fallback")
    return WEALTH_CONTEXT_FALLBACK
  }

  // ── Fenêtre 6 mois glissants (cross-year safe) ───────────────────────────
  const today        = new Date()
  const currentYear  = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const currentKey   = toYYYYMM(currentYear, currentMonth)

  const cutoff = new Date(today)
  cutoff.setMonth(cutoff.getMonth() - 5)
  cutoff.setDate(1)
  const cutoffStr = cutoff.toISOString().slice(0, 10)   // "YYYY-MM-01"

  // ── Fetch (fail-open par requête) ────────────────────────────────────────
  const [cashResult, nonCashResult] = await Promise.allSettled([
    fetchRollingCash(supabase, cutoffStr),
    fetchNonCash(supabase, cutoffStr),
  ])

  const cashByMonth    = cashResult.status    === "fulfilled" ? cashResult.value    : new Map<string, FinanceEntry[]>()
  const nonCashByMonth = nonCashResult.status === "fulfilled" ? nonCashResult.value : new Map<string, NonCashRow[]>()

  // ── Compute PLResult par mois ────────────────────────────────────────────
  const allKeys = [...new Set([...cashByMonth.keys(), ...nonCashByMonth.keys()])].sort()

  const plByMonth = new Map<string, PLResult>()
  for (const key of allKeys) {
    const entries = cashByMonth.get(key) ?? []
    if (entries.length > 0) plByMonth.set(key, computePL(entries))
  }

  const sortedKeys    = [...plByMonth.keys()].sort()
  const completedKeys = sortedKeys.filter(k => k < currentKey)

  // ── Compute BalanceSheet par mois ────────────────────────────────────────
  const bsByMonth = new Map<string, BalanceSheet>()
  for (const key of allKeys) {
    const rows = nonCashByMonth.get(key)
    if (rows && rows.length > 0) {
      const [yStr, mStr] = key.split("-")
      const year  = parseInt(yStr, 10)
      const month = parseInt(mStr, 10)
      const prevKey  = sortedKeys[sortedKeys.indexOf(key) - 1]
      const prevRows = prevKey ? nonCashByMonth.get(prevKey) : undefined
      bsByMonth.set(key, computeBalanceSheet(rows, month, year, prevRows))
    }
  }

  console.log(
    `[wealth-context] cash months=${cashByMonth.size}` +
    ` nonCash months=${nonCashByMonth.size}` +
    ` pl months=${plByMonth.size}` +
    ` bs months=${bsByMonth.size}` +
    ` completed=${completedKeys.length}`,
  )

  if (sortedKeys.length === 0) {
    console.warn("[wealth-context] No data — returning fallback")
    return WEALTH_CONTEXT_FALLBACK
  }

  // ── Build sections (fail-open par section) ───────────────────────────────
  const [cashFlow, spending, debt, netWorth] = await Promise.allSettled([
    safeSection("cashFlow",  () => buildCashFlow(plByMonth, sortedKeys), null),
    safeSection("spending",  () => buildSpending(plByMonth, sortedKeys, currentKey), null),
    safeSection("debt",      () => buildDebt(plByMonth, sortedKeys), null),
    safeSection("netWorth",  () => buildNetWorth(bsByMonth, sortedKeys), null),
  ])

  const cf = cashFlow.status  === "fulfilled" ? cashFlow.value  : null
  const sp = spending.status  === "fulfilled" ? spending.value  : null
  const dt = debt.status      === "fulfilled" ? debt.value      : null
  const nw = netWorth.status  === "fulfilled" ? netWorth.value  : null

  // ── Alertes (mois courant exclu des high) ────────────────────────────────
  const alerts = buildAlerts(cf, dt, sp, currentKey)

  // ── Data quality ─────────────────────────────────────────────────────────
  const missing:     string[] = []
  const assumptions: string[] = []

  if (!cf)       missing.push("cash_flow")
  if (!sp)       missing.push("spending_trends")
  if (!dt)       missing.push("debt_trajectory")
  if (!nw)       missing.push("net_worth")
  if (bsByMonth.size <= 1) assumptions.push("net_worth: single snapshot, no historical trend")
  if (sortedKeys.includes(currentKey)) assumptions.push("current_month_partial: excluded from high-severity alerts")

  const dq = buildDataQuality(cashByMonth.size, nonCashByMonth.size, missing, assumptions)

  // ── Period ───────────────────────────────────────────────────────────────
  const period = {
    from:                sortedKeys[0] ?? null,
    to:                  sortedKeys[sortedKeys.length - 1] ?? null,
    months:              sortedKeys.length,
    completeness:        (cashByMonth.size >= 5 ? "high" : cashByMonth.size >= 2 ? "medium" : "low") as Confidence,
    currentMonthPartial: sortedKeys.includes(currentKey),
  }

  const ctx: WealthContext = { period, cashFlow: cf, spending: sp, debt: dt, netWorth: nw, alerts, dataQuality: dq }

  console.log(
    `[wealth-context] built in ${Date.now() - t0}ms` +
    ` alerts=${alerts.length}` +
    ` completeness=${period.completeness}`,
  )

  return ctx
}

// ─── Sérialiseur compact pour le prompt Claude ────────────────────────────────

/** Retourne un JSON compact (< 500 tokens) sans null. */
export function serializeWealthContext(ctx: WealthContext): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clean = (obj: any): any => {
    if (obj === null || obj === undefined) return undefined
    if (Array.isArray(obj))  return obj.map(clean).filter(v => v !== undefined)
    if (typeof obj === "object") {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(obj)) {
        const cv = clean(v)
        if (cv !== undefined) out[k] = cv
      }
      return Object.keys(out).length ? out : undefined
    }
    return obj
  }
  return JSON.stringify(clean(ctx))
}
