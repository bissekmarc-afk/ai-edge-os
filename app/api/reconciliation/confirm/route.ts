// POST /api/reconciliation/confirm
//
// Marque un import comme 'confirmed'.
// Body : { importId: string }

import { NextRequest, NextResponse } from "next/server"
import { getSupabaseUser, createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const user = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  let importId: string
  try {
    const body = await request.json()
    importId   = typeof body.importId === "string" ? body.importId.trim() : ""
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 })
  }

  if (!importId) {
    return NextResponse.json({ error: "importId manquant" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 })
  }

  // RLS garantit que seul le propriétaire peut confirmer son import
  const { error } = await supabase
    .from("csv_imports")
    .update({ status: "confirmed" })
    .eq("id",      importId)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, importId })
}
