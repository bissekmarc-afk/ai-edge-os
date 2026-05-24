import { Suspense } from "react"
import { AlertCircle } from "lucide-react"
import {
  getTodayTasks,
  getWeekTasks,
  getAllTasks,
  getInboxTasks,
  getTaskCounts,
  getDistinctProjects,
  PAGE_SIZE,
  type TaskRow,
  type CompletedFilter,
} from "@/lib/queries/tasks-page"
import { SectionHeading } from "@/components/shared/section-heading"
import { TaskCard } from "@/components/tasks/task-card"
import { TaskListSkeleton } from "@/components/tasks/task-list-skeleton"
import { TaskViewTabs } from "@/components/tasks/task-view-tabs"
import { TaskSearch } from "@/components/tasks/task-search"
import { TaskFilters } from "@/components/tasks/task-filters"
import { TaskPagination } from "@/components/tasks/task-pagination"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_VIEWS = ["today", "week", "all", "inbox"] as const
type View = (typeof VALID_VIEWS)[number]

function projectColorHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 360
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center">
      <p className="text-sm font-medium text-foreground">Aucune tâche</p>
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>Erreur de chargement</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

// ─── View: Today ──────────────────────────────────────────────────────────────

async function TodayViewContent() {
  let tasks: TaskRow[]
  try {
    tasks = await getTodayTasks()
  } catch {
    return <ErrorState message="Impossible de charger les tâches du jour." />
  }

  if (tasks.length === 0) {
    return <EmptyState message="Aucune tâche due aujourd'hui. Profites-en ! 🎉" />
  }

  const today = new Date().toISOString().slice(0, 10)
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today)
  const dueToday = tasks.filter((t) => t.due_date === today)

  return (
    <div className="flex flex-col gap-4">
      {overdue.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-red-600 dark:text-red-400">
            En retard · {overdue.length}
          </p>
          <div className="flex flex-col gap-2">
            {overdue.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        </section>
      )}
      {dueToday.length > 0 && (
        <section>
          {overdue.length > 0 && (
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Aujourd'hui · {dueToday.length}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {dueToday.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── View: This Week ──────────────────────────────────────────────────────────

async function WeekViewContent() {
  let tasks: TaskRow[]
  try {
    tasks = await getWeekTasks()
  } catch {
    return <ErrorState message="Impossible de charger les tâches de la semaine." />
  }

  if (tasks.length === 0) {
    return <EmptyState message="Aucune tâche cette semaine. Belle semaine en vue ! ✨" />
  }

  const groups = tasks.reduce<Record<string, TaskRow[]>>((acc, t) => {
    const key = t.project_name ?? "Inbox"
    ;(acc[key] ??= []).push(t)
    return acc
  }, {})

  const sortedProjects = Object.keys(groups).sort()

  return (
    <div className="flex flex-col gap-6">
      {sortedProjects.map((projectName) => {
        const hue = projectColorHue(projectName)
        return (
          <section key={projectName}>
            <div className="mb-2 flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: `hsl(${hue}, 65%, 55%)` }}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-foreground">
                {projectName}
              </span>
              <span className="text-xs text-muted-foreground">
                {groups[projectName].length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {groups[projectName].map((t) => (
                <TaskCard key={t.id} task={t} showProject={false} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ─── View: All Tasks ──────────────────────────────────────────────────────────

async function AllTasksContent({
  q,
  project,
  priority,
  completed,
  page,
}: {
  q: string
  project: string
  priority: string
  completed: CompletedFilter
  page: number
}) {
  let result: { tasks: TaskRow[]; total: number }
  try {
    result = await getAllTasks({ q, project, priority, completed, page })
  } catch {
    return <ErrorState message="Impossible de charger les tâches." />
  }

  const { tasks, total } = result
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (tasks.length === 0) {
    return (
      <EmptyState
        message={
          q || project || priority || completed !== "all"
            ? "Aucune tâche ne correspond aux filtres."
            : "Aucune tâche trouvée."
        }
      />
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </div>
      <TaskPagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
      />
    </>
  )
}

// ─── View: Inbox ──────────────────────────────────────────────────────────────

async function InboxViewContent() {
  let tasks: TaskRow[]
  try {
    tasks = await getInboxTasks()
  } catch {
    return <ErrorState message="Impossible de charger l'inbox." />
  }

  if (tasks.length === 0) {
    return (
      <EmptyState message="L'inbox est vide. Toutes les tâches ont une date ou un projet." />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} showProject={false} />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams

  const view: View = VALID_VIEWS.includes(params.view as View)
    ? (params.view as View)
    : "today"
  const q = typeof params.q === "string" ? params.q : ""
  const project = typeof params.project === "string" ? params.project : ""
  const priority = typeof params.priority === "string" ? params.priority : ""
  const completedParam = params.completed as string
  const completed: CompletedFilter =
    completedParam === "active" || completedParam === "completed"
      ? completedParam
      : "all"
  const page = Math.max(1, parseInt((params.page as string) ?? "1") || 1)

  // Counts are global (not affected by filters) — fetched in parallel with projects
  const [counts, projects] = await Promise.all([
    getTaskCounts(),
    getDistinctProjects(),
  ])

  // Key changes on any filter/page change → Suspense shows skeleton on refetch
  const viewKey =
    view === "all"
      ? `all-${q}-${project}-${priority}-${completed}-${page}`
      : view

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Tâches"
        description="Synchronisées depuis Todoist"
      />

      <TaskViewTabs currentView={view} counts={counts} />

      {/* Toolbar is outside Suspense: search & filters are immediately interactive */}
      {view === "all" && (
        <div className="flex flex-wrap items-center gap-2">
          <TaskSearch initialValue={q} />
          <TaskFilters
            projects={projects}
            currentProject={project}
            currentPriority={priority}
            currentCompleted={completed}
          />
        </div>
      )}

      <Suspense
        key={viewKey}
        fallback={<TaskListSkeleton count={view === "today" ? 5 : 8} />}
      >
        {view === "today" && <TodayViewContent />}
        {view === "week" && <WeekViewContent />}
        {view === "all" && (
          <AllTasksContent
            q={q}
            project={project}
            priority={priority}
            completed={completed}
            page={page}
          />
        )}
        {view === "inbox" && <InboxViewContent />}
      </Suspense>
    </div>
  )
}
