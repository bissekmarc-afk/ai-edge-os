import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Task } from "@/types"

interface TaskRow {
  id: string
  external_id: string
  title: string
  project_name: string | null
  priority: string
  due_date: string | null
  url: string | null
  synced_at: string
}

export async function getTasksFromSupabase(limit = 10): Promise<Task[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("tasks_sync")
    .select("id, external_id, title, project_name, priority, due_date, url, synced_at")
    .eq("is_completed", false)
    .order("priority", { ascending: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error || !data) return []

  return (data as TaskRow[]).map((row) => ({
    id: row.id,
    userId: "",
    source: "todoist",
    externalId: row.external_id,
    title: row.title,
    description: "",
    projectName: row.project_name ?? "Inbox",
    priority: row.priority as Task["priority"],
    status: "pending",
    dueDate: row.due_date ?? "",
    completed: false,
    syncStatus: "success" as const,
    lastSyncedAt: row.synced_at,
    createdAt: row.synced_at,
    updatedAt: row.synced_at,
    metadata: {},
  }))
}
