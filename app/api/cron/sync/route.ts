import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getGoogleAccessToken } from "@/lib/google/auth"
import type { Priority } from "@/types"

// ─── Todoist helpers ──────────────────────────────────────────────────────────

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
    if (!res.ok) throw new Error(`Todoist ${res.status} ${res.statusText}`)
    const page: TodoistPagedResponse<T> = await res.json()
    all.push(...page.results)
    cursor = page.next_cursor
  } while (cursor)
  return all
}

// ─── Google Sheets helpers ────────────────────────────────────────────────────

const COL_LABEL      = 0
const COL_CATEGORY   = 1
const COL_TYPE       = 2
const COL_FLUX       = 3
const COL_DATA_START = 4
const DATA_START_MONTH = 5
const DATA_START_YEAR  = 2026

const EXCLUDE_SUBSTRINGS = ["total", "ebitda", "net cash flow", "debt service", "solde"]

function isExcluded(label: string): boolean {
  const lower = label.toLowerCase()
  return EXCLUDE_SUBSTRINGS.some(sub => lower.includes(sub))
}

function fluxToEntryFields(flux: string): { entry_type: "income" | "expense"; is_non_cash: boolean } {
  const norm = flux.trim().toLowerCase()
  if (norm === "cash in")  return { entry_type: "income",  is_non_cash: false }
  if (norm === "non-cash") return { entry_type: "expense", is_non_cash: true  }
  return                          { entry_type: "expense", is_non_cash: false }
}

function colIndexToMonthYear(colIdx: number): { month: number; year: number } {
  const absMonth = DATA_START_YEAR * 12 + (DATA_START_MONTH - 1) + (colIdx - COL_DATA_START)
  return {
    year:  Math.floor(absMonth / 12),
    month: (absMonth % 12) + 1,
  }
}

function parseAmount(raw: string | undefined): number {
  if (!raw?.trim()) return 0
  const cleaned = raw
    .replace(/[€$£  \s]/g, "")
    .replace(/,/g, ".")
    .trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Vérification Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get("Authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. SOLO_USER_ID — jamais depuis le body
  const userId = process.env.SOLO_USER_ID
  if (!userId) {
    return NextResponse.json({ error: "SOLO_USER_ID not configured" }, { status: 500 })
  }

  // 3. Client Supabase service_role (côté serveur uniquement, bypass RLS)
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 500 })
  }
  const supabase = createClient(supabaseUrl, serviceKey)

  // 4. Anti-concurrence : reject si un sync est déjà en cours depuis < 30 min
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: running } = await supabase
    .from("sync_runs")
    .select("id")
    .eq("status", "running")
    .gt("started_at", thirtyMinAgo)
    .maybeSingle()

  if (running) {
    return NextResponse.json({ error: "Sync already running" }, { status: 409 })
  }

  // 5. Créer sync_run avec status = 'running'
  const { data: syncRun, error: runError } = await supabase
    .from("sync_runs")
    .insert({ user_id: userId, status: "running", started_at: new Date().toISOString() })
    .select("id")
    .single()

  if (runError || !syncRun) {
    return NextResponse.json({ error: "Failed to create sync run", detail: runError?.message }, { status: 500 })
  }

  const startTime   = Date.now()
  let finalStatus   = "success"
  let totalInserted = 0
  let todoistResult: unknown = null
  let sheetsResult:  unknown = null

  // 6. Sync Todoist
  try {
    const token = process.env.TODOIST_API_TOKEN
    if (!token || token === "your_todoist_api_token_here") {
      throw new Error("TODOIST_API_TOKEN not configured")
    }

    const headers = { Authorization: `Bearer ${token}` }
    const [tasks, projects] = await Promise.all([
      fetchAllPages<TodoistTask>("https://api.todoist.com/api/v1/tasks", headers),
      fetchAllPages<TodoistProject>("https://api.todoist.com/api/v1/projects", headers),
    ])

    const projectMap = new Map(projects.map(p => [p.id, p.name]))
    const now        = new Date().toISOString()
    const rows = tasks.map(t => ({
      user_id:      userId,
      source:       "todoist",
      external_id:  t.id,
      title:        t.content,
      project_name: projectMap.get(t.project_id) ?? null,
      priority:     mapPriority(t.priority),
      due_date:     t.due?.date ?? null,
      url:          `https://todoist.com/app/task/${t.id}`,
      is_completed: false,
      synced_at:    now,
    }))

    const { error } = await supabase
      .from("tasks_sync")
      .upsert(rows, { onConflict: "user_id,source,external_id" })

    if (error) throw new Error(error.message)

    todoistResult  = { synced: rows.length }
    totalInserted += rows.length
  } catch (err) {
    finalStatus   = "failed"
    todoistResult = { error: err instanceof Error ? err.message : String(err) }
  }

  // 7. Sync Google Sheets
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID not configured")

    const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets.readonly")

    const range    = encodeURIComponent("'BUDGET DAF'")
    const sheetRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?majorDimension=ROWS`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const sheetData = await sheetRes.json() as { values?: string[][]; error?: { message: string } }
    if (sheetData.error) throw new Error(`Sheets API: ${sheetData.error.message}`)

    const allRows = sheetData.values ?? []
    const rows    = allRows.slice(1) // skip header row
    const now     = new Date().toISOString()

    const entries: Record<string, unknown>[] = []

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row      = rows[rowIdx]
      const label    = row[COL_LABEL]?.trim()    ?? ""
      const category = row[COL_CATEGORY]?.trim() ?? ""
      const type     = row[COL_TYPE]?.trim()     ?? ""
      const flux     = row[COL_FLUX]?.trim()     ?? ""

      if (!label)                      continue
      if (!category && !type && !flux) continue // section title row
      if (isExcluded(label))           continue

      const { entry_type, is_non_cash } = fluxToEntryFields(flux)

      for (let colIdx = COL_DATA_START; colIdx < row.length; colIdx++) {
        const amount = Math.abs(parseAmount(row[colIdx]))
        if (amount === 0) continue

        const { month, year } = colIndexToMonthYear(colIdx)

        entries.push({
          user_id:       userId,
          source:        "google_sheets",
          external_id:   `${spreadsheetId}:BUDGET_DAF:${rowIdx + 1}:${month}:${year}`,
          date:          `${year}-${String(month).padStart(2, "0")}-01`,
          category:      category || label,
          label,
          amount,
          currency:      "EUR",
          entry_type,
          entry_subtype: type || null,
          flux_nature:   flux || null,
          is_non_cash,
          is_subtotal:   false,
          is_recurring:  false,
          month,
          year,
          scenario:      "budget",
          synced_at:     now,
        })
      }
    }

    const BATCH     = 500
    let totalSynced = 0
    for (let i = 0; i < entries.length; i += BATCH) {
      const { data: count, error } = await supabase
        .rpc("upsert_finance_entries_batch", { p_entries: entries.slice(i, i + BATCH) })
      if (error) throw new Error(error.message)
      totalSynced += count as number
    }

    sheetsResult   = { synced: totalSynced, parsed: entries.length }
    totalInserted += totalSynced
  } catch (err) {
    if (finalStatus !== "failed") finalStatus = "failed"
    sheetsResult = { error: err instanceof Error ? err.message : String(err) }
  }

  const durationMs = Date.now() - startTime

  // 8. Mettre à jour sync_run
  await supabase
    .from("sync_runs")
    .update({
      status:         finalStatus,
      finished_at:    new Date().toISOString(),
      inserted_count: totalInserted,
    })
    .eq("id", syncRun.id)

  return NextResponse.json({
    status:      finalStatus,
    todoist:     todoistResult,
    sheets:      sheetsResult,
    duration_ms: durationMs,
  })
}
