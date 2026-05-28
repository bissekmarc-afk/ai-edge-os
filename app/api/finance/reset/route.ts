/**
 * POST /api/finance/reset
 *
 * Deletes all finance_entries rows that belong to the authenticated user.
 * Wealth snapshots are left untouched (re-created by the next sync).
 *
 * Auth: reads the session from request cookies via getSession() — avoids the
 * network round-trip that getUser() does, which can fail in Route Handlers
 * called from client-side fetch (AuthSessionMissingError).
 * The actual data access is still protected by RLS (auth.uid() = user_id).
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

  // getSession() reads directly from the cookie without a network call.
  // Sufficient here because RLS enforces user_id = auth.uid() at DB level.
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session) {
    return NextResponse.json(
      { error: "No active session", detail: sessionError?.message ?? "session cookie not found" },
      { status: 401 }
    )
  }

  const userId = session.user.id

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
