import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { TaskCompleteCheckbox } from "./task-complete-checkbox"
import type { TaskRow } from "@/lib/queries/tasks-page"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  urgent: { label: "Urgent",  className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  high:   { label: "Haute",   className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  medium: { label: "Moyenne", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" },
  low:    { label: "Basse",   className: "bg-muted text-muted-foreground" },
}

function formatDueDate(dateStr: string): string {
  const today = TODAY
  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  if (dateStr === today) return "Aujourd'hui"
  if (dateStr === tomorrowStr) return "Demain"

  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: TaskRow
  showProject?: boolean
}

export function TaskCard({ task, showProject = true }: TaskCardProps) {
  const isOverdue = !task.is_completed && task.due_date !== null && task.due_date < TODAY
  const priority = PRIORITY_CONFIG[task.priority]

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-[var(--panel-border)]">
      <div className="mt-0.5">
        <TaskCompleteCheckbox taskId={task.id} completed={task.is_completed} />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-snug",
            task.is_completed
              ? "line-through text-muted-foreground"
              : "text-foreground"
          )}
        >
          {task.title}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {showProject && task.project_name && task.project_name !== "Inbox" && (
            <span className="text-xs text-muted-foreground">
              {task.project_name}
            </span>
          )}

          {priority && (
            <span
              className={cn(
                "inline-flex h-4 items-center rounded-full px-1.5 text-[10px] font-medium",
                priority.className
              )}
            >
              {priority.label}
            </span>
          )}

          {task.due_date && (
            <span
              className={cn(
                "text-xs",
                isOverdue
                  ? "font-medium text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
              )}
            >
              {isOverdue ? "En retard · " : ""}
              {formatDueDate(task.due_date)}
            </span>
          )}
        </div>
      </div>

      {task.url && (
        <a
          href={task.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ouvrir dans Todoist"
          className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  )
}
