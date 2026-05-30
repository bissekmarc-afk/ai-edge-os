import { Suspense }   from "react"
import Link            from "next/link"
import { Plus }        from "lucide-react"
import { SectionHeading }    from "@/components/shared/section-heading"
import { ResetResyncButton } from "@/components/finance/reset-resync-button"
import { buttonVariants }    from "@/components/ui/button"
import { PLStatementCard }   from "@/components/finance/pl-statement-card"
import { FinanceKpiCards }   from "@/components/finance/finance-kpi-cards"
import { FinanceAlerts }     from "@/components/finance/finance-alerts"
import { PLCashflowChart }   from "@/components/finance/cashflow-chart"
import { Skeleton }          from "@/components/ui/skeleton"
import { ScenarioToggle }    from "@/components/finance/ScenarioToggle"
import { VarianceTable }     from "@/components/finance/VarianceTable"
import { FYForecastCard }    from "@/components/finance/FYForecastCard"
import { getLastDataMonth, getMonthRows, getYearRows, getNonCashRows } from "@/lib/finance/queries"
import { computePL, computeYearSummaries, computeBalanceSheet, monthName } from "@/lib/finance/aggregations"
import { getLatestWealthSnapshots } from "@/lib/queries/finance-dashboard"
import { BalanceSheetSection } from "@/components/finance/balance-sheet-section"
import type { ScenarioValue } from "@/components/finance/ScenarioToggle"

// ─── searchParams type (Next.js 15/16 — Promise-based) ───────────────────────

type FinancePageSearchParams = Promise<{
  scenario?: string
}>

// ─── Scenario parsing ─────────────────────────────────────────────────────────

const VALID_SCENARIOS: ScenarioValue[] = [
  "actual",
  "budget_initial",
  "reforecast_6m",
  "variance",
]

function parseScenario(raw: string | undefined): ScenarioValue {
  if (raw && (VALID_SCENARIOS as string[]).includes(raw)) {
    return raw as ScenarioValue
  }
  return "actual"
}

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

async function FinanceDashboard({ scenario }: { scenario: ScenarioValue }) {
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

  // Current wall-clock month for variance / forecast logic
  const now          = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear  = now.getFullYear()

  // Previous month for balance sheet delta
  const prevM = month === 1 ? 12 : month - 1
  const prevY = month === 1 ? year - 1 : year

  // Map UI scenario → DB scenario for P&L and chart queries.
  // 'variance' is handled by VarianceTable; the P&L shows actual as baseline.
  const dbScenario: "actual" | "budget_initial" | "reforecast_6m" =
    scenario === "budget_initial"  ? "budget_initial"  :
    scenario === "reforecast_6m"   ? "reforecast_6m"   :
    "actual"  // covers 'actual' and 'variance'

  // Fetch everything in parallel — month/year rows filtered by scenario
  const [monthRows, yearRows, wealthAssets, nonCashRows, prevNonCashRows] = await Promise.all([
    getMonthRows(month, year, dbScenario),
    getYearRows(year, dbScenario),
    getLatestWealthSnapshots(),
    getNonCashRows(month, year),
    getNonCashRows(prevM, prevY),
  ])

  const pl              = computePL(monthRows)
  const yearlySummaries = computeYearSummaries(yearRows, year)
  const balanceSheet    = computeBalanceSheet(nonCashRows, month, year, prevNonCashRows)

  // For budget/reforecast, the chart must not show empty Jan-Apr bars.
  // computeYearSummaries always produces 12 slots — trim the dead ones here.
  const chartData =
    (dbScenario === "budget_initial" || dbScenario === "reforecast_6m")
      ? yearlySummaries.filter(s => s.month >= 5)
      : yearlySummaries
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

      {/* ── FY Forecast — visible for all scenarios ────────────────────── */}
      <FYForecastCard
        year={year}
        currentMonth={currentMonth}
        currentYear={currentYear}
      />

      {/* ── Variance Table — only when scenario === 'variance' ─────────── */}
      {scenario === "variance" && (
        <VarianceTable
          month={month}
          year={year}
          currentMonth={currentMonth}
          currentYear={currentYear}
        />
      )}

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
          <PLCashflowChart data={chartData} />
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

export default async function FinancePage(props: {
  searchParams: FinancePageSearchParams
}) {
  // searchParams is a Promise in Next.js 15/16 — must be awaited
  const sp       = await props.searchParams
  const scenario = parseScenario(sp?.scenario)

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Finance"
        description="P&L · Family Office — DAF"
        action={
          <div className="flex items-center gap-2">
            <Link href="/saisie" className={buttonVariants({ size: "sm" })}>
              <Plus className="size-3.5" />
              Saisir
            </Link>
            <ResetResyncButton />
          </div>
        }
      />

      {/* ── Scenario Toggle — wrapped in Suspense per Next.js docs ──────── */}
      <Suspense fallback={<Skeleton className="h-10 w-80 rounded-lg" />}>
        <ScenarioToggle active={scenario} />
      </Suspense>

      <Suspense fallback={<DashboardSkeleton />}>
        <FinanceDashboard scenario={scenario} />
      </Suspense>
    </div>
  )
}
