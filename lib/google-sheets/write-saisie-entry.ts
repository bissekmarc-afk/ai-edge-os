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
  const metaRes = await sheetsRequest(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    token,
  )
  if (!metaRes.ok) {
    const body = await metaRes.text()
    throw new Error(`Sheets metadata error ${metaRes.status}: ${body.slice(0, 200)}`)
  }
  const meta = (await metaRes.json()) as { sheets: Array<{ properties: { title: string } }> }
  const sheetExists = meta.sheets.some((s) => s.properties.title === SHEET_NAME)

  if (sheetExists) return

  // 2. Create the sheet tab
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
  if (!createRes.ok) {
    const body = await createRes.text()
    throw new Error(`Create sheet error ${createRes.status}: ${body.slice(0, 200)}`)
  }

  // 3. Write header row to A1
  const headerRange = encodeURIComponent(`${SHEET_NAME}!A1`)
  const headerRes = await sheetsRequest(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${headerRange}?valueInputOption=RAW`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({ values: [HEADERS] }),
    },
  )
  if (!headerRes.ok) {
    const body = await headerRes.text()
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

  // Full write scope — readonly is not enough
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets")

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
  const appendRes = await sheetsRequest(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${appendRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ values }),
    },
  )

  if (!appendRes.ok) {
    const body = await appendRes.text()
    throw new Error(`Append error ${appendRes.status}: ${body.slice(0, 200)}`)
  }
}
