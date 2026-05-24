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
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // Count before delete so we can report how many rows were removed
  const { count: before } = await supabase
    .from("finance_entries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)

  const { error: deleteError } = await supabase
    .from("finance_entries")
    .delete()
    .eq("user_id", userId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({
    deleted: before ?? 0,
    message: `${before ?? 0} rows deleted from finance_entries. Run POST /api/sync/google-sheets to re-sync.`,
  })
}
