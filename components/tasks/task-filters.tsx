"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import type { CompletedFilter } from "@/lib/queries/tasks-page"

interface TaskFiltersProps {
  projects: string[]
  currentProject: string
  currentPriority: string
  currentCompleted: CompletedFilter
}

const PRIORITY_OPTIONS = [
  { value: "",       label: "Toutes priorités" },
  { value: "urgent", label: "Urgent" },
  { value: "high",   label: "Haute" },
  { value: "medium", label: "Moyenne" },
  { value: "low",    label: "Basse" },
]

const COMPLETED_OPTIONS: { value: CompletedFilter; label: string }[] = [
  { value: "all",       label: "Actives + terminées" },
  { value: "active",    label: "Actives seulement" },
  { value: "completed", label: "Terminées seulement" },
]

const selectCls = cn(
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
  "text-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:opacity-50 dark:bg-input/30"
)

export function TaskFilters({
  projects,
  currentProject,
  currentPriority,
  currentCompleted,
}: TaskFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`)
  }

  const hasActiveFilters =
    Boolean(currentProject) ||
    Boolean(currentPriority) ||
    currentCompleted !== "all"

  function resetFilters() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("project")
    params.delete("priority")
    params.delete("completed")
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Priority */}
      <select
        value={currentPriority}
        onChange={(e) => updateParam("priority", e.target.value)}
        className={selectCls}
        aria-label="Filtrer par priorité"
      >
        {PRIORITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Project */}
      {projects.length > 0 && (
        <select
          value={currentProject}
          onChange={(e) => updateParam("project", e.target.value)}
          className={selectCls}
          aria-label="Filtrer par projet"
        >
          <option value="">Tous les projets</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      )}

      {/* Completed */}
      <select
        value={currentCompleted}
        onChange={(e) => updateParam("completed", e.target.value === "all" ? "" : e.target.value)}
        className={selectCls}
        aria-label="Filtrer par statut"
      >
        {COMPLETED_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="h-8 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Réinitialiser
        </button>
      )}
    </div>
  )
}
