// ─── FYForecastCard (Server Component) ───────────────────────────────────────
//
// Displays two forward-looking estimates:
//
//   FY Forecast (Full Year):
//     = Actual YTD (months already closed)
//     + Active budget for current month
//     + Active budget for future months
//     Active budget = reforecast_6m overlay on budget_initial (per overlay rules)
//
//   Run Rate (annualised):
//     = Average of the last 3 closed months of actual × 12
//     Excludes: entry_subtype IN ('One-off','Seasonal','CAPEX'),
//               is_non_cash = true, sync_status = 'deleted'

import { cn }                           from "@/lib/utils"
import { computePL }                    from "@/lib/finance/aggregations"
import { applyReforecastOverlay } from "@/lib/finance/reforecast-overlay"
import { getAllScenariosForYear }        from "@/lib/finance/budget-queries"
import type { FinanceEntry }            from "@/lib/finance/aggregations"

// ─── Formatters ───────────────────────────────────────────────────────────────

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

function fmtEur(n: number) { return EUR.format(n) }
function fmtSigned(n: number) { return `${n >= 0 ? "+" : ""}${fmtEur(n)}` }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sum the net cash flow from a set of FinanceEntry rows using computePL. */
function sumNetCashFlow(rows: FinanceEntry[]): number {
  return computePL(rows).netCashFlow
}

/** Returns the set of months strictly before currentMonth in the same year. */
function closedMonths(currentMonth: number): number[] {
  return Array.from({ length: currentMonth - 1 }, (_, i) => i + 1)
}

/** Returns the set of months strictly after currentMonth in the same year. */
function futureMonths(currentMonth: number): number[] {
  return Array.from({ length: 12 - currentMonth }, (_, i) => currentMonth + 1 + i)
}

/** Filter rows to a specific month. */
function forMonth(rows: FinanceEntry[], month: number): FinanceEntry[] {
  return rows.filter(r => r.month === month)
}

// Subtypes that should be excluded from Run Rate computation
const RUN_RATE_EXCLUDED_SUBTYPES = new Set(["one-off", "seasonal", "capex"])

function isRunRateEligible(row: FinanceEntry): boolean {
  const sub = (row.entry_subtype ?? "").trim().toLowerCase()
  return !RUN_RATE_EXCLUDED_SUBTYPES.has(sub)
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FYForecastCardProps {
  year:         number
  currentMonth: number
  currentYear:  number
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  highlight,
}: {
  label:      string
  value:      string
  sub?:       string
  highlight?: "success" | "danger" | "neutral"
}) {
  const color =
    highlight === "success" ? "text-[var(--success)]"
    : highlight === "danger"  ? "text-[var(--danger)]"
    : "text-foreground"

  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-xl font-bold tabular-nums font-mono", color)}>
        {value}
      </span>
      {sub && (
        <span className="text-[10px] text-muted-foreground">{sub}</span>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export async function FYForecastCard({
  year,
  currentMonth,
  currentYear,
}: FYForecastCardProps) {
  // Only compute FY forecast for the current year
  if (year !== currentYear) return null

  const { actual, budget_initial, reforecast_6m } = await getAllScenariosForYear(year)

  // ── FY Forecast ────────────────────────────────────────────────────────────

  // 1. Actual YTD: sum of all closed months (months < currentMonth)
  const closed = closedMonths(currentMonth)
  const actualYtd = actual.filter(r => r.month !== null && closed.includes(r.month as number))
  const actualYtdNcf = sumNetCashFlow(actualYtd)

  // 2. Active budget for current month
  const curBudget      = forMonth(budget_initial, currentMonth)
  const curReforecast  = forMonth(reforecast_6m,  currentMonth)
  const curActiveBudget = applyReforecastOverlay(curBudget, curReforecast)
  const curMonthNcf    = sumNetCashFlow(curActiveBudget)

  // 3. Active budget for future months
  const future = futureMonths(currentMonth)
  let futureNcf = 0
  for (const m of future) {
    const mBudget     = forMonth(budget_initial, m)
    const mReforecast = forMonth(reforecast_6m,  m)
    const mActive     = applyReforecastOverlay(mBudget, mReforecast)
    futureNcf += sumNetCashFlow(mActive)
  }

  const fyForecast = actualYtdNcf + curMonthNcf + futureNcf

  // ── Run Rate ───────────────────────────────────────────────────────────────

  // Last 3 closed months (most recent first)
  const last3 = closed.slice(-3)

  let runRateTotal = 0
  let runRateMonths = 0

  for (const m of last3) {
    const monthActual = actual
      .filter(r => r.month === m && isRunRateEligible(r))
    if (monthActual.length > 0) {
      runRateTotal += computePL(monthActual).netCashFlow
      runRateMonths++
    }
  }

  const runRate =
    runRateMonths > 0 ? (runRateTotal / runRateMonths) * 12 : 0

  // ── Budget YE (for comparison) ─────────────────────────────────────────────
  let totalBudgetNcf = 0
  for (let m = 1; m <= 12; m++) {
    const mBudget     = forMonth(budget_initial, m)
    const mReforecast = forMonth(reforecast_6m,  m)
    const mActive     = applyReforecastOverlay(mBudget, mReforecast)
    totalBudgetNcf += sumNetCashFlow(mActive)
  }

  const fyVsBudget     = fyForecast - totalBudgetNcf
  const fyHighlight    = fyForecast >= 0 ? "success" : "danger"
  const rrHighlight    = runRate    >= 0 ? "success" : "danger"
  const vsBudHighlight = fyVsBudget >= 0 ? "success" : "danger"

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="border-b border-border bg-muted/40 px-4 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          FY Forecast {year}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <KpiTile
          label="FY Forecast NCF"
          value={fmtEur(fyForecast)}
          sub={`YTD ${fmtEur(actualYtdNcf)} + Budget restant ${fmtEur(curMonthNcf + futureNcf)}`}
          highlight={fyHighlight}
        />
        <KpiTile
          label="Run Rate × 12"
          value={fmtEur(runRate)}
          sub={`Moyenne ${runRateMonths} mois clôturés (excl. one-offs)`}
          highlight={rrHighlight}
        />
        <KpiTile
          label="FY vs Budget"
          value={fmtSigned(fyVsBudget)}
          sub={`Budget actif : ${fmtEur(totalBudgetNcf)}`}
          highlight={vsBudHighlight}
        />
      </div>

      {/* YTD detail bar */}
      <div className="border-t border-border/50 px-4 py-2">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>
            Mois clôturés : <strong className="text-foreground">{closed.length}</strong>
          </span>
          <span>·</span>
          <span>
            Mois restants : <strong className="text-foreground">{12 - closed.length}</strong>
          </span>
          <span>·</span>
          <span>
            Actual YTD : <strong className="text-foreground">{fmtEur(actualYtdNcf)}</strong>
          </span>
        </div>
      </div>
    </div>
  )
}
