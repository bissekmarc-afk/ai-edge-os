import { Suspense } from "react"
import { TrendingUp, TrendingDown, Wallet, PiggyBank, CreditCard } from "lucide-react"
import {
  getLastDataMonth,
  getMonthKpis,
  getCashflowByMonth,
  getExpenseBreakdown,
  getLatestWealthSnapshots,
  computeAlerts,
  monthName,
  formatEur,
  formatPct,
  MOCK_KPIS,
  MOCK_CASHFLOW,
  MOCK_BREAKDOWN,
  MOCK_WEALTH,
} from "@/lib/queries/finance-dashboard"
import { SectionHeading } from "@/components/shared/section-heading"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { CashflowChart } from "@/components/finance/cashflow-chart"
import { CategoryBreakdown } from "@/components/finance/category-breakdown"
import { FinanceAlerts } from "@/components/finance/finance-alerts"
import { WealthSection } from "@/components/finance/wealth-section"
import { ResetResyncButton } from "@/components/finance/reset-resync-button"
import { Skeleton } from "@/components/ui/skeleton"

// ─── Inner async component (Suspense boundary target) ────────────────────────

async function FinanceDashboard() {
  const isDev = process.env.NODE_ENV === "development"

  // Find the last month with real data
  const lastMonth = await getLastDataMonth()
  const useMock = !lastMonth && isDev

  const dataMonth = lastMonth ?? { month: 5, year: 2026 }

  // All data in parallel
  const [kpis, cashflow, breakdown, wealth] = await Promise.all([
    useMock
      ? Promise.resolve(MOCK_KPIS)
      : getMonthKpis(dataMonth.month, dataMonth.year),
    useMock
      ? Promise.resolve(MOCK_CASHFLOW)
      : getCashflowByMonth(dataMonth.year),
    useMock
      ? Promise.resolve(MOCK_BREAKDOWN)
      : getExpenseBreakdown(dataMonth.month, dataMonth.year),
    useMock
      ? Promise.resolve(MOCK_WEALTH)
      : getLatestWealthSnapshots(),
  ])

  const alerts = computeAlerts(kpis, breakdown)

  return (
    <div className="flex flex-col gap-8">
      {/* Reference month */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Données de référence
        </span>
        <span className="rounded-full bg-[var(--ai-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ai-accent)]">
          {monthName(dataMonth.month, dataMonth.year)}
        </span>
        {useMock && (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400">
            Données de démo
          </span>
        )}
      </div>

      {/* Alerts */}
      <FinanceAlerts alerts={alerts} />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          title="Revenus"
          value={formatEur(kpis.income)}
          sub={`Mois de ${monthName(dataMonth.month, dataMonth.year)}`}
          icon={<TrendingUp className="size-4" />}
          trend="neutral"
          accentColor="var(--success)"
        />
        <KpiCard
          title="Dépenses"
          value={formatEur(kpis.expenses)}
          sub="Hors non-cash"
          icon={<TrendingDown className="size-4" />}
          trend="neutral"
          accentColor="var(--danger)"
        />
        <KpiCard
          title="Net Cash Flow"
          value={formatEur(kpis.netCashFlow)}
          sub={kpis.netCashFlow >= 0 ? "Positif ✓" : "Négatif ✗"}
          icon={<Wallet className="size-4" />}
          trend={kpis.netCashFlow >= 0 ? "up" : "down"}
        />
        <KpiCard
          title="Taux d'épargne"
          value={formatPct(kpis.savingsRate)}
          sub="(Revenus − Dépenses) / Revenus"
          icon={<PiggyBank className="size-4" />}
          trend={kpis.savingsRate >= 20 ? "up" : kpis.savingsRate < 10 ? "down" : "neutral"}
        />
        <KpiCard
          title="Debt Service"
          value={kpis.income > 0 ? formatPct(kpis.debtServiceRatio) : "—"}
          sub={kpis.debtService > 0 ? formatEur(kpis.debtService) : "Aucun"}
          icon={<CreditCard className="size-4" />}
          trend={kpis.debtServiceRatio > 10 ? "down" : "neutral"}
          accentColor={kpis.debtServiceRatio > 10 ? "var(--danger)" : undefined}
        />
      </div>

      {/* Chart + Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cashflow chart — 2/3 */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground">
            Cash Flow {dataMonth.year}
          </h3>
          <p className="text-xs text-muted-foreground">Revenus vs dépenses par mois (hors non-cash)</p>
          <CashflowChart data={cashflow} />
        </div>

        {/* Expense breakdown — 1/3 */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Dépenses par catégorie</h3>
          <p className="text-xs text-muted-foreground">
            Total : {formatEur(kpis.expenses)}
          </p>
          <CategoryBreakdown data={breakdown} />
        </div>
      </div>

      {/* Wealth */}
      {wealth.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <WealthSection assets={wealth} />
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}

export default function FinancePage() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Finance"
        description="Budget mensuel synchronisé depuis Google Sheets"
        action={<ResetResyncButton />}
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <FinanceDashboard />
      </Suspense>
    </div>
  )
}
