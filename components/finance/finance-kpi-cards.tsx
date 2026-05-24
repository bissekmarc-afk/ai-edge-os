import { TrendingUp, Wallet, CreditCard, PiggyBank } from "lucide-react"
import { KpiCard } from "@/components/dashboard/kpi-card"
import type { PLMonth } from "@/lib/finance/types"

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

function fmtEur(n: number): string { return EUR.format(n) }
function fmtPct(n: number): string { return `${(n * 100).toFixed(1)}%` }

interface FinanceKpiCardsProps {
  pl: PLMonth
}

export function FinanceKpiCards({ pl }: FinanceKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {/* EBITDA */}
      <KpiCard
        title="EBITDA"
        value={fmtEur(pl.ebitda)}
        sub={`${fmtPct(pl.ebitdaRate)} des revenus bruts`}
        icon={<TrendingUp className="size-4" />}
        trend={pl.ebitda >= 0 ? "up" : "down"}
        accentColor={pl.ebitda >= 0 ? "var(--success)" : "var(--danger)"}
      />

      {/* NET CASH FLOW */}
      <KpiCard
        title="Net Cash Flow"
        value={fmtEur(pl.netCashFlow)}
        sub={pl.netCashFlow >= 0 ? "Positif ✓" : "Négatif ✗"}
        icon={<Wallet className="size-4" />}
        trend={pl.netCashFlow >= 0 ? "up" : "down"}
        accentColor={pl.netCashFlow >= 0 ? "var(--success)" : "var(--danger)"}
      />

      {/* DEBT SERVICE RATIO */}
      <KpiCard
        title="Debt Service"
        value={fmtPct(pl.debtServiceRatio)}
        sub={`${fmtEur(pl.debtService)} / mois`}
        icon={<CreditCard className="size-4" />}
        trend={pl.debtServiceRatio > 0.25 ? "down" : "neutral"}
        accentColor={pl.debtServiceRatio > 0.25 ? "var(--warning)" : undefined}
      />

      {/* SAVINGS RATE */}
      <KpiCard
        title="Taux d'épargne"
        value={fmtPct(pl.savingsRate)}
        sub="(CAPEX + NCF) / Revenus nets"
        icon={<PiggyBank className="size-4" />}
        trend={pl.savingsRate >= 0.2 ? "up" : pl.savingsRate < 0.1 ? "down" : "neutral"}
      />
    </div>
  )
}
