// ─── VarianceTable (Server Component) ────────────────────────────────────────
//
// Two sections:
//
//   1. Variance YTD  (above)
//      Closed months = month >= BUDGET_START_MONTH AND month < currentMonth
//                      AND year = BUDGET_START_YEAR
//      • 0 closed months → grey N/A banner + indicative current-month NCF line
//      • ≥1 closed months → aggregated table by category with total NCF row
//
//   2. Variance du mois  (below — unchanged)
//      Compares actual vs active budget for the currently-selected month.
//      Flags unfavourable variances (expense > budget×1.15, income < budget×0.85).

import { cn }                     from "@/lib/utils"
import { computePL }              from "@/lib/finance/aggregations"
import { applyReforecastOverlay } from "@/lib/finance/reforecast-overlay"
import {
  getActualMonthRows,
  getBudgetMonthRows,
  getReforecastMonthRows,
} from "@/lib/finance/budget-queries"
import type { FinanceEntry } from "@/lib/finance/aggregations"

// ─── Budget scope constants ───────────────────────────────────────────────────

const BUDGET_START_MONTH = 5
const BUDGET_START_YEAR  = 2026

// ─── Local match key (monthly variance only) ──────────────────────────────────
//
// Keyed on normalized_label + flux_nature + month + year.
// Category excluded: manual entries often differ from budget DAF.

function normalizeStr(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function varianceKey(entry: {
  label?:       string | null
  flux_nature?: string | null
  month?:       number | null
  year?:        number | null
}): string {
  return `${normalizeStr(entry.label)}|${normalizeStr(entry.flux_nature)}|${entry.month ?? 0}|${entry.year ?? 0}`
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const EUR = new Intl.NumberFormat("fr-FR", {
  style:                "currency",
  currency:             "EUR",
  maximumFractionDigits: 0,
})

function fmtEur(n: number)    { return EUR.format(n) }
function fmtPct(n: number)    { return `${n >= 0 ? "+" : ""}${n.toFixed(1)} %` }
function fmtSigned(n: number) { return `${n >= 0 ? "+" : ""}${fmtEur(n)}` }

function fmtMonth(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("fr-FR", { month: "long" })
}

// ─── Types ────────────────────────────────────────────────────────────────────

type VarianceStatus = "ok" | "favourable" | "unfavourable" | "na" | "en_cours"

interface VarianceRow {
  category:    string
  label:       string
  actual:      number
  budget:      number
  varianceEur: number
  variancePct: number | null
  status:      VarianceStatus
  entryType:   "income" | "expense"
}

// ─── Variance computation ─────────────────────────────────────────────────────
//
// Budget entries are stored as positive values (even for expenses).
// Actual expense entries can be negative (Cash Out negative).
//
// Normalisation:
//   expense → Math.abs() both sides; varianceEur = actual_abs - budget_abs
//             positive = overspent, negative = underspent
//   income  → both positive; varianceEur = actual - budget
//
// Unfavourable:
//   expense : actual_abs > budget_abs × 1.15
//   income  : actual     < budget     × 0.85

function computeVariance(
  actualRaw:  number,
  budgetRaw:  number,
  entryType:  "income" | "expense",
  isCurrent:  boolean,
): { varianceEur: number; variancePct: number | null; status: VarianceStatus } {

  const actual = entryType === "expense" ? Math.abs(actualRaw) : actualRaw
  const budget = entryType === "expense" ? Math.abs(budgetRaw) : budgetRaw

  const varianceEur = actual - budget

  if (isCurrent) {
    return {
      varianceEur,
      variancePct: budget !== 0 ? (varianceEur / budget) * 100 : null,
      status: "en_cours",
    }
  }

  if (budget === 0) {
    return { varianceEur, variancePct: null, status: "na" }
  }

  const variancePct = (varianceEur / budget) * 100

  if (entryType === "expense") {
    return {
      varianceEur,
      variancePct,
      status: actual > budget * 1.15 ? "unfavourable" : "ok",
    }
  }

  let status: VarianceStatus = "ok"
  if (actual < budget * 0.85)  status = "unfavourable"
  else if (actual > budget)    status = "favourable"

  return { varianceEur, variancePct, status }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CLS: Record<VarianceStatus, string> = {
  ok:           "bg-muted text-muted-foreground",
  favourable:   "bg-[var(--success)]/10 text-[var(--success)]",
  unfavourable: "bg-[var(--danger)]/10 text-[var(--danger)]",
  na:           "bg-muted/60 text-muted-foreground",
  en_cours:     "bg-[var(--warning)]/10 text-[var(--warning)]",
}

const STATUS_LABEL: Record<VarianceStatus, string> = {
  ok:           "OK",
  favourable:   "Favorable",
  unfavourable: "Alerte",
  na:           "N/A",
  en_cours:     "En cours",
}

function StatusBadge({ status }: { status: VarianceStatus }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_CLS[status])}>
      {STATUS_LABEL[status]}
    </span>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VarianceTableProps {
  month:        number
  year:         number
  currentMonth: number
  currentYear:  number
}

// ─── YTD accumulator type ─────────────────────────────────────────────────────

type YtdBucket = {
  category:  string
  actualRaw: number   // sum of raw DB amounts (may be negative for Cash Out)
  budgetRaw: number   // sum of raw budget amounts (always positive)
  entryType: "income" | "expense"
}

// ─── Component ────────────────────────────────────────────────────────────────

export async function VarianceTable({
  month,
  year,
  currentMonth,
  currentYear,
}: VarianceTableProps) {
  const isCurrent = year === currentYear && month === currentMonth

  // ── Closed months in budget scope ────────────────────────────────────────────
  //
  // A month is "closed" when:
  //   • it belongs to the budget year (BUDGET_START_YEAR)
  //   • it is within budget scope (>= BUDGET_START_MONTH)
  //   • it is strictly before the current wall-clock month
  //
  const closedMonths: number[] = []
  if (currentYear === BUDGET_START_YEAR) {
    for (let m = BUDGET_START_MONTH; m < currentMonth; m++) {
      closedMonths.push(m)
    }
  }

  // ── Fetch selected-month data (for monthly variance table + indicative NCF) ──
  const [actualRows, budgetRows, reforecastRows] = await Promise.all([
    getActualMonthRows(month, year),
    getBudgetMonthRows(month, year),
    getReforecastMonthRows(month, year),
  ])

  // ── DEBUG LOGS ──────────────────────────────────────────────────────────────
  console.log(
    `[VarianceTable] ${year}-M${String(month).padStart(2, "0")} ──` +
    ` actual=${actualRows.length} budget=${budgetRows.length} reforecast=${reforecastRows.length}`,
  )

  if (actualRows.length === 0) {
    console.warn(`[VarianceTable] ⚠️  Aucune entrée actual pour ${year}-M${month}`)
  } else {
    console.log(`[VarianceTable] Actual rows brutes (${actualRows.length}) :`)
    actualRows.forEach((r, i) => {
      console.log(
        `  [${i}] amount=${r.amount} entry_type=${r.entry_type}` +
        ` category="${r.category}" label="${r.label}"` +
        ` month=${r.month} year=${r.year} scenario=${(r as { scenario?: string }).scenario ?? "?"}` +
        `  → varianceKey="${varianceKey(r)}"`,
      )
    })
  }

  console.log(`[VarianceTable] Budget rows (${budgetRows.length}) — 5 premiers :`)
  budgetRows.slice(0, 5).forEach((r, i) => {
    console.log(
      `  [${i}] amount=${r.amount} entry_type=${r.entry_type}` +
      ` category="${r.category}" label="${r.label}"` +
      `  → varianceKey="${varianceKey(r)}"`,
    )
  })

  // ── Apply reforecast overlay for the selected month ─────────────────────────
  const activeBudget = applyReforecastOverlay(budgetRows, reforecastRows)

  // ── Indicative NCF for the selected month (used in both banners) ─────────────
  const curActualNcf   = computePL(actualRows).netCashFlow
  const curBudgetNcf   = computePL(activeBudget).netCashFlow
  const curVarianceNcf = curActualNcf - curBudgetNcf

  // ── Fetch and aggregate YTD data (only when closed months exist) ─────────────

  let ytdBuckets: YtdBucket[] = []
  let ytdActualNcf = 0
  let ytdBudgetNcf = 0

  if (closedMonths.length > 0) {
    // Parallel fetch for every closed month
    const monthDataArr = await Promise.all(
      closedMonths.map(async (m) => {
        const [act, bud, ref] = await Promise.all([
          getActualMonthRows(m, year),
          getBudgetMonthRows(m, year),
          getReforecastMonthRows(m, year),
        ])
        return { actual: act, activeBudget: applyReforecastOverlay(bud, ref) }
      }),
    )

    // Category-keyed accumulator
    const accumMap = new Map<string, YtdBucket>()

    for (const { actual: actM, activeBudget: budM } of monthDataArr) {
      // Accumulate NCF totals
      ytdActualNcf += computePL(actM).netCashFlow
      ytdBudgetNcf += computePL(budM).netCashFlow

      // Accumulate actual by category
      for (const row of actM) {
        const catKey     = (row.category ?? "").trim().toLowerCase()
        const catDisplay = (row.category ?? "").trim()
        const existing   = accumMap.get(catKey)
        if (existing) {
          existing.actualRaw += Number(row.amount ?? 0)
        } else {
          accumMap.set(catKey, {
            actualRaw: Number(row.amount ?? 0),
            budgetRaw: 0,
            entryType: (row.entry_type ?? "expense") as "income" | "expense",
            category:  catDisplay,
          })
        }
      }

      // Accumulate budget by category
      for (const row of budM) {
        const catKey     = (row.category ?? "").trim().toLowerCase()
        const catDisplay = (row.category ?? "").trim()
        const existing   = accumMap.get(catKey)
        if (existing) {
          existing.budgetRaw += Number(row.amount ?? 0)
        } else {
          accumMap.set(catKey, {
            actualRaw: 0,
            budgetRaw: Number(row.amount ?? 0),
            entryType: (row.entry_type ?? "expense") as "income" | "expense",
            category:  catDisplay,
          })
        }
      }
    }

    // Sort by |varianceEur| descending (normalised)
    ytdBuckets = [...accumMap.values()].sort((a, b) => {
      const va = Math.abs(
        (a.entryType === "expense" ? Math.abs(a.actualRaw) : a.actualRaw) -
        (a.entryType === "expense" ? Math.abs(a.budgetRaw) : a.budgetRaw),
      )
      const vb = Math.abs(
        (b.entryType === "expense" ? Math.abs(b.actualRaw) : b.actualRaw) -
        (b.entryType === "expense" ? Math.abs(b.budgetRaw) : b.budgetRaw),
      )
      return vb - va
    })
  }

  // ── Monthly variance — build lookup maps ─────────────────────────────────────

  const budgetByKey = new Map<string, { amount: number; entryType: string }>()
  for (const b of activeBudget) {
    budgetByKey.set(varianceKey(b), {
      amount:    Number(b.amount ?? 0),
      entryType: b.entry_type ?? "expense",
    })
  }

  const actualByKey = new Map<string, { amount: number; entry: FinanceEntry }>()
  for (const row of actualRows) {
    const key      = varianceKey(row)
    const existing = actualByKey.get(key)
    if (existing) {
      existing.amount += Number(row.amount ?? 0)
    } else {
      actualByKey.set(key, { amount: Number(row.amount ?? 0), entry: row })
    }
  }

  // ── Matching report ──────────────────────────────────────────────────────────
  console.log(`[VarianceTable] Matching actual → budget :`)
  for (const [key, { amount }] of actualByKey) {
    const hit = budgetByKey.has(key)
    console.log(`  ${hit ? "✅ HIT " : "❌ MISS"} actual_amount=${amount}  key="${key}"`)
  }

  // ── Fallback: unmatched actual rows aggregated by category ───────────────────

  type FallbackBucket = {
    amount:    number
    entryType: "income" | "expense"
    category:  string
  }

  const fallbackByCategory = new Map<string, FallbackBucket>()

  for (const row of actualRows) {
    if (budgetByKey.has(varianceKey(row))) continue

    const cat    = (row.category ?? "").trim()
    const catKey = cat.toLowerCase()
    const amount = Number(row.amount ?? 0)

    const existing = fallbackByCategory.get(catKey)
    if (existing) {
      existing.amount += amount
    } else {
      fallbackByCategory.set(catKey, {
        amount,
        entryType: (row.entry_type ?? "expense") as "income" | "expense",
        category:  cat,
      })
    }
  }

  if (fallbackByCategory.size > 0) {
    console.log(`[VarianceTable] Fallback buckets (${fallbackByCategory.size}) :`)
    for (const [key, { amount, category }] of fallbackByCategory) {
      console.log(`  catKey="${key}" category="${category}" amount=${amount}`)
    }
  }

  // ── Build monthly variance rows ──────────────────────────────────────────────

  const allKeys = new Set([...budgetByKey.keys(), ...actualByKey.keys()])
  const rows: VarianceRow[] = []

  for (const key of allKeys) {
    const budgetSide = budgetByKey.get(key)
    const actualSide = actualByKey.get(key)

    const actualRaw  = actualSide?.amount ?? 0
    const budgetRaw  = budgetSide?.amount ?? 0
    const entryType  = (budgetSide?.entryType ?? actualSide?.entry?.entry_type ?? "expense") as "income" | "expense"
    const entry      = actualSide?.entry ?? activeBudget.find(b => varianceKey(b) === key)

    const category   = String(entry?.category ?? "")
    const label      = String(entry?.label    ?? "")

    const { varianceEur, variancePct, status } = computeVariance(actualRaw, budgetRaw, entryType, isCurrent)

    const actual = entryType === "expense" ? Math.abs(actualRaw) : actualRaw
    const budget = entryType === "expense" ? Math.abs(budgetRaw) : budgetRaw

    rows.push({ category, label, actual, budget, varianceEur, variancePct, status, entryType })
  }

  // Append fallback "Autres [category]" rows
  for (const { amount: actualRaw, entryType, category } of fallbackByCategory.values()) {
    if (actualRaw === 0) continue
    const { varianceEur, variancePct, status } = computeVariance(actualRaw, 0, entryType, isCurrent)
    const actual = entryType === "expense" ? Math.abs(actualRaw) : actualRaw
    rows.push({ category, label: `Autres ${category}`, actual, budget: 0, varianceEur, variancePct, status, entryType })
  }

  // Sort: unfavourable first, then by |varianceEur| desc
  rows.sort((a, b) => {
    const priority = (s: VarianceStatus) => s === "unfavourable" ? 0 : s === "favourable" ? 1 : 2
    const p = priority(a.status) - priority(b.status)
    if (p !== 0) return p
    return Math.abs(b.varianceEur) - Math.abs(a.varianceEur)
  })

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">

      {/* ══ Variance YTD ═══════════════════════════════════════════════════════ */}

      {closedMonths.length === 0 ? (

        /* 0 closed months — N/A banner + indicative current-month NCF */
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Variance YTD
            </p>
          </div>
          <div className="flex flex-col gap-3 px-4 py-3">
            {/* N/A banner */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">N/A</span>
              <span>0 mois clôturé dans la période mai–déc {BUDGET_START_YEAR}</span>
            </div>
            {/* Indicative current-month NCF */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              <span className="font-semibold capitalize text-foreground">
                {fmtMonth(month)} (en cours)
              </span>
              <span>·</span>
              <span>
                Actual NCF{" "}
                <strong className={curActualNcf >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                  {fmtEur(curActualNcf)}
                </strong>
              </span>
              <span>·</span>
              <span>
                Budget{" "}
                <strong className="text-foreground">{fmtEur(curBudgetNcf)}</strong>
              </span>
              <span>·</span>
              <span>
                Écart{" "}
                <strong className={curVarianceNcf >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                  {fmtSigned(curVarianceNcf)}
                </strong>
              </span>
            </div>
          </div>
        </div>

      ) : (

        /* ≥1 closed months — YTD table by category */
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Variance YTD — {fmtMonth(BUDGET_START_MONTH)} → {fmtMonth(closedMonths[closedMonths.length - 1])}{" "}
              ({closedMonths.length} mois clôturé{closedMonths.length > 1 ? "s" : ""})
            </p>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                (ytdActualNcf - ytdBudgetNcf) >= 0
                  ? "bg-[var(--success)]/10 text-[var(--success)]"
                  : "bg-[var(--danger)]/10 text-[var(--danger)]",
              )}
            >
              NCF {fmtSigned(ytdActualNcf - ytdBudgetNcf)}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Catégorie</th>
                  <th className="px-4 py-2 text-right font-medium">Actual</th>
                  <th className="px-4 py-2 text-right font-medium">Budget</th>
                  <th className="px-4 py-2 text-right font-medium">Variance €</th>
                  <th className="px-4 py-2 text-center font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {ytdBuckets.map((bucket, i) => {
                  const { varianceEur, variancePct: _, status } = computeVariance(
                    bucket.actualRaw,
                    bucket.budgetRaw,
                    bucket.entryType,
                    false,   // closed months are never "en cours"
                  )
                  const actual = bucket.entryType === "expense" ? Math.abs(bucket.actualRaw) : bucket.actualRaw
                  const budget = bucket.entryType === "expense" ? Math.abs(bucket.budgetRaw) : bucket.budgetRaw

                  return (
                    <tr
                      key={i}
                      className={cn(
                        "transition-colors",
                        status === "unfavourable" && "bg-[var(--danger)]/4",
                        status === "favourable"   && "bg-[var(--success)]/4",
                      )}
                    >
                      <td className="px-4 py-2 font-medium capitalize text-foreground">
                        {bucket.category || "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-mono">
                        {fmtEur(actual)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-mono text-muted-foreground">
                        {fmtEur(budget)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2 text-right tabular-nums font-mono",
                          varianceEur > 0 && bucket.entryType === "income"  && "text-[var(--success)]",
                          varianceEur < 0 && bucket.entryType === "income"  && "text-[var(--danger)]",
                          varianceEur > 0 && bucket.entryType === "expense" && "text-[var(--danger)]",
                          varianceEur < 0 && bucket.entryType === "expense" && "text-[var(--success)]",
                          varianceEur === 0                                  && "text-muted-foreground",
                        )}
                      >
                        {fmtSigned(varianceEur)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <StatusBadge status={status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Totals */}
              <tfoot>
                <tr className="border-t border-border bg-muted/30 font-semibold text-xs">
                  <td className="px-4 py-2 text-foreground">Net Cash Flow</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono">
                    {fmtEur(ytdActualNcf)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono text-muted-foreground">
                    {fmtEur(ytdBudgetNcf)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2 text-right tabular-nums font-mono",
                      (ytdActualNcf - ytdBudgetNcf) >= 0
                        ? "text-[var(--success)]"
                        : "text-[var(--danger)]",
                    )}
                  >
                    {fmtSigned(ytdActualNcf - ytdBudgetNcf)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Indicative current-month NCF as footer note */}
          {month >= BUDGET_START_MONTH && (
            <div className="border-t border-border/50 px-4 py-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span className="font-medium capitalize text-foreground">
                  {fmtMonth(month)} (en cours)
                </span>
                <span>·</span>
                <span>
                  Actual NCF{" "}
                  <strong className={curActualNcf >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                    {fmtEur(curActualNcf)}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Budget{" "}
                  <strong className="text-foreground">{fmtEur(curBudgetNcf)}</strong>
                </span>
                <span>·</span>
                <span>
                  Écart{" "}
                  <strong className={curVarianceNcf >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                    {fmtSigned(curVarianceNcf)}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>

      )}

      {/* ══ Variance du mois ═══════════════════════════════════════════════════ */}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/40 px-6 py-8 text-center text-sm text-muted-foreground">
          Aucune donnée de budget disponible pour ce mois.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Budget vs Actual — {fmtMonth(month)} {year}
            </p>
            {isCurrent && (
              <span className="rounded bg-[var(--warning)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--warning)]">
                Mois en cours
              </span>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Catégorie</th>
                  <th className="px-4 py-2 text-right font-medium">Actual</th>
                  <th className="px-4 py-2 text-right font-medium">Budget</th>
                  <th className="px-4 py-2 text-right font-medium">Variance €</th>
                  <th className="px-4 py-2 text-right font-medium">Variance %</th>
                  <th className="px-4 py-2 text-center font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={cn(
                      "transition-colors",
                      row.status === "unfavourable" && "bg-[var(--danger)]/4",
                      row.status === "favourable"   && "bg-[var(--success)]/4",
                    )}
                  >
                    <td className="px-4 py-2">
                      <div className="font-medium text-foreground">{row.label || row.category}</div>
                      {row.label && row.category && (
                        <div className="text-muted-foreground">{row.category}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-mono">
                      {fmtEur(row.actual)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-mono text-muted-foreground">
                      {fmtEur(row.budget)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right tabular-nums font-mono",
                        row.varianceEur > 0 && row.entryType === "income"  && "text-[var(--success)]",
                        row.varianceEur < 0 && row.entryType === "income"  && "text-[var(--danger)]",
                        row.varianceEur > 0 && row.entryType === "expense" && "text-[var(--danger)]",
                        row.varianceEur < 0 && row.entryType === "expense" && "text-[var(--success)]",
                        row.varianceEur === 0                               && "text-muted-foreground",
                      )}
                    >
                      {fmtSigned(row.varianceEur)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-mono text-muted-foreground">
                      {row.variancePct !== null ? fmtPct(row.variancePct) : "—"}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
