import { cn } from "@/lib/utils"
import type { PLMonth } from "@/lib/finance/types"

// ─── Formatters ───────────────────────────────────────────────────────────────

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

function fmtEur(n: number): string {
  return EUR.format(n)
}

function fmtSigned(n: number): string {
  return `${n >= 0 ? "+" : ""}${fmtEur(n)}`
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface LineRowProps {
  label:   string
  amount:  number
  /** When true the amount is displayed as-is (positive = green) */
  isRevenue?: boolean
  indent?: boolean
  muted?:  boolean
}

function LineRow({ label, amount, isRevenue = false, indent = false, muted = false }: LineRowProps) {
  const positive = isRevenue ? amount >= 0 : amount <= 0   // expenses shown in red when positive
  return (
    <div className={cn("flex items-center justify-between px-4 py-1.5 text-sm", indent && "pl-8")}>
      <span className={cn(muted ? "text-muted-foreground" : "text-foreground")}>{label}</span>
      <span className={cn(
        "tabular-nums font-mono text-xs",
        isRevenue
          ? amount >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
          : amount === 0 ? "text-muted-foreground" : "text-[var(--danger)]",
      )}>
        {isRevenue ? fmtSigned(amount) : fmtEur(-amount)}
      </span>
    </div>
  )
}

function SubtotalRow({
  label,
  amount,
  rate,
  highlight,
}: {
  label:      string
  amount:     number
  rate?:      string
  highlight?: "success" | "danger"
}) {
  const color = highlight === "success"
    ? "bg-[var(--success)]/8 text-[var(--success)]"
    : highlight === "danger"
    ? "bg-[var(--danger)]/8 text-[var(--danger)]"
    : "bg-muted/60 text-foreground"

  return (
    <div className={cn("flex items-center justify-between px-4 py-2 text-sm font-semibold", color)}>
      <span>{label}</span>
      <div className="flex items-center gap-3">
        {rate !== undefined && (
          <span className="text-xs font-medium opacity-70">{rate}</span>
        )}
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
  pl: PLMonth
}

export function PLStatementCard({ pl }: PLStatementCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="border-b border-border bg-muted/40 px-4 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          P&amp;L Statement — Family Office
        </p>
      </div>

      <div className="divide-y divide-border/30">
        {/* ── REVENUS BRUTS ─────────────────────────────────────────────── */}
        <SubtotalRow
          label="REVENUS BRUTS"
          amount={pl.grossIncome}
          highlight={pl.grossIncome > 0 ? "success" : undefined}
        />

        {/* ── TAXES ─────────────────────────────────────────────────────── */}
        {pl.taxes > 0 && (
          <LineRow label="Impôts & Taxes" amount={pl.taxes} indent muted />
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
          <LineRow label="Coûts fixes" amount={pl.fixedCosts} indent muted />
        )}

        {/* ── COÛTS VARIABLES ───────────────────────────────────────────── */}
        {pl.variableCosts > 0 && (
          <LineRow label="Coûts variables" amount={pl.variableCosts} indent muted />
        )}

        {/* ── ONE-OFF ───────────────────────────────────────────────────── */}
        {pl.oneOff > 0 && (
          <LineRow label="Dépenses one-off" amount={pl.oneOff} indent muted />
        )}

        {/* ── DEBT SERVICE ──────────────────────────────────────────────── */}
        {pl.debtService > 0 && (
          <LineRow label="Debt Service" amount={pl.debtService} indent muted />
        )}

        <Separator />

        {/* ── EBITDA ────────────────────────────────────────────────────── */}
        <SubtotalRow
          label="EBITDA"
          amount={pl.ebitda}
          rate={fmtPct(pl.ebitdaRate)}
          highlight={pl.ebitda >= 0 ? "success" : "danger"}
        />

        {/* ── CAPEX ─────────────────────────────────────────────────────── */}
        {pl.capex > 0 && (
          <LineRow label="CAPEX & Investissements" amount={pl.capex} indent muted />
        )}

        <Separator />

        {/* ── NET CASH FLOW ─────────────────────────────────────────────── */}
        <div className={cn(
          "flex items-center justify-between px-4 py-3 font-bold text-sm",
          pl.netCashFlow >= 0 ? "bg-[var(--success)]/12" : "bg-[var(--danger)]/12",
        )}>
          <span>NET CASH FLOW</span>
          <span className={cn(
            "tabular-nums font-mono",
            pl.netCashFlow >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]",
          )}>
            {fmtSigned(pl.netCashFlow)}
          </span>
        </div>
      </div>
    </div>
  )
}
