import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { getGoogleAccessToken } from "@/lib/google/auth"

// ─── Column layout — "BUDGET DAF" tab (0-indexed) ────────────────────────────
//
//   A (0) : label
//   B (1) : category
//   C (2) : type        (Fixed | Variable | One-off)
//   D (3) : flux_nature (Cash In | Cash Out | Non-cash)
//   E+ (4+): monthly budget values — starts at May 2026

const COL_LABEL      = 0
const COL_CATEGORY   = 1
const COL_TYPE       = 2   // unused for storage but used for skip logic
const COL_FLUX       = 3   // flux_nature
const COL_DATA_START = 4   // first monthly value

const DATA_START_MONTH = 5     // May
const DATA_START_YEAR  = 2026

// ─── Labels to exclude (case-insensitive substring match) ────────────────────

const EXCLUDE_SUBSTRINGS = [
  "total",
  "ebitda",
  "net cash flow",
  "debt service",
  "solde",
]

function isExcluded(label: string): boolean {
  const lower = label.toLowerCase()
  return EXCLUDE_SUBSTRINGS.some(sub => lower.includes(sub))
}

// ─── flux_nature → entry fields ───────────────────────────────────────────────

function fluxToEntryFields(flux: string): {
  entry_type: "income" | "expense"
  is_non_cash: boolean
} {
  const norm = flux.trim().toLowerCase()
  if (norm === "cash in")   return { entry_type: "income",  is_non_cash: false }
  if (norm === "non-cash")  return { entry_type: "expense", is_non_cash: true  }
  return                           { entry_type: "expense", is_non_cash: false }  // "cash out" + fallback
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    .replace(/[€$£  \s]/g, "")   // strip currency + spaces (incl. non-breaking)
    .replace(/,/g, ".")
    .trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  console.log("[sync/google-sheets] ── POST started ──")

  try {
    return await handler(request)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack   = err instanceof Error ? err.stack   : undefined
    console.error("[sync/google-sheets] 💥 Unhandled exception:", message)
    if (stack) console.error(stack)
    return NextResponse.json(
      { error: "Internal server error", detail: message },
      { status: 500 },
    )
  }
}

async function handler(request: NextRequest): Promise<NextResponse> {

  // ── 1. Env guards ─────────────────────────────────────────────────────────
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  console.log(`[sync/google-sheets] STEP 1 env — spreadsheetId=${spreadsheetId ? `${spreadsheetId.slice(0,8)}…` : "MISSING"}`)
  if (!spreadsheetId) {
    return NextResponse.json({ error: "GOOGLE_SHEETS_SPREADSHEET_ID not configured" }, { status: 503 })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY
  console.log(`[sync/google-sheets]          supabaseUrl=${supabaseUrl ? "set" : "MISSING"} supabaseKey=${supabaseKey ? "set" : "MISSING"}`)
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Supabase not configured", detail: "SUPABASE_URL or SUPABASE_ANON_KEY is missing" },
      { status: 503 },
    )
  }

  // ── 2. Supabase auth — getUser() verifies JWT server-side ────────────────
  console.log("[sync/google-sheets] STEP 2 auth — verifying user with Supabase…")
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll() { /* no-op */ },
    },
  })

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log(
    `[sync/google-sheets]          user=${user ? `uid=${user.id}` : "null"}` +
    ` userError=${userError?.message ?? "none"}`,
  )

  if (userError || !user) {
    return NextResponse.json(
      { error: "Non authentifié", detail: userError?.message ?? "session invalide ou expirée" },
      { status: 401 },
    )
  }

  const userId = user.id

  // ── 3. Google access token ─────────────────────────────────────────────────
  console.log("[sync/google-sheets] STEP 3 google token — calling getGoogleAccessToken…")
  let token: string
  try {
    token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets.readonly")
    console.log(`[sync/google-sheets]          token obtained (${token.slice(0, 8)}…)`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[sync/google-sheets]          Google auth error:", msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // ── 4. Fetch "BUDGET DAF" tab ──────────────────────────────────────────────
  //
  // Sheet names with spaces must be wrapped in single quotes in A1 notation.
  // URL-encode the full range string: 'BUDGET DAF' → %27BUDGET%20DAF%27

  const range    = encodeURIComponent("'BUDGET DAF'")
  const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?majorDimension=ROWS`

  console.log(`[sync/google-sheets] STEP 4 sheets — GET ${sheetUrl}`)
  const sheetRes = await fetch(sheetUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  console.log(`[sync/google-sheets]          Sheets API HTTP status: ${sheetRes.status} ${sheetRes.statusText}`)

  // Read body as text first so we can log it if JSON.parse fails
  const rawBody = await sheetRes.text()
  console.log(`[sync/google-sheets]          body length: ${rawBody.length} chars`)
  if (rawBody.length < 500) {
    console.log(`[sync/google-sheets]          body preview: ${rawBody}`)
  } else {
    console.log(`[sync/google-sheets]          body preview: ${rawBody.slice(0, 300)}…`)
  }

  let sheetData: { values?: string[][]; error?: { message: string; code?: number; status?: string } }
  try {
    sheetData = JSON.parse(rawBody) as typeof sheetData
  } catch (parseErr) {
    console.error("[sync/google-sheets]          JSON.parse failed:", parseErr)
    return NextResponse.json(
      { error: "Sheets API returned non-JSON response", detail: rawBody.slice(0, 300) },
      { status: 502 },
    )
  }

  if (sheetData.error) {
    console.error("[sync/google-sheets]          Sheets API error object:", JSON.stringify(sheetData.error))
    return NextResponse.json(
      { error: `Sheets API: ${sheetData.error.message}`, detail: String(sheetData.error.code ?? sheetData.error.status ?? "") || undefined },
      { status: 502 },
    )
  }

  const allRows = sheetData.values ?? []
  console.log(`[sync/google-sheets] STEP 5 parse — ${allRows.length} raw rows from sheet`)

  // Log first 3 rows for column layout verification
  allRows.slice(0, 3).forEach((row, i) =>
    console.log(`[sync/google-sheets]          raw[${i}] (${row.length} cols): ${JSON.stringify(row)}`),
  )

  // Row 0 is the header — skip it
  const rows = allRows.slice(1)
  if (rows.length === 0) {
    return NextResponse.json({ synced: 0, parsed: 0, message: "Empty sheet" })
  }

  // ── Parse rows ────────────────────────────────────────────────────────────

  const now     = new Date().toISOString()
  const entries: Record<string, unknown>[] = []

  let skippedHeader   = 0   // B + C + D all empty → section title
  let skippedExcluded = 0   // label matches exclusion substrings
  let skippedEmpty    = 0   // no label at all
  let skippedZero     = 0   // all monthly values are zero

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row      = rows[rowIdx]
    const label    = row[COL_LABEL]?.trim() ?? ""
    const category = row[COL_CATEGORY]?.trim() ?? ""
    const type     = row[COL_TYPE]?.trim() ?? ""
    const flux     = row[COL_FLUX]?.trim() ?? ""

    // ── Skip rows with no label ──────────────────────────────────────────
    if (!label) {
      skippedEmpty++
      continue
    }

    // ── Skip section-title rows (B, C, D all empty) ──────────────────────
    if (!category && !type && !flux) {
      skippedHeader++
      console.log(`[sync/google-sheets] HDR   row[${rowIdx + 1}] "${label}"`)
      continue
    }

    // ── Exclude aggregate/subtotal labels ────────────────────────────────
    if (isExcluded(label)) {
      skippedExcluded++
      console.log(`[sync/google-sheets] EXCL  row[${rowIdx + 1}] "${label}"`)
      continue
    }

    // ── Derive entry_type and is_non_cash from flux_nature ────────────────
    const { entry_type, is_non_cash } = fluxToEntryFields(flux)

    // ── Loop over monthly value columns ──────────────────────────────────
    let rowEntries      = 0
    let firstNonZeroLog = ""

    for (let colIdx = COL_DATA_START; colIdx < row.length; colIdx++) {
      const amount = Math.abs(parseAmount(row[colIdx]))
      if (amount === 0) continue

      const { month, year } = colIndexToMonthYear(colIdx)

      if (!firstNonZeroLog) {
        firstNonZeroLog = `col${colIdx}→${year}-M${String(month).padStart(2,"0")} amount=${amount}`
      }

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
        entry_subtype: type   || null,
        flux_nature:   flux   || null,
        is_non_cash,
        is_subtotal:   false,
        is_recurring:  false,
        month,
        year,
        scenario:      "budget_initial",
        sync_status:   "synced",
        synced_at:     now,
      })
      rowEntries++
    }

    if (rowEntries === 0) {
      skippedZero++
      console.log(`[sync/google-sheets] ZERO  row[${rowIdx + 1}] "${label}" flux=${flux}`)
      continue
    }

    console.log(
      `[sync/google-sheets] OK    row[${rowIdx + 1}] ` +
      `label="${label}" cat="${category}" type=${entry_type} non_cash=${is_non_cash} ` +
      `entries=${rowEntries} | ${firstNonZeroLog}`,
    )
  }

  console.log(
    `[sync/google-sheets] ── Parse complete ──\n` +
    `  data rows    : ${rows.length}\n` +
    `  entries      : ${entries.length}\n` +
    `  skip empty   : ${skippedEmpty}\n` +
    `  skip header  : ${skippedHeader}\n` +
    `  skip excl    : ${skippedExcluded}\n` +
    `  skip all-zero: ${skippedZero}`,
  )

  if (entries.length === 0) {
    console.warn("[sync/google-sheets] ⚠️  No entries to upsert")
    return NextResponse.json({
      synced: 0, parsed: 0,
      skipped: { empty: skippedEmpty, header: skippedHeader, excluded: skippedExcluded, zero: skippedZero },
    })
  }

  // ── Validation scenario avant upsert ─────────────────────────────────────
  //
  // La contrainte DB accepte uniquement : actual | budget_initial | reforecast_6m
  // Les entrées Google Sheets sont toujours 'budget_initial' (hardcodé), mais on
  // valide défensivement pour éviter une violation de contrainte silencieuse.

  const VALID_SCENARIOS = new Set(["actual", "budget_initial", "reforecast_6m"])
  let skippedScenario = 0

  const validEntries = entries.filter((e) => {
    if (!VALID_SCENARIOS.has(e.scenario as string)) {
      console.warn(
        `[sync/google-sheets] SKIP invalid scenario="${e.scenario}"` +
        ` external_id="${e.external_id}"`,
      )
      skippedScenario++
      return false
    }
    return true
  })

  if (skippedScenario > 0) {
    console.error(`[sync/google-sheets] ⚠️  ${skippedScenario} entrée(s) avec scenario invalide ignorée(s)`)
  }

  if (validEntries.length === 0) {
    return NextResponse.json({
      synced: 0, parsed: 0,
      skipped: { empty: skippedEmpty, header: skippedHeader, excluded: skippedExcluded, zero: skippedZero, scenario: skippedScenario },
    })
  }

  // ── Upsert via RPC (bypasses PostgREST schema cache) ─────────────────────

  const BATCH     = 500
  let totalSynced = 0

  for (let i = 0; i < validEntries.length; i += BATCH) {
    const batch   = validEntries.slice(i, i + BATCH)
    const batchNo = Math.floor(i / BATCH) + 1
    console.log(`[sync/google-sheets] Upserting batch ${batchNo} (${batch.length} entries)…`)

    const { data: count, error } = await supabase
      .rpc("upsert_finance_entries_batch", { p_entries: batch })

    if (error) {
      console.error("[sync/google-sheets] Upsert error:", error.message, error)
      const detail = [error.details, error.hint, error.code].filter(Boolean).join(" — ") || undefined
      return NextResponse.json({ error: error.message, detail }, { status: 500 })
    }

    totalSynced += count as number
    console.log(`[sync/google-sheets] ✓ Batch ${batchNo} — ${count} rows affected`)
  }

  // Async PostgREST schema-cache reload — non-fatal
  try { await supabase.rpc("reload_pgrst_schema") } catch { /* ignore */ }

  const sampleEntries = entries.slice(0, 3).map(e => ({
    label:      e.label,
    category:   e.category,
    entry_type: e.entry_type,
    flux_nature: e.flux_nature,
    month:      e.month,
    year:       e.year,
    amount:     e.amount,
  }))

  console.log(`[sync/google-sheets] ✅ Done — parsed=${entries.length} valid=${validEntries.length} synced=${totalSynced}`)

  return NextResponse.json({
    synced:    totalSynced,
    parsed:    entries.length,
    sheetRows: rows.length,
    skipped:   { empty: skippedEmpty, header: skippedHeader, excluded: skippedExcluded, zero: skippedZero, scenario: skippedScenario },
    sampleEntries,
  })
}
