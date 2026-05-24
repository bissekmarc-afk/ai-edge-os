import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { MemoryEntry, SensitivityLevel } from "@/types"

interface MemoryRow {
  id: string
  user_id: string
  title: string
  content: string
  category: string
  sensitivity_level: string
  confidence_score: number
  confirmed_by_user: boolean
  source: string
  created_at: string
  updated_at: string
}

function rowToMemoryEntry(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    category: row.category,
    sensitivityLevel: row.sensitivity_level as SensitivityLevel,
    confidenceScore: row.confidence_score,
    confirmedByUser: row.confirmed_by_user,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: {},
  }
}

export async function getConfirmedMemories(limit = 20): Promise<MemoryEntry[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("ai_memory")
    .select("id,user_id,title,content,category,sensitivity_level,confidence_score,confirmed_by_user,source,created_at,updated_at")
    .eq("confirmed_by_user", true)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return (data as MemoryRow[]).map(rowToMemoryEntry)
}

export async function getAllMemories(limit = 50): Promise<MemoryEntry[]> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("ai_memory")
    .select("id,user_id,title,content,category,sensitivity_level,confidence_score,confirmed_by_user,source,created_at,updated_at")
    .order("confirmed_by_user", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return (data as MemoryRow[]).map(rowToMemoryEntry)
}
