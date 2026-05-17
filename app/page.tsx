import { CheckSquare, DollarSign, BookOpen, Dumbbell, Brain } from "lucide-react"
import { CommandCenterHeader } from "@/components/dashboard/command-center-header"
import { AIDailyBrief } from "@/components/dashboard/ai-daily-brief"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { TodayFocus } from "@/components/dashboard/today-focus"
import { LifeBlockCard } from "@/components/dashboard/life-block-card"
import { HabitsTracker } from "@/components/dashboard/habits-tracker"
import { SyncActivityFeed } from "@/components/dashboard/sync-activity-feed"
import {
  getTopTasks,
  getMonthlyBudgetSummary,
  getReadingSummary,
  getTrainingSummary,
  getMemorySummary,
  mockHabits,
  mockGymSessions,
  mockBoxingSessions,
  mockReadingItems,
  getSyncActivity,
} from "@/lib/mock-data"

export default function CommandCenterPage() {
  const topTasks = getTopTasks(5)
  const budget = getMonthlyBudgetSummary()
  const reading = getReadingSummary()
  const training = getTrainingSummary()
  const memory = getMemorySummary()
  const syncActivities = getSyncActivity()

  const formatEur = (n: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n)

  return (
    <div className="flex flex-col gap-6">
      <CommandCenterHeader />

      <AIDailyBrief />

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Vue d&apos;ensemble</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard
            title="Tâches actives"
            value={String(topTasks.length)}
            sub="5 prioritaires"
            icon={<CheckSquare className="size-4" />}
            trend="neutral"
          />
          <KpiCard
            title="Budget mai"
            value={formatEur(budget.balance)}
            sub={`Dépenses : ${formatEur(budget.expenses)}`}
            icon={<DollarSign className="size-4" />}
            trend="up"
          />
          <KpiCard
            title="Lecture"
            value={`${reading.reading} en cours`}
            sub={`${reading.completed} terminés`}
            icon={<BookOpen className="size-4" />}
            trend="up"
          />
          <KpiCard
            title="Entraînement"
            value={`${training.gymSessions + training.boxingSessions}`}
            sub={`${Math.round(training.totalMinutes / 60)}h ce mois`}
            icon={<Dumbbell className="size-4" />}
            trend="up"
          />
          <KpiCard
            title="Mémoire"
            value={`${memory.confirmed}/${memory.total}`}
            sub="entrées confirmées"
            icon={<Brain className="size-4" />}
            trend="neutral"
          />
        </div>
      </section>

      <TodayFocus tasks={topTasks} />

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Life Blocks</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <LifeBlockCard
            title="Lecture"
            icon={<BookOpen className="size-4 text-[var(--ai-accent)]" />}
            stats={[
              { label: "En cours", value: `${reading.reading} livre${reading.reading > 1 ? "s" : ""}` },
              { label: "Terminés", value: String(reading.completed) },
              { label: "Progression moy.", value: `${reading.avgProgress}%` },
              { label: "À lire", value: String(mockReadingItems.filter((r) => r.status === "to_read").length) },
            ]}
            progress={reading.avgProgress}
            progressLabel="Progression lecture en cours"
          />
          <LifeBlockCard
            title="Finance"
            icon={<DollarSign className="size-4 text-[var(--success)]" />}
            stats={[
              { label: "Revenus", value: formatEur(budget.income) },
              { label: "Dépenses", value: formatEur(budget.expenses) },
              { label: "Solde", value: formatEur(budget.balance) },
              { label: "Épargne", value: "20%" },
            ]}
            progress={Math.round((budget.expenses / budget.income) * 100)}
            progressLabel="Dépenses vs revenus"
          />
          <LifeBlockCard
            title="Gym & Boxe"
            icon={<Dumbbell className="size-4 text-[var(--warning)]" />}
            stats={[
              { label: "Séances gym", value: String(mockGymSessions.length) },
              { label: "Séances boxe", value: String(mockBoxingSessions.length) },
              { label: "Total", value: `${Math.round(training.totalMinutes / 60)}h` },
              { label: "Dernière", value: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(training.lastSession)) },
            ]}
            progress={training.gymSessions >= 3 ? 100 : Math.round((training.gymSessions / 3) * 100)}
            progressLabel="Objectif 3 séances gym/sem."
          />
        </div>
      </section>

      <HabitsTracker habits={mockHabits} />

      <SyncActivityFeed activities={syncActivities} />
    </div>
  )
}
