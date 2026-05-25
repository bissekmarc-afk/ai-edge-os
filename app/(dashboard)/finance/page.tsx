import { Suspense } from "react"
import { SectionHeading }    from "@/components/shared/section-heading"
import { ResetResyncButton } from "@/components/finance/reset-resync-button"
import { PLStatementCard }   from "@/components/finance/pl-statement-card"
import { FinanceKpiCards }   from "@/components/finance/finance-kpi-cards"
import { FinanceAlerts }     from "@/components/finance/finance-alerts"
import { PLCashflowChart }   from "@/components/finance/cashflow-chart"
import { Skeleton }          from "@/components/ui/skeleton"
import { getLastDataMonth, getMonthRows, getYearRows, getNonCashRows } from "@/lib/finance/queries"
import { computePL, computeYearSummaries, computeBalanceSheet, monthName } from "@/lib/finance/aggregations"
import { getLatestWealthSnapshots } from "@/lib/queries/finance-dashboard"
import { BalanceSheetSection } from "@/components/finance/balance-sheet-section"

// ─── Fallback skeleton ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl lg:col-span-3" />
      </div>
    </div>
  )
}

// ─── Data-fetching inner component ───────────────────────────────────────────

async function FinanceDashboard() {
  const lastMonth = await getLastDataMonth()

  // No data yet — show empty state
  if (!lastMonth) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
        Aucune donnée disponible. Cliquez sur <strong>Reset &amp; Resync</strong> pour importer les données depuis Google Sheets.
      </div>
    )
  }

  const { month, year } = lastMonth

  // Previous month for balance sheet delta
  const prevM = month === 1 ? 12 : month - 1
  const prevY = month === 1 ? year - 1 : year

  // Fetch everything in parallel
  const [monthRows, yearRows, wealthAssets, nonCashRows, prevNonCashRows] = await Promise.all([
    getMonthRows(month, year),
    getYearRows(year),
    getLatestWealthSnapshots(),
    getNonCashRows(month, year),
    getNonCashRows(prevM, prevY),
  ])

  const pl              = computePL(monthRows)
  const yearlySummaries = computeYearSummaries(yearRows, year)
  const balanceSheet    = computeBalanceSheet(nonCashRows, month, year, prevNonCashRows)
  const wealthTotal     = wealthAssets.length > 0
    ? wealthAssets.reduce((s, a) => s + Number(a.amount), 0)
    : undefined

  return (
    <div className="flex flex-col gap-6">
      {/* ── Reference month badge ──────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Mois de référence
        </span>
        <span className="rounded-full bg-[var(--ai-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ai-accent)]">
          {monthName(month, year)}
        </span>
      </div>

      {/* ── Alerts ────────────────────────────────────────────────────── */}
      <FinanceAlerts pl={pl} />

      {/* ── KPI row ───────────────────────────────────────────────────── */}
      <FinanceKpiCards pl={pl} wealthTotal={wealthTotal} />

      {/* ── P&L + Chart ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* P&L statement — 2/5 */}
        <div className="lg:col-span-2">
          <PLStatementCard pl={pl} />
        </div>

        {/* Annual cashflow chart — 3/5 */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:col-span-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Cash Flow {year}
            </h3>
            <p className="text-xs text-muted-foreground">
              Revenus · Dépenses opérat. · Debt Service · Net Cash Flow
            </p>
          </div>
          <PLCashflowChart data={yearlySummaries} />
        </div>
      </div>

      {/* ── Bilan patrimonial ─────────────────────────────────────────── */}
      <BalanceSheetSection
        bs={balanceSheet}
        recurringNetIncome={pl.recurringIncome - pl.taxes}
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Finance"
        description="P&L · Family Office — DAF"
        action={<ResetResyncButton />}
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <FinanceDashboard />
      </Suspense>
    </div>
  )
}
