import { cn } from "@/lib/utils"
import { monthName } from "@/lib/finance/aggregations"
import type { BalanceSheet } from "@/lib/finance/types"

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function BilanRow({
  label,
  amount,
  bold = false,
  dimIfZero = false,
}: {
  label:      string
  amount:     number
  bold?:      boolean
  dimIfZero?: boolean
}) {
  const isEmpty = dimIfZero && amount === 0
  return (
    <div
      className={cn(
        "flex items-center justify-between text-sm",
        bold && "font-semibold",
        isEmpty && "opacity-40",
      )}
    >
      <span className={cn(bold ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      <span className="tabular-nums font-mono">
        {isEmpty ? "—" : fmtEur(amount)}
      </span>
    </div>
  )
}

// ─── Status helpers (mirrors pl-statement-card logic) ────────────────────────

type RateStatus = "ok" | "warn" | "danger"

const PILL_CLS: Record<RateStatus, string> = {
  ok:     "bg-[var(--success)]/10 text-[var(--success)]",
  warn:   "bg-[var(--warning)]/10 text-[var(--warning)]",
  danger: "bg-[var(--danger)]/10 text-[var(--danger)]",
}

function KpiBadge({
  label,
  value,
  note,
  status = "ok",
}: {
  label:   string
  value:   string
  note?:   string
  status?: RateStatus
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[120px]">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn("rounded px-2 py-1 text-sm font-semibold tabular-nums", PILL_CLS[status])}>
        {value}
        {note && (
          <span className="ml-1.5 text-[10px] font-normal opacity-60">{note}</span>
        )}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface BalanceSheetSectionProps {
  bs:                 BalanceSheet
  recurringNetIncome: number   // monthly — used for patrimoine/revenus ratio
}

export function BalanceSheetSection({
  bs,
  recurringNetIncome,
}: BalanceSheetSectionProps) {
  // ── Ratio Levier = Total Passif / Total Actif (target < 60%) ──────────────
  const leverPct = bs.assets.total > 0
    ? (bs.liabilities.total / bs.assets.total) * 100
    : 0
  const leverStatus: RateStatus =
    leverPct > 60 ? "danger" : leverPct > 48 ? "warn" : "ok"   // 80% of 60

  // ── Patrimoine Net / Revenus Récurrents Annuels ────────────────────────────
  const annualRecurring  = recurringNetIncome * 12
  const patrimoineRatio  = annualRecurring > 0
    ? bs.netWorth / annualRecurring
    : undefined

  const hasData = bs.assets.total > 0 || bs.liabilities.total > 0

  if (!hasData) return null

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-muted/40 px-4 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Bilan Patrimonial — {monthName(bs.month, bs.year)}
        </p>
      </div>

      {/* ── Actif / Passif grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 divide-x divide-border/40">

        {/* ACTIF */}
        <div className="flex flex-col gap-2 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Actif
          </p>
          <BilanRow label="Immobilier"    amount={bs.assets.immo}     dimIfZero />
          <BilanRow label="Actions"       amount={bs.assets.equities} dimIfZero />
          <BilanRow label="Art / Collec." amount={bs.assets.art}      dimIfZero />
          <BilanRow label="Épargne"       amount={bs.assets.savings}  dimIfZero />
          <div className="border-t border-border pt-2">
            <BilanRow label="Total Actif" amount={bs.assets.total} bold />
          </div>
        </div>

        {/* PASSIF */}
        <div className="flex flex-col gap-2 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Passif
          </p>
          {bs.liabilities.credits.length > 0 ? (
            bs.liabilities.credits.map((c, i) => (
              <BilanRow key={i} label={`Crédit ${i + 1}`} amount={c.amount} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground italic">Aucune dette</p>
          )}
          <div className="border-t border-border pt-2">
            <BilanRow label="Total Passif" amount={bs.liabilities.total} bold />
          </div>
        </div>

      </div>

      {/* ── Patrimoine Net ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center justify-between border-t border-border px-4 py-3 text-sm font-bold",
          bs.netWorth >= 0
            ? "bg-[var(--success)]/8 text-[var(--success)]"
            : "bg-[var(--danger)]/8 text-[var(--danger)]",
        )}
      >
        <span>PATRIMOINE NET</span>
        <span className="tabular-nums font-mono">{fmtEur(bs.netWorth)}</span>
      </div>

      {/* ── KPI badges ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-4 border-t border-border px-4 py-3">

        {/* Ratio Levier */}
        <KpiBadge
          label="Levier"
          value={`${leverPct.toFixed(1)}%`}
          note="cible < 60%"
          status={leverStatus}
        />

        {/* Patrimoine / Revenus annuels */}
        {patrimoineRatio !== undefined && (
          <KpiBadge
            label="Patrimoine / Rev. annuels"
            value={`${patrimoineRatio.toFixed(1)}×`}
            status="ok"
          />
        )}

        {/* Δ vs mois précédent */}
        {bs.netWorthDelta !== undefined && (
          <KpiBadge
            label="Δ vs mois préc."
            value={fmtSigned(bs.netWorthDelta)}
            status={bs.netWorthDelta >= 0 ? "ok" : "danger"}
          />
        )}

      </div>
    </div>
  )
}
