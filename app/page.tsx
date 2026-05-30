import { CheckSquare, DollarSign } from "lucide-react"
import { CommandCenterHeader } from "@/components/dashboard/command-center-header"
import { AIDailyBrief } from "@/components/dashboard/ai-daily-brief"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { TodayFocus } from "@/components/dashboard/today-focus"
import { getTasksFromSupabase } from "@/lib/queries/tasks"
import { getBudgetSummaryFromSupabase } from "@/lib/queries/finance"

const MONTHS_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
]

export default async function CommandCenterPage() {
  const [tasks, budget] = await Promise.all([
    getTasksFromSupabase(5),
    getBudgetSummaryFromSupabase(),
  ])

  const formatEur = (n: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n)

  const urgentOrHigh = tasks.filter(
    (t) => t.priority === "urgent" || t.priority === "high",
  ).length

  const budgetMonthLabel = budget
    ? `Budget ${MONTHS_FR[budget.month - 1]} ${budget.year}`
    : "Budget du mois"

  return (
    <div className="flex flex-col gap-6">
      <CommandCenterHeader />

      <AIDailyBrief />

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Vue d&apos;ensemble</h2>
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            title="Tâches actives"
            value={tasks.length > 0 ? String(tasks.length) : "—"}
            sub={
              tasks.length === 0
                ? "Données non disponibles"
                : urgentOrHigh > 0
                  ? `${urgentOrHigh} haute priorité`
                  : "Toutes en cours"
            }
            icon={<CheckSquare className="size-4" />}
            trend="neutral"
          />
          <KpiCard
            title={budgetMonthLabel}
            value={budget ? formatEur(budget.balance) : "—"}
            sub={
              budget
                ? `Dépenses : ${formatEur(budget.expenses)}`
                : "Données non disponibles"
            }
            icon={<DollarSign className="size-4" />}
            trend={
              budget
                ? budget.balance >= 0
                  ? "up"
                  : "down"
                : "neutral"
            }
          />
        </div>
      </section>

      <TodayFocus tasks={tasks} />
    </div>
  )
}
