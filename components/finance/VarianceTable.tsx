// ─── VarianceTable (Server Component) ────────────────────────────────────────
//
// Compares actual vs active budget for a closed month and flags unfavourable
// variances.
//
// Variance rules (on closed months only):
//   Expense : actual > budget × 1.15  → unfavourable alert
//   Income  : actual < budget × 0.85  → unfavourable alert
//   Income  : actual > budget          → favourable, no alert
//   budget = 0                         → N/A
//   Current month                      → "en cours" badge, no alerts

import { cn }                          from "@/lib/utils"
import { matchKey, applyReforecastOverlay } from "@/lib/finance/reforecast-overlay"
import {
  getActualMonthRows,
  getBudgetMonthRows,
  getReforecastMonthRows,
} from "@/lib/finance/budget-queries"
import type { FinanceEntry } from "@/lib/finance/aggregations"

// ─── Formatters ───────────────────────────────────────────────────────────────

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

function fmtEur(n: number)  { return EUR.format(n) }
function fmtPct(n: number)  { return `${n >= 0 ? "+" : ""}${n.toFixed(1)} %` }

// ─── Types ────────────────────────────────────────────────────────────────────

type VarianceStatus = "ok" | "favourable" | "unfavourable" | "na" | "en_cours"

interface VarianceRow {
  category:     string
  label:        string
  actual:       number
  budget:       number
  varianceEur:  number
  variancePct:  number | null
  status:       VarianceStatus
  entryType:    "income" | "expense"
}

// ─── Variance computation ─────────────────────────────────────────────────────

function computeVariance(
  actual:      number,
  budget:      number,
  entryType:   "income" | "expense",
  isCurrent:   boolean,
): { varianceEur: number; variancePct: number | null; status: VarianceStatus } {
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
    // Unfavourable: actual > budget × 1.15 (overspent by more than 15 %)
    const status = actual > budget * 1.15 ? "unfavourable" : "ok"
    return { varianceEur, variancePct, status }
  }

  // Income: actual < budget × 0.85 → unfavourable
  //         actual > budget         → favourable
  let status: VarianceStatus = "ok"
  if (actual < budget * 0.85) status = "unfavourable"
  else if (actual > budget)   status = "favourable"

  return { varianceEur, variancePct, status }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CLS: Record<VarianceStatus, string> = {
  ok:            "bg-muted text-muted-foreground",
  favourable:    "bg-[var(--success)]/10 text-[var(--success)]",
  unfavourable:  "bg-[var(--danger)]/10 text-[var(--danger)]",
  na:            "bg-muted/60 text-muted-foreground",
  en_cours:      "bg-[var(--warning)]/10 text-[var(--warning)]",
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
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium",
        STATUS_CLS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VarianceTableProps {
  month:       number
  year:        number
  currentMonth: number
  currentYear:  number
}

// ─── Component ────────────────────────────────────────────────────────────────

export async function VarianceTable({
  month,
  year,
  currentMonth,
  currentYear,
}: VarianceTableProps) {
  const isCurrent = year === currentYear && month === currentMonth

  // Fetch in parallel
  const [actualRows, budgetRows, reforecastRows] = await Promise.all([
    getActualMonthRows(month, year),
    getBudgetMonthRows(month, year),
    getReforecastMonthRows(month, year),
  ])

  // Resolve active budget with reforecast overlay
  const activeBudget = applyReforecastOverlay(budgetRows, reforecastRows)

  // Build lookup: matchKey → active budget amount
  const budgetByKey = new Map<string, { amount: number; entryType: string }>()
  for (const b of activeBudget) {
    budgetByKey.set(matchKey(b), {
      amount:    Number(b.amount ?? 0),
      entryType: b.entry_type ?? "expense",
    })
  }

  // Build lookup: matchKey → actual sum (multiple actual rows can share the same key)
  const actualByKey = new Map<string, {
    amount:    number
    entry:     FinanceEntry
  }>()
  for (const row of actualRows) {
    const key = matchKey(row)
    const existing = actualByKey.get(key)
    if (existing) {
      existing.amount += Number(row.amount ?? 0)
    } else {
      actualByKey.set(key, { amount: Number(row.amount ?? 0), entry: row })
    }
  }

  // Collect all unique keys from both sides
  const allKeys = new Set([...budgetByKey.keys(), ...actualByKey.keys()])

  const rows: VarianceRow[] = []

  for (const key of allKeys) {
    const budgetSide = budgetByKey.get(key)
    const actualSide = actualByKey.get(key)

    const budget    = budgetSide?.amount ?? 0
    const actual    = actualSide?.amount ?? 0
    const entryType = (budgetSide?.entryType ?? actualSide?.entry?.entry_type ?? "expense") as "income" | "expense"

    const entry = actualSide?.entry ?? activeBudget.find(b => matchKey(b) === key)

    const category = String(entry?.category ?? "")
    const label    = String(entry?.label    ?? "")

    const { varianceEur, variancePct, status } = computeVariance(
      actual,
      budget,
      entryType,
      isCurrent,
    )

    rows.push({ category, label, actual, budget, varianceEur, variancePct, status, entryType })
  }

  // Sort: unfavourable first, then by |varianceEur| desc
  rows.sort((a, b) => {
    const priority = (s: VarianceStatus) => s === "unfavourable" ? 0 : s === "favourable" ? 1 : 2
    const p = priority(a.status) - priority(b.status)
    if (p !== 0) return p
    return Math.abs(b.varianceEur) - Math.abs(a.varianceEur)
  })

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 px-6 py-8 text-center text-sm text-muted-foreground">
        Aucune donnée de budget disponible pour ce mois.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="border-b border-border bg-muted/40 px-4 py-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Budget vs Actual — Variance
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
                <td className="px-4 py-2 text-right tabular-nums font-mono">{fmtEur(row.actual)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-mono text-muted-foreground">{fmtEur(row.budget)}</td>
                <td className={cn(
                  "px-4 py-2 text-right tabular-nums font-mono",
                  row.varianceEur > 0 && row.entryType === "income"   && "text-[var(--success)]",
                  row.varianceEur < 0 && row.entryType === "income"   && "text-[var(--danger)]",
                  row.varianceEur > 0 && row.entryType === "expense"  && "text-[var(--danger)]",
                  row.varianceEur < 0 && row.entryType === "expense"  && "text-[var(--success)]",
                  row.varianceEur === 0                                && "text-muted-foreground",
                )}>
                  {fmtEur(row.varianceEur)}
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
  )
}
