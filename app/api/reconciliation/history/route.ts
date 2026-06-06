// GET /api/reconciliation/history
//
// Retourne les 10 derniers imports csv_imports avec leurs stats agrégées
// (total / matched / unmatched / excluded / montant total des débits).
// Les stats sont calculées côté serveur depuis bank_transactions.

import { NextResponse } from "next/server"
import { getSupabaseUser, createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET() {
  const user = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 })
  }

  // Derniers 10 imports
  const { data: imports, error: importsError } = await supabase
    .from("csv_imports")
    .select("id, filename, type, uploaded_at, row_count, status")
    .eq("user_id", user.id)
    .order("uploaded_at", { ascending: false })
    .limit(10)

  if (importsError) {
    return NextResponse.json({ error: importsError.message }, { status: 500 })
  }
  if (!imports || imports.length === 0) {
    return NextResponse.json({ imports: [] })
  }

  const importIds = imports.map(i => i.id as string)

  // Transactions agrégées pour ces imports (match_status + amount uniquement)
  const { data: txns, error: txnsError } = await supabase
    .from("bank_transactions")
    .select("import_id, match_status, amount")
    .in("import_id", importIds)

  if (txnsError) {
    // Non fatal — on retourne les imports sans stats
    return NextResponse.json({
      imports: imports.map(imp => ({
        id:         imp.id,
        filename:   imp.filename,
        type:       imp.type,
        uploadedAt: imp.uploaded_at,
        rowCount:   imp.row_count,
        status:     imp.status,
        stats:      null,
      })),
    })
  }

  // Agréger par import_id
  type Stats = { total: number; matched: number; unmatched: number; excluded: number; totalAmount: number }
  const statsByImport = new Map<string, Stats>()

  for (const t of txns ?? []) {
    const id  = t.import_id as string
    const cur = statsByImport.get(id) ?? { total: 0, matched: 0, unmatched: 0, excluded: 0, totalAmount: 0 }
    cur.total++
    const ms = t.match_status as string
    if (ms === "matched")   cur.matched++
    if (ms === "unmatched") cur.unmatched++
    if (ms === "excluded")  cur.excluded++
    if (ms !== "excluded")  cur.totalAmount += Math.abs(Number(t.amount))
    statsByImport.set(id, cur)
  }

  return NextResponse.json({
    imports: imports.map(imp => ({
      id:         imp.id,
      filename:   imp.filename,
      type:       imp.type,
      uploadedAt: imp.uploaded_at,
      rowCount:   imp.row_count,
      status:     imp.status,
      stats:      statsByImport.get(imp.id as string) ?? null,
    })),
  })
}
