import { AlertTriangle, AlertCircle } from "lucide-react"
import type { FinanceAlert } from "@/lib/queries/finance-dashboard"

interface FinanceAlertsProps {
  alerts: FinanceAlert[]
}

export function FinanceAlerts({ alerts }: FinanceAlertsProps) {
  if (alerts.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={
            alert.type === "danger"
              ? "flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
              : "flex items-start gap-2.5 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-sm text-yellow-800 dark:border-yellow-900/40 dark:bg-yellow-950/40 dark:text-yellow-300"
          }
        >
          {alert.type === "danger" ? (
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{alert.message}</span>
        </div>
      ))}
    </div>
  )
}
