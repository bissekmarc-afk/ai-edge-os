// ─── FYForecastCard (Server Component) ───────────────────────────────────────
//
// Displays two forward-looking estimates:
//
//   FY Forecast (Full Year):
//     = Actual YTD (closed months in budget scope: BUDGET_START_MONTH → currentMonth-1)
//     + Actual for current month (not budget — real data if available)
//     + Active budget for future months (currentMonth+1 → BUDGET_END_MONTH)
//     Active budget = reforecast_6m overlay on budget_initial (per overlay rules)
//
//   Run Rate (annualised):
//     = Average of the last 3 closed months of actual × 12
//     Excludes: entry_subtype IN ('One-off','Seasonal','CAPEX'),
//               is_non_cash = true, sync_status = 'deleted'
//     Shows "N/A" if fewer than 3 closed months are available.

import { cn }                    from "@/lib/utils"
import { computePL }             from "@/lib/finance/aggregations"
import { applyReforecastOverlay } from "@/lib/finance/reforecast-overlay"
import { getAllScenariosForYear } from "@/lib/finance/budget-queries"
import type { FinanceEntry }     from "@/lib/finance/aggregations"

// ─── Budget scope constants ───────────────────────────────────────────────────

const BUDGET_START_MONTH = 5     // Google Sheets budget starts in May 2026
const BUDGET_START_YEAR  = 2026
const BUDGET_END_MONTH   = 12

// ─── Formatters ───────────────────────────────────────────────────────────────

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

function fmtEur(n: number)    { return EUR.format(n) }
function fmtSigned(n: number) { return `${n >= 0 ? "+" : ""}${fmtEur(n)}` }

function fmtMonth(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("fr-FR", { month: "long" })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sum the net cash flow from a set of FinanceEntry rows using computePL. */
function sumNetCashFlow(rows: FinanceEntry[]): number {
  return computePL(rows).netCashFlow
}

/**
 * Closed months = months in budget scope that are strictly before currentMonth.
 * Scope starts at BUDGET_START_MONTH, not at January.
 */
function closedMonths(currentMonth: number): number[] {
  const start = BUDGET_START_MONTH
  const end   = currentMonth - 1
  if (end < start) return []
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

/**
 * Future months = months strictly after currentMonth, up to BUDGET_END_MONTH.
 */
function futureMonths(currentMonth: number): number[] {
  const start = currentMonth + 1
  const end   = BUDGET_END_MONTH
  if (start > end) return []
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
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
  // Only compute FY forecast for the current year and within budget scope
  if (year !== currentYear || year !== BUDGET_START_YEAR) return null

  const { actual, budget_initial, reforecast_6m } = await getAllScenariosForYear(year)

  // ── FY Forecast ────────────────────────────────────────────────────────────

  // 1. Actual YTD: closed months in budget scope (BUDGET_START_MONTH → currentMonth-1)
  const closed       = closedMonths(currentMonth)
  const actualYtd    = actual.filter(r => r.month !== null && closed.includes(r.month as number))
  const actualYtdNcf = sumNetCashFlow(actualYtd)

  // 2. Current month: use actual data (not budget) — real figures if already entered
  const curActualNcf = sumNetCashFlow(forMonth(actual, currentMonth))

  // 3. Active budget for future months (currentMonth+1 → BUDGET_END_MONTH)
  const future = futureMonths(currentMonth)
  let futureNcf = 0

  console.log(
    `[FYForecastCard] budget_initial=${budget_initial.length} rows` +
    ` | reforecast_6m=${reforecast_6m.length} rows` +
    ` | future months: [${future.join(",")}]`,
  )

  // Months where the Sheets NCF is known (for inline diff logging)
  const SHEETS_NCF: Record<number, number> = { 6: 367, 7: -2940, 8: 1724, 9: -980, 10: -1304, 11: 657, 12: -487 }

  for (const m of future) {
    const mBudget     = forMonth(budget_initial, m)
    const mReforecast = forMonth(reforecast_6m,  m)
    const mActive     = applyReforecastOverlay(mBudget, mReforecast)
    const mPl         = computePL(mActive)
    const mNcf        = mPl.netCashFlow
    futureNcf        += mNcf

    const sheetsDiff = SHEETS_NCF[m] !== undefined
      ? ` | Δvs_sheets=${(mNcf - SHEETS_NCF[m]).toFixed(0)}`
      : ""

    console.log(
      `[FYForecastCard] m=${m}` +
      ` budget_rows=${mBudget.length} active_rows=${mActive.length}` +
      ` | ncf=${mNcf}` +
      ` (income=${mPl.grossIncome} taxes=${mPl.taxes}` +
      ` fixed=${mPl.fixedCosts} var=${mPl.variableCosts}` +
      ` oneOff=${mPl.oneOff} debt=${mPl.debtService} capex=${mPl.capex})` +
      sheetsDiff,
    )

    // Full per-bucket breakdown — every entry, grouped by bucket
    type BucketGroup = { total: number; lines: string[] }
    const byBucket = new Map<string, BucketGroup>()
    for (const item of mPl.classifiedEntries) {
      if (item.bucket === "ignored" || item.normalizedAmount === 0) continue
      const bg = byBucket.get(item.bucket) ?? { total: 0, lines: [] }
      bg.total += item.normalizedAmount
      bg.lines.push(
        `"${item.entry.label}" ${item.normalizedAmount}` +
        ` [${item.entry.entry_type ?? "?"}/${item.entry.flux_nature ?? "?"}` +
        ` cat=${item.entry.category ?? "?"} sub=${item.entry.entry_subtype ?? "-"}]` +
        ` → ${item.reason}`,
      )
      byBucket.set(item.bucket, bg)
    }
    for (const [bucket, { total, lines }] of byBucket) {
      console.log(`  ▸ [${bucket}] total=${total.toFixed(2)}`)
      for (const line of lines) {
        console.log(`      ${line}`)
      }
    }
  }

  console.log(`[FYForecastCard] futureNcf total=${futureNcf} over ${future.length} months`)

  // FY Forecast = Actual YTD + Current month actual + Future budget
  const fyForecast = actualYtdNcf + curActualNcf + futureNcf

  // ── Run Rate ───────────────────────────────────────────────────────────────

  // Last 3 closed months in budget scope (most recent first)
  const last3 = closed.slice(-3)

  let runRateTotal  = 0
  let runRateMonths = 0

  for (const m of last3) {
    const monthActual = actual.filter(r => r.month === m && isRunRateEligible(r))
    if (monthActual.length > 0) {
      runRateTotal += computePL(monthActual).netCashFlow
      runRateMonths++
    }
  }

  // Show "N/A" if fewer than 3 closed months — run rate is not meaningful yet
  const runRateReady = runRateMonths >= 3
  const runRate      = runRateReady ? (runRateTotal / runRateMonths) * 12 : 0

  // ── Budget YE (for comparison) ─────────────────────────────────────────────
  // Scope: BUDGET_START_MONTH → BUDGET_END_MONTH (not January → December)
  let totalBudgetNcf = 0
  console.log(`[FYForecastCard] Budget YE loop (m=${BUDGET_START_MONTH}→${BUDGET_END_MONTH}):`)
  for (let m = BUDGET_START_MONTH; m <= BUDGET_END_MONTH; m++) {
    const mBudget     = forMonth(budget_initial, m)
    const mReforecast = forMonth(reforecast_6m,  m)
    const mActive     = applyReforecastOverlay(mBudget, mReforecast)
    const mNcf        = sumNetCashFlow(mActive)
    totalBudgetNcf   += mNcf
    console.log(`  m=${m}: rows=${mActive.length} ncf=${mNcf} (running=${totalBudgetNcf})`)
  }

  const fyVsBudget     = fyForecast - totalBudgetNcf
  const fyHighlight    = fyForecast >= 0 ? "success" : "danger"
  const rrHighlight    = runRate    >= 0 ? "success" : "danger"
  const vsBudHighlight = fyVsBudget >= 0 ? "success" : "danger"

  const curMonthName = fmtMonth(currentMonth)

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
          sub={
            closed.length > 0
              ? `YTD ${fmtEur(actualYtdNcf)} · ${curMonthName} ${fmtEur(curActualNcf)} · Budget restant ${fmtEur(futureNcf)}`
              : `${curMonthName} actual ${fmtEur(curActualNcf)} · Budget restant ${fmtEur(futureNcf)}`
          }
          highlight={fyHighlight}
        />
        <KpiTile
          label="Run Rate × 12"
          value={runRateReady ? fmtEur(runRate) : "N/A"}
          sub={
            runRateReady
              ? `Moyenne ${runRateMonths} mois clôturés (excl. one-offs)`
              : `${runRateMonths}/3 mois clôturés — disponible en ${fmtMonth(BUDGET_START_MONTH + 2)}`
          }
          highlight={runRateReady ? rrHighlight : "neutral"}
        />
        <KpiTile
          label="FY vs Budget"
          value={fmtSigned(fyVsBudget)}
          sub={`Budget actif (mai–déc) : ${fmtEur(totalBudgetNcf)}`}
          highlight={vsBudHighlight}
        />
      </div>

      {/* YTD detail bar */}
      <div className="border-t border-border/50 px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span>
            Mois clôturés :{" "}
            <strong className="text-foreground">
              {closed.length === 0
                ? "0 (budget démarré ce mois)"
                : closed.length}
            </strong>
          </span>
          <span>·</span>
          <span>
            {curMonthName} actual :{" "}
            <strong className="text-foreground">{fmtEur(curActualNcf)}</strong>
          </span>
          {closed.length > 0 && (
            <>
              <span>·</span>
              <span>
                Actual YTD :{" "}
                <strong className="text-foreground">{fmtEur(actualYtdNcf)}</strong>
              </span>
            </>
          )}
          <span>·</span>
          <span>
            Mois restants :{" "}
            <strong className="text-foreground">{future.length}</strong>
          </span>
        </div>
      </div>
    </div>
  )
}
