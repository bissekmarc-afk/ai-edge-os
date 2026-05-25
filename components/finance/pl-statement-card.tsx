import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { PLResult } from "@/lib/finance/aggregations"

// ─── Formatters ───────────────────────────────────────────────────────────────

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

function fmtEur(n: number): string    { return EUR.format(n) }
function fmtSigned(n: number): string { return `${n >= 0 ? "+" : ""}${fmtEur(n)}` }

// ─── Rate status & badge ─────────────────────────────────────────────────────
//
// Targets (% of gross income unless noted):
//   Taxes       < 30%     expense max
//   Fixes       < 35%     expense max
//   Variables   < 15%     expense max
//   One-off     < 10%     expense max
//   Debt Svc    < 22%     expense max
//   EBITDA      > 10%     surplus min
//   CAPEX       >  5%     surplus min
//   NCF         >  5%     surplus min
//
// Color thresholds:
//   expense: warn  when value > max × 0.8
//            danger when value > max
//   surplus: warn  when value < min
//            danger when value < min × 0.8

type RateStatus = "ok" | "warn" | "danger"

function expenseStatus(pct: number, max: number): RateStatus {
  if (pct > max)          return "danger"
  if (pct > max * 0.8)    return "warn"
  return "ok"
}

function surplusStatus(pct: number, min: number): RateStatus {
  if (pct < min * 0.8)    return "danger"
  if (pct < min)          return "warn"
  return "ok"
}

const RATE_CLS: Record<RateStatus, string> = {
  ok:     "bg-[var(--success)]/10 text-[var(--success)]",
  warn:   "bg-[var(--warning)]/10 text-[var(--warning)]",
  danger: "bg-[var(--danger)]/10 text-[var(--danger)]",
}

function RateBadge({
  pct,
  target,
  status,
}: {
  pct:    number
  target: string
  status: RateStatus
}) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        RATE_CLS[status],
      )}
    >
      {pct.toFixed(1)}%{" "}
      <span className="opacity-60">({target})</span>
    </span>
  )
}

// ─── Row sub-components ───────────────────────────────────────────────────────

interface LineRowProps {
  label:      string
  amount:     number
  isRevenue?: boolean
  indent?:    boolean
  muted?:     boolean
  badge?:     ReactNode
}

function LineRow({
  label,
  amount,
  isRevenue = false,
  indent    = false,
  muted     = false,
  badge,
}: LineRowProps) {
  return (
    <div className={cn("flex items-center justify-between px-4 py-1.5 text-sm", indent && "pl-8")}>
      <span className={cn(muted ? "text-muted-foreground" : "text-foreground")}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        {badge}
        <span
          className={cn(
            "tabular-nums font-mono text-xs",
            isRevenue
              ? amount >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
              : amount === 0 ? "text-muted-foreground" : "text-[var(--danger)]",
          )}
        >
          {isRevenue ? fmtSigned(amount) : fmtEur(-amount)}
        </span>
      </div>
    </div>
  )
}

function SubtotalRow({
  label,
  amount,
  badge,
  highlight,
}: {
  label:      string
  amount:     number
  badge?:     ReactNode
  highlight?: "success" | "danger"
}) {
  const color =
    highlight === "success" ? "bg-[var(--success)]/8 text-[var(--success)]"
    : highlight === "danger" ? "bg-[var(--danger)]/8 text-[var(--danger)]"
    : "bg-muted/60 text-foreground"

  return (
    <div className={cn("flex items-center justify-between px-4 py-2 text-sm font-semibold", color)}>
      <span>{label}</span>
      <div className="flex items-center gap-3">
        {badge}
        <span className="tabular-nums font-mono">{fmtSigned(amount)}</span>
      </div>
    </div>
  )
}

function Separator() {
  return <div className="mx-4 h-px bg-border" />
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PLStatementCardProps {
  pl: PLResult
}

export function PLStatementCard({ pl }: PLStatementCardProps) {
  const g = pl.grossIncome

  /** Percentage of a section vs gross income */
  function rate(n: number): number { return g > 0 ? (n / g) * 100 : 0 }

  /** Build a RateBadge only when we have income to compare against */
  function badge(pct: number, target: string, status: RateStatus): ReactNode {
    return g > 0 ? <RateBadge pct={pct} target={target} status={status} /> : undefined
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="border-b border-border bg-muted/40 px-4 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          P&amp;L Statement — Family Office
        </p>
      </div>

      <div className="divide-y divide-border/30">

        {/* ── Income sub-lines ──────────────────────────────────────────── */}
        <LineRow
          label="Revenus Récurrents"
          amount={pl.recurringIncome}
          isRevenue
          indent
          muted
        />
        {pl.nonRecurringIncome > 0 && (
          <LineRow
            label="Revenus Non-récurrents"
            amount={pl.nonRecurringIncome}
            isRevenue
            indent
            muted
          />
        )}

        {/* ── TOTAL REVENUS BRUTS ────────────────────────────────────────── */}
        <SubtotalRow
          label="= TOTAL REVENUS BRUTS"
          amount={pl.grossIncome}
          highlight={pl.grossIncome > 0 ? "success" : undefined}
        />

        {/* ── TAXES ─────────────────────────────────────────────────────── */}
        {pl.taxes > 0 && (
          <LineRow
            label="Impôts & Taxes"
            amount={pl.taxes}
            indent muted
            badge={badge(rate(pl.taxes), "< 30%", expenseStatus(rate(pl.taxes), 30))}
          />
        )}

        <Separator />

        {/* ── REVENUS NETS ──────────────────────────────────────────────── */}
        <SubtotalRow
          label="REVENUS NETS"
          amount={pl.netIncome}
          highlight={pl.netIncome >= 0 ? "success" : "danger"}
        />

        {/* ── COÛTS FIXES ───────────────────────────────────────────────── */}
        {pl.fixedCosts > 0 && (
          <LineRow
            label="Coûts fixes"
            amount={pl.fixedCosts}
            indent muted
            badge={badge(rate(pl.fixedCosts), "< 35%", expenseStatus(rate(pl.fixedCosts), 35))}
          />
        )}

        {/* ── COÛTS VARIABLES ───────────────────────────────────────────── */}
        {pl.variableCosts > 0 && (
          <LineRow
            label="Coûts variables"
            amount={pl.variableCosts}
            indent muted
            badge={badge(rate(pl.variableCosts), "< 15%", expenseStatus(rate(pl.variableCosts), 15))}
          />
        )}

        {/* ── ONE-OFF ───────────────────────────────────────────────────── */}
        {pl.oneOff > 0 && (
          <LineRow
            label="Dépenses one-off"
            amount={pl.oneOff}
            indent muted
            badge={badge(rate(pl.oneOff), "< 10%", expenseStatus(rate(pl.oneOff), 10))}
          />
        )}

        {/* ── DEBT SERVICE ──────────────────────────────────────────────── */}
        {pl.debtService > 0 && (
          <LineRow
            label="Debt Service"
            amount={pl.debtService}
            indent muted
            badge={badge(rate(pl.debtService), "< 22%", expenseStatus(rate(pl.debtService), 22))}
          />
        )}

        <Separator />

        {/* ── EBITDA ────────────────────────────────────────────────────── */}
        <SubtotalRow
          label="EBITDA"
          amount={pl.ebitda}
          badge={badge(
            (pl.ebitdaRate ?? 0) * 100,
            "> 10%",
            surplusStatus((pl.ebitdaRate ?? 0) * 100, 10),
          )}
          highlight={pl.ebitda >= 0 ? "success" : "danger"}
        />

        {/* ── CAPEX ─────────────────────────────────────────────────────── */}
        {pl.capex > 0 && (
          <LineRow
            label="CAPEX & Investissements"
            amount={pl.capex}
            indent muted
            badge={badge(rate(pl.capex), "> 5%", surplusStatus(rate(pl.capex), 5))}
          />
        )}

        <Separator />

        {/* ── NET CASH FLOW ─────────────────────────────────────────────── */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3 font-bold text-sm",
            pl.netCashFlow >= 0 ? "bg-[var(--success)]/12" : "bg-[var(--danger)]/12",
          )}
        >
          <span>NET CASH FLOW</span>
          <div className="flex items-center gap-2">
            {g > 0 && (
              <RateBadge
                pct={rate(pl.netCashFlow)}
                target="> 5%"
                status={surplusStatus(rate(pl.netCashFlow), 5)}
              />
            )}
            <span
              className={cn(
                "tabular-nums font-mono",
                pl.netCashFlow >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]",
              )}
            >
              {fmtSigned(pl.netCashFlow)}
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
