import { TrendingUp, Wallet, CreditCard, PiggyBank, Landmark } from "lucide-react"
import { cn } from "@/lib/utils"
import { KpiCard } from "@/components/dashboard/kpi-card"
import type { PLResult } from "@/lib/finance/aggregations"

// ─── Formatters ───────────────────────────────────────────────────────────────

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

function fmtEur(n: number): string       { return EUR.format(n) }
function fmtPct(n: number): string       { return `${n.toFixed(1)}%` }  // n already in %

// ─── Status helpers ───────────────────────────────────────────────────────────
//
//   KPI           measure                target    direction
//   ─────────────────────────────────────────────────────────
//   EBITDA        ebitda / grossIncome   > 10%     surplus
//   Debt Service  debtService / netIncome < 25%    expense
//   Savings rate  (capex+ncf) / netIncome > 15%   surplus
//   NCF           € absolute             ≥ 0       surplus (0 = min)

type Status = "ok" | "warn" | "danger"

/** Lower is better — warn > max × 0.8, danger > max */
function expStatus(val: number, max: number): Status {
  if (val > max)          return "danger"
  if (val > max * 0.8)    return "warn"
  return "ok"
}

/** Higher is better — warn < min, danger < min × 0.8 */
function surpStatus(val: number, min: number): Status {
  if (val < min * 0.8)    return "danger"
  if (val < min)          return "warn"
  return "ok"
}

const COLOR: Record<Status, string> = {
  ok:     "var(--success)",
  warn:   "var(--warning)",
  danger: "var(--danger)",
}

const TREND: Record<Status, "up" | "down" | "neutral"> = {
  ok:     "up",
  warn:   "neutral",
  danger: "down",
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FinanceKpiCardsProps {
  pl:           PLResult
  wealthTotal?: number
}

export function FinanceKpiCards({ pl, wealthTotal }: FinanceKpiCardsProps) {

  // ── EBITDA% — target > 10% of gross income ────────────────────────────
  const ebitdaPct    = (pl.ebitdaRate ?? 0) * 100
  const ebitdaSt     = surpStatus(ebitdaPct, 10)

  // ── Debt Service — target < 25% of net income ─────────────────────────
  const dsPct        = (pl.debtServiceRatio ?? 0) * 100
  const dsSt         = expStatus(dsPct, 25)

  // ── Savings rate — target > 15% of net income ─────────────────────────
  const savPct       = (pl.savingsRate ?? 0) * 100
  const savSt        = surpStatus(savPct, 15)

  // ── Recurring net income (base for KPI sub-labels) ────────────────────
  const recurringNetIncome = pl.recurringIncome - pl.taxes

  // ── Net Cash Flow — positive = ok ─────────────────────────────────────
  const ncfSt: Status = pl.netCashFlow >= 0 ? "ok" : "danger"

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4",
        wealthTotal !== undefined ? "lg:grid-cols-5" : "lg:grid-cols-4",
      )}
    >
      {/* ── EBITDA% ───────────────────────────────────────────────────── */}
      <KpiCard
        title="EBITDA"
        value={fmtPct(ebitdaPct)}
        sub={`cible > 10% · base rée. ${fmtEur(recurringNetIncome)} · ${fmtEur(pl.ebitda)}`}
        icon={<TrendingUp className="size-4" />}
        trend={TREND[ebitdaSt]}
        accentColor={COLOR[ebitdaSt]}
      />

      {/* ── CASH DISPONIBLE (NCF €) ───────────────────────────────────── */}
      <KpiCard
        title="Cash disponible"
        value={fmtEur(pl.netCashFlow)}
        sub={pl.netCashFlow >= 0 ? "Net Cash Flow positif ✓" : "Net Cash Flow négatif ✗"}
        icon={<Wallet className="size-4" />}
        trend={TREND[ncfSt]}
        accentColor={COLOR[ncfSt]}
      />

      {/* ── DEBT SERVICE RATIO ────────────────────────────────────────── */}
      <KpiCard
        title="Debt Service"
        value={fmtPct(dsPct)}
        sub={`cible < 25% · base rée. ${fmtEur(recurringNetIncome)} · ${fmtEur(pl.debtService)} / mois`}
        icon={<CreditCard className="size-4" />}
        trend={TREND[dsSt]}
        accentColor={COLOR[dsSt]}
      />

      {/* ── TAUX D'ÉPARGNE ────────────────────────────────────────────── */}
      <KpiCard
        title="Taux d'épargne"
        value={fmtPct(savPct)}
        sub="cible > 15% · (CAPEX + NCF) / rev. nets récurrents"
        icon={<PiggyBank className="size-4" />}
        trend={TREND[savSt]}
        accentColor={COLOR[savSt]}
      />

      {/* ── PATRIMOINE TOTAL ──────────────────────────────────────────── */}
      {wealthTotal !== undefined && (
        <KpiCard
          title="Patrimoine"
          value={fmtEur(wealthTotal)}
          sub="Snapshot le plus récent"
          icon={<Landmark className="size-4" />}
          trend="neutral"
        />
      )}
    </div>
  )
}
