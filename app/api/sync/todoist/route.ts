import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Priority } from "@/types"

interface TodoistTask {
  id: string
  content: string
  priority: number
  due: { date: string } | null
  project_id: string
}

interface TodoistProject {
  id: string
  name: string
}

interface TodoistPagedResponse<T> {
  results: T[]
  next_cursor: string | null
}

function mapPriority(p: number): Priority {
  if (p === 4) return "urgent"
  if (p === 3) return "high"
  if (p === 2) return "medium"
  return "low"
}

async function fetchAllPages<T>(url: string, headers: Record<string, string>): Promise<T[]> {
  const all: T[] = []
  let cursor: string | null = null

  do {
    const target = cursor ? `${url}?cursor=${cursor}` : url
    const res = await fetch(target, { headers })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const page: TodoistPagedResponse<T> = await res.json()
    all.push(...page.results)
    cursor = page.next_cursor
  } while (cursor)

  return all
}

export async function POST() {
  const token = process.env.TODOIST_API_TOKEN
  if (!token || token === "your_todoist_api_token_here") {
    return NextResponse.json({ error: "TODOIST_API_TOKEN not configured" }, { status: 503 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch { /* read-only in Route Handler */ }
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const headers = { Authorization: `Bearer ${token}` }

  let tasks: TodoistTask[]
  let projects: TodoistProject[]

  try {
    ;[tasks, projects] = await Promise.all([
      fetchAllPages<TodoistTask>("https://api.todoist.com/api/v1/tasks", headers),
      fetchAllPages<TodoistProject>("https://api.todoist.com/api/v1/projects", headers),
    ])
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Todoist API error: ${message}` }, { status: 502 })
  }

  const projectMap = new Map(projects.map((p) => [p.id, p.name]))

  const rows = tasks.map((t) => ({
    user_id: user.id,
    source: "todoist",
    external_id: t.id,
    title: t.content,
    project_name: projectMap.get(t.project_id) ?? null,
    priority: mapPriority(t.priority),
    due_date: t.due?.date ?? null,
    url: `https://todoist.com/app/task/${t.id}`,
    is_completed: false,
    synced_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from("tasks_sync")
    .upsert(rows, { onConflict: "user_id,source,external_id" })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ synced: rows.length })
}
