import { XCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PLMonth } from "@/lib/finance/types"

// ─── Alert model ──────────────────────────────────────────────────────────────

interface Alert {
  level:   "critical" | "warning" | "info"
  message: string
}

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

export function buildAlerts(pl: PLMonth): Alert[] {
  const alerts: Alert[] = []

  if (pl.ebitda < 0) {
    alerts.push({
      level: "critical",
      message: `EBITDA négatif : ${EUR.format(pl.ebitda)}`,
    })
  }

  if (pl.netCashFlow < 0) {
    alerts.push({
      level: "critical",
      message: `Net Cash Flow négatif : ${EUR.format(pl.netCashFlow)}`,
    })
  }

  if (pl.debtServiceRatio > 0.25) {
    alerts.push({
      level: "warning",
      message: `Debt Service élevé : ${(pl.debtServiceRatio * 100).toFixed(1)}% des revenus nets (seuil : 25 %)`,
    })
  }

  if (pl.unmappedCategories.length > 0) {
    const n = pl.unmappedCategories.length
    alerts.push({
      level: "info",
      message: `${n} catégorie${n > 1 ? "s" : ""} non mappée${n > 1 ? "s" : ""} : ${pl.unmappedCategories.join(", ")}`,
    })
  }

  return alerts
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FinanceAlertsProps {
  pl: PLMonth
}

export function FinanceAlerts({ pl }: FinanceAlertsProps) {
  const alerts = buildAlerts(pl)
  if (alerts.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm",
            alert.level === "critical" &&
              "border-[var(--danger)]/25 bg-[var(--danger)]/8 text-[var(--danger)]",
            alert.level === "warning" &&
              "border-[var(--warning)]/25 bg-[var(--warning)]/8 text-[var(--warning)]",
            alert.level === "info" &&
              "border-border bg-muted/60 text-muted-foreground",
          )}
        >
          {alert.level === "critical" && <XCircle       className="mt-0.5 size-4 shrink-0" />}
          {alert.level === "warning"  && <AlertTriangle  className="mt-0.5 size-4 shrink-0" />}
          {alert.level === "info"     && <Info           className="mt-0.5 size-4 shrink-0" />}
          <span>{alert.message}</span>
        </div>
      ))}
    </div>
  )
}
