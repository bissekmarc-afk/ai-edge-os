import { createSupabaseServerClient } from "@/lib/supabase/server"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskRow {
  id: string
  user_id: string
  title: string
  project_name: string | null
  priority: string
  due_date: string | null
  url: string | null
  is_completed: boolean
  synced_at: string
}

export type CompletedFilter = "all" | "active" | "completed"

export const PAGE_SIZE = 50

// ─── Sorting helpers ──────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export function sortByPriorityThenDate(tasks: TaskRow[]): TaskRow[] {
  return [...tasks].sort((a, b) => {
    const pd = (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4)
    if (pd !== 0) return pd
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  })
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function utcDateString(offsetDays = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

const SELECTED_COLS =
  "id,user_id,title,project_name,priority,due_date,url,is_completed,synced_at"

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Today: due_date <= today AND is_completed = false, sorted by priority then date. */
export async function getTodayTasks(): Promise<TaskRow[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const today = utcDateString(0)

  const { data, error } = await supabase
    .from("tasks_sync")
    .select(SELECTED_COLS)
    .eq("is_completed", false)
    .lte("due_date", today)
    .order("due_date", { ascending: true, nullsFirst: false })

  if (error || !data) return []
  return sortByPriorityThenDate(data as TaskRow[])
}

/** This Week: due_date BETWEEN tomorrow AND J+7, is_completed = false. */
export async function getWeekTasks(): Promise<TaskRow[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const tomorrow = utcDateString(1)
  const nextWeek = utcDateString(7)

  const { data, error } = await supabase
    .from("tasks_sync")
    .select(SELECTED_COLS)
    .eq("is_completed", false)
    .gte("due_date", tomorrow)
    .lte("due_date", nextWeek)
    .order("due_date", { ascending: true, nullsFirst: false })

  if (error || !data) return []
  return data as TaskRow[]
}

/** All Tasks: with optional search, filters, and pagination. */
export async function getAllTasks(opts: {
  q?: string
  project?: string
  priority?: string
  completed?: CompletedFilter
  page?: number
}): Promise<{ tasks: TaskRow[]; total: number }> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return { tasks: [], total: 0 }

  const page = Math.max(1, opts.page ?? 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from("tasks_sync")
    .select(SELECTED_COLS, { count: "exact" })

  if (opts.q?.trim()) {
    query = query.ilike("title", `%${opts.q.trim()}%`)
  }
  if (opts.project) {
    query = query.eq("project_name", opts.project)
  }
  if (opts.priority) {
    query = query.eq("priority", opts.priority)
  }
  if (opts.completed === "active") {
    query = query.eq("is_completed", false)
  } else if (opts.completed === "completed") {
    query = query.eq("is_completed", true)
  }

  const { data, error, count } = await query
    .order("due_date", { ascending: true, nullsFirst: false })
    .range(from, to)

  if (error || !data) return { tasks: [], total: 0 }
  return { tasks: data as TaskRow[], total: count ?? 0 }
}

/** Inbox: no due date, not completed, project is null or "Inbox". */
export async function getInboxTasks(): Promise<TaskRow[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("tasks_sync")
    .select(SELECTED_COLS)
    .eq("is_completed", false)
    .is("due_date", null)
    .or("project_name.is.null,project_name.eq.Inbox")
    .order("synced_at", { ascending: false })

  if (error || !data) return []
  return sortByPriorityThenDate(data as TaskRow[])
}

/** Global counters — not affected by filters. */
export async function getTaskCounts(): Promise<{
  today: number
  week: number
  inbox: number
  all: number
}> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return { today: 0, week: 0, inbox: 0, all: 0 }

  const today = utcDateString(0)
  const tomorrow = utcDateString(1)
  const nextWeek = utcDateString(7)

  const [todayRes, weekRes, inboxRes, allRes] = await Promise.all([
    supabase
      .from("tasks_sync")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false)
      .lte("due_date", today),
    supabase
      .from("tasks_sync")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false)
      .gte("due_date", tomorrow)
      .lte("due_date", nextWeek),
    supabase
      .from("tasks_sync")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false)
      .is("due_date", null)
      .or("project_name.is.null,project_name.eq.Inbox"),
    supabase
      .from("tasks_sync")
      .select("id", { count: "exact", head: true }),
  ])

  return {
    today: todayRes.count ?? 0,
    week: weekRes.count ?? 0,
    inbox: inboxRes.count ?? 0,
    all: allRes.count ?? 0,
  }
}

/** Distinct project names for the filter dropdown (excludes null and "Inbox"). */
export async function getDistinctProjects(): Promise<string[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("tasks_sync")
    .select("project_name")
    .not("project_name", "is", null)
    .neq("project_name", "Inbox")
    .limit(500)

  if (error || !data) return []

  const unique = [...new Set(data.map((r) => r.project_name as string))]
  return unique.sort()
}
