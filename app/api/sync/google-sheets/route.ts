import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { getGoogleAccessToken } from "@/lib/google/auth"

// ─── Column layout (0-indexed) ───────────────────────────────────────────────
//
// Actual CURRENT sheet structure (confirmed from raw-row logs):
//   0  : empty          (col A — ignored)
//   1  : label          (col B — description / row name)
//   2  : category       (col C — "Budget Category Lookup")
//   3+ : monthly values (col D onwards — May 2026, June 2026, …)
//
// No flux_nature or entry_subtype column exists in this sheet.

const COL_LABEL      = 1   // col B
const COL_CATEGORY   = 2   // col C
const COL_DATA_START = 3   // col D — first monthly value column

// Column D (index 3) maps to this month/year.
const DATA_START_MONTH = 5     // May
const DATA_START_YEAR  = 2026

/** Maps a 0-indexed column position to the calendar month it represents. */
function colIndexToMonthYear(colIdx: number): { month: number; year: number } {
  const offset   = colIdx - COL_DATA_START
  // Absolute month count, 0-based from January of year 0
  // e.g. May 2026 → 2026*12 + 4 = 24316
  const absMonth = DATA_START_YEAR * 12 + (DATA_START_MONTH - 1) + offset
  const year  = Math.floor(absMonth / 12)
  const month = (absMonth % 12) + 1
  return { year, month }
}

/** Exact category strings the sheet uses for income rows (case-sensitive). */
const INCOME_CATEGORIES = new Set(["Income", "income", "INCOME", "Revenus", "revenus", "REVENUS"])

/** French/English fallback for rows whose category is not in INCOME_CATEGORIES. */
const INCOME_RE = /revenu|salaire|salary|recette|rentr[eé]e/i

function inferEntryType(category: string, label: string): "income" | "expense" {
  if (INCOME_CATEGORIES.has(category)) return "income"
  return INCOME_RE.test(category) || INCOME_RE.test(label) ? "income" : "expense"
}

// ─── Row-classification sets (all checked against col B = label) ─────────────

const EXCLUDED_LABELS = new Set([
  "TOTAL REVENUS",
  "TOTAL TAXES",
  "TOTAL COÛTS FIXES",
  "TOTAL COÛTS VARIABLES",
  "TOTAL ONE-OFF",
  "TOTAL EXPENSES",
  "EBITDA OPÉRATIONNEL",
  "TOTAL CAPEX",
  "NET CASH FLOW",
  "CASH POSITION",
  "DEBT OUTSTANDING",
  "TOTAL PATRIMOINE",
])

const SUBTOTAL_LABELS = new Set(["DEBT SERVICE"])

const WEALTH_LABELS = new Map<string, string>([
  ["Immo",            "real_estate"],
  ["Actions Valeur",  "equities"],
  ["Art/Collectibles","alternatives"],
  ["Épargne Cumulée", "savings"],
])

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAmount(raw: string | undefined): number {
  if (!raw?.trim()) return 0
  const cleaned = raw
    // Strip currency symbols, regular + non-breaking + narrow-no-break spaces
    .replace(/[€$£  \s]/g, "")
    .replace(/,/g, ".")
    .trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

function lastDayOfMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  console.log("[sync/google-sheets] ── POST started ──")

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  if (!spreadsheetId) {
    console.error("[sync/google-sheets] GOOGLE_SHEETS_SPREADSHEET_ID not set")
    return NextResponse.json(
      { error: "GOOGLE_SHEETS_SPREADSHEET_ID not configured" },
      { status: 503 }
    )
  }
  console.log(`[sync/google-sheets] spreadsheetId=${spreadsheetId}`)

  const supabaseUrl  = process.env.SUPABASE_URL
  const supabaseKey  = process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error("[sync/google-sheets] Supabase env vars missing — SUPABASE_URL or SUPABASE_ANON_KEY not set")
    return NextResponse.json(
      { error: "Supabase not configured", detail: "SUPABASE_URL or SUPABASE_ANON_KEY is missing from the environment" },
      { status: 503 }
    )
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll() { /* no-op — session refresh not needed in a single request */ },
      },
    }
  )

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  console.log(`[sync/google-sheets] session=${session ? `uid=${session.user.id}` : "null"} error=${sessionError?.message ?? "none"}`)

  if (sessionError || !session) {
    return NextResponse.json(
      { error: "No active session", detail: sessionError?.message ?? "session cookie not found" },
      { status: 401 }
    )
  }

  const user = session.user

  // ── Google access token ───────────────────────────────────────────────────

  let token: string
  try {
    token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets.readonly")
    console.log("[sync/google-sheets] Google access token obtained")
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[sync/google-sheets] Google auth error:", msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // ── Fetch sheet ───────────────────────────────────────────────────────────

  console.log("[sync/google-sheets] Fetching sheet CURRENT…")
  const sheetRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/CURRENT?majorDimension=ROWS`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  console.log(`[sync/google-sheets] Sheets API response status: ${sheetRes.status}`)

  const sheetData = (await sheetRes.json()) as {
    values?: string[][]
    error?: { message: string; code?: number; status?: string }
  }

  if (sheetData.error) {
    console.error("[sync/google-sheets] Sheets API error:", sheetData.error)
    return NextResponse.json(
      { error: `Sheets API: ${sheetData.error.message}`, detail: sheetData.error },
      { status: 502 }
    )
  }

  const rows = sheetData.values ?? []
  console.log(`[sync/google-sheets] Sheet returned ${rows.length} rows`)

  // Log first 3 raw rows to verify column layout
  rows.slice(0, 3).forEach((row, i) =>
    console.log(`[sync/google-sheets] raw row[${i}] (${row.length} cols):`, JSON.stringify(row))
  )

  if (rows.length === 0) {
    return NextResponse.json({ synced: 0, wealth: 0, message: "Empty sheet" })
  }

  // ── Parse rows ────────────────────────────────────────────────────────────
  //
  // For each row:
  //   - col B (1): label / row name
  //   - col C (2): category
  //   - col D+ (3+): one value per calendar month, starting at DATA_START_MONTH/YEAR

  const now = new Date().toISOString()
  const entries: Record<string, unknown>[] = []
  const wealthRows: Array<{
    label: string
    assetClass: string
    amounts: number[]   // amounts[i] corresponds to column index COL_DATA_START + i
  }> = []

  let skippedEmpty    = 0
  let skippedExcluded = 0
  let skippedHeader   = 0   // rows where label looks like a section header (no data cols)
  let wealthCount     = 0
  let subtotalCount   = 0

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx]

    // ── Label is always col B ─────────────────────────────────────────────
    const label = row[COL_LABEL]?.trim() ?? ""
    if (!label) {
      skippedEmpty++
      continue
    }

    const category = row[COL_CATEGORY]?.trim() ?? ""

    // ── Wealth snapshot rows ─────────────────────────────────────────────
    if (WEALTH_LABELS.has(label)) {
      const amounts = Array.from(
        { length: Math.max(0, row.length - COL_DATA_START) },
        (_, i) => Math.abs(parseAmount(row[COL_DATA_START + i]))
      )
      wealthRows.push({ label, assetClass: WEALTH_LABELS.get(label)!, amounts })
      wealthCount++
      const nonZero = amounts
        .map((v, i) => { const { month, year } = colIndexToMonthYear(COL_DATA_START + i); return `${year}-M${month}=${v}` })
        .filter(s => !s.endsWith("=0"))
      console.log(`[sync/google-sheets] WEALTH row[${rowIdx}] "${label}": ${nonZero.join(", ") || "(all zero)"}`)
      continue
    }

    // ── Excluded aggregate rows ──────────────────────────────────────────
    const isSubtotal = SUBTOTAL_LABELS.has(label)

    if (!isSubtotal && EXCLUDED_LABELS.has(label)) {
      skippedExcluded++
      console.log(`[sync/google-sheets] EXCL  row[${rowIdx}] "${label}"`)
      continue
    }

    // ── Skip header / section-title rows (no data columns at all) ────────
    // A row is a header if it has no values beyond col C.
    if (!isSubtotal && row.length <= COL_DATA_START) {
      skippedHeader++
      console.log(`[sync/google-sheets] HDR   row[${rowIdx}] "${label}" (only ${row.length} cols)`)
      continue
    }

    if (isSubtotal) subtotalCount++

    const entryType = inferEntryType(category, label)

    // ── Loop over data columns → one entry per non-zero month ────────────
    let rowEntries = 0
    let firstNonZeroInfo = ""   // captures first non-zero col for the row log

    for (let colIdx = COL_DATA_START; colIdx < row.length; colIdx++) {
      const raw    = row[colIdx] ?? ""
      const amount = Math.abs(parseAmount(raw))
      if (amount === 0) continue

      const { month, year } = colIndexToMonthYear(colIdx)

      if (!firstNonZeroInfo) {
        firstNonZeroInfo = `first non-zero: col${colIdx}→${year}-M${month} raw="${raw}" amount=${amount}`
      }

      const date       = `${year}-${String(month).padStart(2, "0")}-01`
      const externalId = `${spreadsheetId}:CURRENT:${rowIdx}:${month}:${year}`

      entries.push({
        user_id:       user.id,
        source:        "google_sheets",
        external_id:   externalId,
        date,
        category:      category || label,
        label,
        amount,
        currency:      "EUR",
        entry_type:    entryType,
        entry_subtype: null,
        flux_nature:   null,
        is_non_cash:   false,
        is_subtotal:   isSubtotal,
        is_recurring:  false,
        month,
        year,
        scenario:      "actual",
        synced_at:     now,
      })
      rowEntries++
    }

    // Log first 5 processed rows in full — helps diagnose inferEntryType
    const rowNum = (skippedEmpty + skippedExcluded + skippedHeader + wealthCount + subtotalCount
      + entries.length - rowEntries)   // approximate, good enough for first-5 check
    const shouldLog = rowNum < 5 || rowEntries > 0
    if (shouldLog) {
      console.log(
        `[sync/google-sheets] row[${rowIdx}] label="${label}" cat="${category}" ` +
        `type=${entryType} entries=${rowEntries} | ${firstNonZeroInfo || "all zero"}`
      )
    }
  }

  console.log(
    `[sync/google-sheets] ── Parse complete ──\n` +
    `  sheet rows  : ${rows.length}\n` +
    `  entries     : ${entries.length}\n` +
    `  wealth rows : ${wealthCount}\n` +
    `  subtotals   : ${subtotalCount}\n` +
    `  skip empty  : ${skippedEmpty}\n` +
    `  skip EXCL   : ${skippedExcluded}\n` +
    `  skip header : ${skippedHeader}\n` +
    `  accounted   : ${skippedEmpty + skippedExcluded + skippedHeader + wealthCount} rows skipped`
  )

  // ── Build wealth snapshots ─────────────────────────────────────────────────
  //
  // snapshot_date = last day of the last column that has any non-zero amount
  // across all wealth rows.

  const wealthSnapshots: Record<string, unknown>[] = []

  if (wealthRows.length > 0) {
    let lastNonZeroColOffset = -1
    for (const wr of wealthRows) {
      for (let i = wr.amounts.length - 1; i >= 0; i--) {
        if (wr.amounts[i] > 0) {
          lastNonZeroColOffset = Math.max(lastNonZeroColOffset, i)
          break
        }
      }
    }

    if (lastNonZeroColOffset >= 0) {
      const { month: snapMonth, year: snapYear } =
        colIndexToMonthYear(COL_DATA_START + lastNonZeroColOffset)
      const snapshotDate = lastDayOfMonth(snapYear, snapMonth)

      for (const wr of wealthRows) {
        const amount = wr.amounts[lastNonZeroColOffset]
        if (amount === 0) continue
        wealthSnapshots.push({
          user_id:       user.id,
          snapshot_date: snapshotDate,
          asset_name:    wr.label,
          asset_class:   wr.assetClass,
          amount,
          currency:      "EUR",
          source:        "google_sheets",
        })
      }
      console.log(`[sync/google-sheets] Wealth snapshot date: ${snapshotDate} (${wealthSnapshots.length} assets)`)
    }
  }

  // ── Upsert via RPC (bypasses PostgREST schema cache) ──────────────────────
  //
  // rpc() forwards the JSONB payload directly to PostgreSQL, which sees the
  // live schema regardless of PostgREST's cached column list.
  // Functions defined in migration 006_finance_rpc.sql.

  const BATCH = 500

  if (entries.length === 0) {
    console.warn("[sync/google-sheets] ⚠️  No entries to upsert — all rows were skipped or had zero amounts")
  }

  let totalSynced = 0

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH)
    console.log(`[sync/google-sheets] Upserting batch ${Math.floor(i / BATCH) + 1} (${batch.length} entries)…`)

    const { data: upsertedCount, error } = await supabase
      .rpc("upsert_finance_entries_batch", { p_entries: batch })

    if (error) {
      console.error("[sync/google-sheets] Upsert RPC error:", error.message, error)
      return NextResponse.json({ error: error.message, detail: error }, { status: 500 })
    }

    totalSynced += upsertedCount as number
    console.log(`[sync/google-sheets] ✓ Batch ${Math.floor(i / BATCH) + 1} — ${upsertedCount} rows affected`)
  }

  if (wealthSnapshots.length > 0) {
    console.log(`[sync/google-sheets] Upserting ${wealthSnapshots.length} wealth snapshots…`)
    const { error } = await supabase
      .rpc("upsert_wealth_snapshots_batch", { p_entries: wealthSnapshots })

    if (error) {
      console.error("[sync/google-sheets] Wealth upsert RPC error:", error.message, error)
      return NextResponse.json({ error: error.message, detail: error }, { status: 500 })
    }
    console.log("[sync/google-sheets] ✓ Wealth snapshots upserted OK")
  }

  // Async PostgREST schema-cache reload for subsequent direct queries
  try { await supabase.rpc("reload_pgrst_schema") } catch { /* non-fatal */ }

  const sampleEntries = entries.slice(0, 3).map(e => ({
    label:      e.label,
    category:   e.category,
    entry_type: e.entry_type,
    month:      e.month,
    year:       e.year,
    amount:     e.amount,
  }))

  console.log(`[sync/google-sheets] ✅ Done — parsed=${entries.length} synced=${totalSynced} wealth=${wealthSnapshots.length}`)

  return NextResponse.json({
    synced:    totalSynced,
    parsed:    entries.length,
    wealth:    wealthSnapshots.length,
    sheetRows: rows.length,
    skipped:   { empty: skippedEmpty, excluded: skippedExcluded, header: skippedHeader },
    sampleEntries,
  })
}
