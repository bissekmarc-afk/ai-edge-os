import { CheckSquare, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SectionHeading } from "@/components/shared/section-heading"
import type { Task, Priority } from "@/types"

interface TodayFocusProps {
  tasks: Task[]
}

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  urgent: { label: "Urgent", variant: "destructive" },
  high: { label: "Haute", variant: "default" },
  medium: { label: "Moyenne", variant: "secondary" },
  low: { label: "Basse", variant: "outline" },
}

export function TodayFocus({ tasks }: TodayFocusProps) {
  return (
    <div className="space-y-3">
      <SectionHeading
        title="Focus du jour"
        description={`${tasks.length} tâche${tasks.length > 1 ? "s" : ""} prioritaire${tasks.length > 1 ? "s" : ""} aujourd’hui`}
      />
      <Card className="bg-[var(--panel-background)]">
        <CardContent className="divide-y divide-border pt-2">
          {tasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune tâche pour aujourd&apos;hui 🎉
            </p>
          ) : (
            tasks.map((task) => {
              const priority = PRIORITY_CONFIG[task.priority]
              return (
                <div key={task.id} className="flex items-start gap-3 py-3">
                  <CheckSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {task.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {task.projectName}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {task.dueDate && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {new Intl.DateTimeFormat("fr-FR", {
                          day: "numeric",
                          month: "short",
                        }).format(new Date(task.dueDate))}
                      </span>
                    )}
                    <Badge variant={priority.variant}>{priority.label}</Badge>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
