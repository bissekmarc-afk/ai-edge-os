"use client"

import { useTransition } from "react"
import { Circle, CheckCircle2, Loader2 } from "lucide-react"
import { completeTask } from "@/app/(dashboard)/tasks/actions"
import { cn } from "@/lib/utils"

interface TaskCompleteCheckboxProps {
  taskId: string
  completed: boolean
}

export function TaskCompleteCheckbox({ taskId, completed }: TaskCompleteCheckboxProps) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (completed || isPending) return
    startTransition(() => completeTask(taskId))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={completed || isPending}
      aria-label={completed ? "Tâche terminée" : "Marquer comme terminée"}
      className={cn(
        "flex shrink-0 items-center justify-center transition-colors",
        completed
          ? "text-emerald-500 cursor-default"
          : "text-muted-foreground hover:text-foreground",
        isPending && "opacity-50"
      )}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : completed ? (
        <CheckCircle2 className="size-4" />
      ) : (
        <Circle className="size-4" />
      )}
    </button>
  )
}
