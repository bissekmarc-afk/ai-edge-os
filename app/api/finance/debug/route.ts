/**
 * GET /api/finance/debug
 *
 * Diagnostic endpoint (development only).
 *
 * Uses rpc() calls that bypass PostgREST's schema cache, so it works even
 * when migration 005 was applied to a running instance (stale cache).
 *
 * Checks:
 * 1. Which columns exist on finance_entries  (via check_finance_columns RPC)
 * 2. Whether the 4 new columns from migration 005 are present
 * 3. Total row count + count of rows with month/year filled
 * 4. The latest data month (what getLastDataMonth() returns)
 * 5. Wealth snapshot count
 * 6. 5 most-recent entries (from a plain SELECT — safe once cache is warm)
 */

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

const REQUIRED_COLUMNS = ["flux_nature", "month", "year", "scenario", "is_non_cash", "is_subtotal", "entry_subtype"]

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 403 })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // ── 1. Column check via RPC (bypasses PostgREST schema cache) ────────────────
  const { data: columnRows, error: columnError } = await supabase
    .rpc("check_finance_columns")

  const existingColumns: string[] = columnRows?.map((r: { column_name: string }) => r.column_name) ?? []
  const missingColumns = REQUIRED_COLUMNS.filter(c => !existingColumns.includes(c))
  const migration005Applied = missingColumns.length === 0

  // ── 2. Trigger async schema-cache reload for subsequent direct queries ────────
  if (migration005Applied) {
    // Fire-and-forget — PostgREST will reload on the next request cycle
    await supabase.rpc("reload_pgrst_schema").then(() => {
      console.log("[finance/debug] PostgREST schema reload triggered")
    })
  }

  // ── 3. Row counts ─────────────────────────────────────────────────────────────
  //
  // Total count uses only base columns — safe regardless of cache state.
  // The month/year count references new columns; attempted after the reload
  // trigger above; error is surfaced in the response rather than crashing.

  const { count: totalCount } = await supabase
    .from("finance_entries")
    .select("*", { count: "exact", head: true })

  let newParserCount: number | null = null
  let newParserCountError: string | null = null

  try {
    const { count, error } = await supabase
      .from("finance_entries")
      .select("*", { count: "exact", head: true })
      .not("month", "is", null)
      .not("year", "is", null)

    if (error) newParserCountError = error.message
    else newParserCount = count
  } catch (e) {
    newParserCountError = String(e)
  }

  // ── 4. Latest data month ───────────────────────────────────────────────────────
  let latestMonth: { month: number; year: number } | null = null
  let latestMonthError: string | null = null

  try {
    const { data, error } = await supabase
      .from("finance_entries")
      .select("month, year")
      .eq("is_subtotal", false)
      .eq("is_non_cash", false)
      .not("month", "is", null)
      .not("year", "is", null)
      .order("year",  { ascending: false })
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) latestMonthError = error.message
    else latestMonth = data as { month: number; year: number } | null
  } catch (e) {
    latestMonthError = String(e)
  }

  // ── 5. Wealth snapshot count ───────────────────────────────────────────────────
  const { count: wealthCount } = await supabase
    .from("wealth_snapshots")
    .select("*", { count: "exact", head: true })

  // ── 6. Sample entries ─────────────────────────────────────────────────────────
  let sampleEntries: unknown[] = []
  let sampleError: string | null = null

  try {
    const { data, error } = await supabase
      .from("finance_entries")
      .select("label, category, entry_type, flux_nature, month, year, amount, is_non_cash, is_subtotal, scenario, synced_at")
      .order("synced_at", { ascending: false })
      .limit(5)

    if (error) sampleError = error.message
    else sampleEntries = data ?? []
  } catch (e) {
    sampleError = String(e)
  }

  return NextResponse.json({
    user_id: session.user.id,

    migration_005: {
      applied: migration005Applied,
      existing_columns: existingColumns,
      missing_columns: missingColumns,
      rpc_error: columnError?.message ?? null,
    },

    entries: {
      total: totalCount ?? 0,
      with_month_year: newParserCount,
      with_month_year_error: newParserCountError,
    },

    latest_data_month: latestMonth,
    latest_data_month_error: latestMonthError,

    wealth_snapshots: wealthCount ?? 0,

    sample_entries: sampleEntries,
    sample_error: sampleError,

    hint: !migration005Applied
      ? `Apply supabase/migrations/006_finance_rpc.sql in the Supabase SQL Editor, then re-run this endpoint.`
      : latestMonth === null
      ? "Migration OK but no data. Run POST /api/sync/google-sheets to sync."
      : "All good — data is present.",
  })
}
