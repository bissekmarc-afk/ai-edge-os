// GET /api/reconciliation/import/[id]
//
// Retourne toutes les bank_transactions d'un import donné.
// RLS garantit que seul le propriétaire peut y accéder.

import { NextRequest, NextResponse } from "next/server"
import { getSupabaseUser, createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const { id: importId } = await params

  if (!importId) {
    return NextResponse.json({ error: "id manquant" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 })
  }

  // Vérifier que l'import appartient à l'utilisateur (double vérification au-delà de RLS)
  const { data: imp } = await supabase
    .from("csv_imports")
    .select("id, type, filename")
    .eq("id",      importId)
    .eq("user_id", user.id)
    .single()

  if (!imp) {
    return NextResponse.json({ error: "Import introuvable" }, { status: 404 })
  }

  const { data: transactions, error } = await supabase
    .from("bank_transactions")
    .select("id, date, label, amount, category_bank, type_operation, match_status, matched_entry_id")
    .eq("import_id", importId)
    .order("date", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    importId,
    filename:     imp.filename,
    type:         imp.type,
    transactions: (transactions ?? []).map(t => ({
      id:            t.id,
      date:          t.date,
      label:         t.label,
      amount:        Number(t.amount),
      categoryBank:  t.category_bank,
      typeOperation: t.type_operation,
      matchStatus:   t.match_status,
    })),
  })
}
