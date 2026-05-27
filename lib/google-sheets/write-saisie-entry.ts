import { getGoogleAccessToken } from "@/lib/google/auth"

// ─── Constants ────────────────────────────────────────────────────────────────

const SHEET_NAME = "SAISIE"

const HEADERS = [
  "external_id",
  "date",
  "label",
  "category",
  "entry_subtype",
  "flux_nature",
  "amount",
  "month",
  "year",
  "validated",
  "created_at",
  "source",
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaisieRow {
  external_id:   string
  date:          string
  label:         string
  category:      string
  entry_subtype: string
  flux_nature:   string
  amount:        number
  month:         number
  year:          number
  validated:     boolean
  created_at:    string
  source:        string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sheetsRequest(
  url: string,
  token: string,
  options: Omit<RequestInit, "headers"> = {},
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
}

/**
 * Ensure the SAISIE tab exists.
 * – If absent → creates the sheet + writes the header row.
 * – If present → no-op (idempotent).
 */
async function ensureSaisieSheet(spreadsheetId: string, token: string): Promise<void> {
  // 1. Fetch spreadsheet metadata to check existing sheets
  console.log(`[write-saisie] ensureSaisieSheet — fetching metadata for spreadsheet ${spreadsheetId.slice(0, 8)}…`)
  const metaRes = await sheetsRequest(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    token,
  )
  console.log(`[write-saisie] metadata HTTP ${metaRes.status} ${metaRes.statusText}`)
  if (!metaRes.ok) {
    const body = await metaRes.text()
    console.error(`[write-saisie] ❌ metadata error body: ${body}`)
    throw new Error(`Sheets metadata error ${metaRes.status}: ${body.slice(0, 200)}`)
  }
  const meta = (await metaRes.json()) as { sheets: Array<{ properties: { title: string } }> }
  const sheetExists = meta.sheets.some((s) => s.properties.title === SHEET_NAME)
  console.log(`[write-saisie] sheet "${SHEET_NAME}" exists=${sheetExists} (tabs: ${meta.sheets.map(s => s.properties.title).join(", ")})`)

  if (sheetExists) return

  // 2. Create the sheet tab
  console.log(`[write-saisie] creating tab "${SHEET_NAME}"…`)
  const createRes = await sheetsRequest(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
      }),
    },
  )
  console.log(`[write-saisie] createSheet HTTP ${createRes.status} ${createRes.statusText}`)
  if (!createRes.ok) {
    const body = await createRes.text()
    console.error(`[write-saisie] ❌ createSheet error body: ${body}`)
    throw new Error(`Create sheet error ${createRes.status}: ${body.slice(0, 200)}`)
  }

  // 3. Write header row to A1
  console.log(`[write-saisie] writing header row to "${SHEET_NAME}!A1"…`)
  const headerRange = encodeURIComponent(`${SHEET_NAME}!A1`)
  const headerRes = await sheetsRequest(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${headerRange}?valueInputOption=RAW`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({ values: [HEADERS] }),
    },
  )
  console.log(`[write-saisie] writeHeaders HTTP ${headerRes.status} ${headerRes.statusText}`)
  if (!headerRes.ok) {
    const body = await headerRes.text()
    console.error(`[write-saisie] ❌ writeHeaders error body: ${body}`)
    throw new Error(`Write headers error ${headerRes.status}: ${body.slice(0, 200)}`)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Append one row to the SAISIE tab.
 * Idempotent at the sheet level (ensures tab + headers exist before appending).
 */
export async function writeSaisieEntry(row: SaisieRow): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID not configured")

  console.log(`[write-saisie] writeSaisieEntry — spreadsheetId=${spreadsheetId.slice(0, 8)}… external_id=${row.external_id}`)

  // Full write scope — readonly is not enough
  let token: string
  try {
    token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets")
    console.log(`[write-saisie] access token obtained (${token.slice(0, 8)}…)`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[write-saisie] ❌ getGoogleAccessToken failed: ${msg}`)
    throw err
  }

  // Ensure SAISIE tab exists with headers
  await ensureSaisieSheet(spreadsheetId, token)

  // Append row — column order must match HEADERS
  const values = [[
    row.external_id,
    row.date,
    row.label,
    row.category,
    row.entry_subtype,
    row.flux_nature,
    row.amount,
    row.month,
    row.year,
    row.validated,
    row.created_at,
    row.source,
  ]]

  const appendRange = encodeURIComponent(SHEET_NAME)
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${appendRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
  console.log(`[write-saisie] POST append → ${appendUrl}`)
  console.log(`[write-saisie] payload: ${JSON.stringify(values)}`)

  const appendRes = await sheetsRequest(appendUrl, token, {
    method: "POST",
    body: JSON.stringify({ values }),
  })

  console.log(`[write-saisie] append HTTP ${appendRes.status} ${appendRes.statusText}`)

  if (!appendRes.ok) {
    const body = await appendRes.text()
    console.error(`[write-saisie] ❌ append error body: ${body}`)
    throw new Error(`Append error ${appendRes.status}: ${body}`)
  }

  console.log(`[write-saisie] ✅ row appended successfully (external_id=${row.external_id})`)
}
