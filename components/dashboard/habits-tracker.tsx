import { Flame, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { SectionHeading } from "@/components/shared/section-heading"
import { cn } from "@/lib/utils"
import type { Habit } from "@/types"

interface HabitsTrackerProps {
  habits: Habit[]
}

export function HabitsTracker({ habits }: HabitsTrackerProps) {
  const completedCount = habits.filter((h) => h.completed).length

  return (
    <div className="space-y-3">
      <SectionHeading
        title="Habitudes"
        description={`${completedCount}/${habits.length} complétées aujourd'hui`}
      />
      <Card className="bg-[var(--panel-background)]">
        <CardContent className="divide-y divide-border pt-2">
          {habits.map((habit) => (
            <div key={habit.id} className="flex items-center gap-3 py-3">
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  habit.completed
                    ? "border-[var(--habit-complete)] bg-[var(--habit-complete)]"
                    : "border-[var(--habit-pending)] bg-transparent"
                )}
              >
                {habit.completed && (
                  <Check className="size-3 text-white" strokeWidth={3} />
                )}
              </div>

              <div className="flex flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "text-sm font-medium",
                    habit.completed
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  )}
                >
                  {habit.title}
                </span>
                <span className="text-xs capitalize text-muted-foreground">
                  {habit.frequency === "daily"
                    ? "Quotidien"
                    : habit.frequency === "weekly"
                    ? "Hebdomadaire"
                    : "Personnalisé"}
                </span>
              </div>

              {habit.streak > 0 && (
                <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--habit-streak)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--habit-streak)]">
                  <Flame className="size-3" />
                  {habit.streak}j
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
