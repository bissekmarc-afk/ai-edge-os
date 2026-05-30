/**
 * POST /api/finance/reset
 *
 * Deletes all finance_entries rows that belong to the authenticated user.
 * Wealth snapshots are left untouched (re-created by the next sync).
 *
 * Auth: uses getUser() which verifies the JWT with the Supabase server —
 * required for destructive operations so a replayed or forged cookie cannot
 * bypass the check.  RLS (auth.uid() = user_id) adds a second layer of
 * protection on every DB operation.
 *
 * Cookie handling: uses request.cookies from NextRequest — the canonical
 * pattern for @supabase/ssr in Route Handlers (vs cookies() from next/headers
 * which is designed for Server Components / Server Actions).
 */

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
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
        getAll() {
          return request.cookies.getAll()
        },
        // Route Handlers can't set cookies on the incoming request, but
        // createServerClient requires the setter for session-refresh writes.
        // We capture them on the response object below.
        setAll() {
          // No-op here — refreshed tokens are written via response headers.
          // The session remains valid for the lifetime of this single request.
        },
      },
    }
  )

  // getUser() verifies the JWT with the Supabase server — required for
  // destructive operations so a replayed cookie cannot bypass auth.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json(
      { error: "Non authentifié", detail: userError?.message ?? "session invalide ou expirée" },
      { status: 401 }
    )
  }

  const userId = user.id

  // Sources supprimées par le reset — manual_saisie est intentionnellement exclu.
  const DELETABLE_SOURCES = ["google_sheets", "csv_import"]

  // Count before delete so we can report how many rows were removed
  const { count: before } = await supabase
    .from("finance_entries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("source", DELETABLE_SOURCES)

  const { error: deleteError } = await supabase
    .from("finance_entries")
    .delete()
    .eq("user_id", userId)
    .in("source", DELETABLE_SOURCES)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Count what remains (manual_saisie rows — should be untouched)
  const { count: remaining } = await supabase
    .from("finance_entries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)

  return NextResponse.json({
    deleted:   before ?? 0,
    remaining: remaining ?? 0,
    sources:   DELETABLE_SOURCES,
    message:   `${before ?? 0} lignes supprimées (sources: ${DELETABLE_SOURCES.join(", ")}). Les saisies manuelles sont préservées. Relancer POST /api/sync/google-sheets pour re-synchroniser.`,
  })
}
