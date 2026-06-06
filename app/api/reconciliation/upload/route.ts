// POST /api/reconciliation/upload
//
// 1. Auth (getUser)
// 2. Parse FormData → buffer
// 3. Détecte type + parse CSV
// 4. INSERT csv_imports
// 5. INSERT bank_transactions (sans matching)
// 6. Grouper par catégorie bancaire → BankCategorySummary[]
// 7. Retourner résumé catégories + période + totaux

import { NextRequest, NextResponse } from "next/server"
import { getSupabaseUser, createSupabaseServerClient } from "@/lib/supabase/server"
import { parseCSV } from "@/lib/csv/parsers"
import { summarizeByBankCategory, computePeriod } from "@/lib/csv/summarize"

export async function POST(request: NextRequest) {
  console.log("[reconciliation/upload] ── POST reçu ──")

  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getSupabaseUser()
  console.log(`[reconciliation/upload] auth: user=${user ? user.id.slice(0, 8) + "…" : "null (401)"}`)
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  // ── Fichier ───────────────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Impossible de lire le formulaire multipart" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Champ 'file' manquant" }, { status: 400 })
  }

  const filename = file instanceof File ? file.name : "upload.csv"
  const buffer   = await file.arrayBuffer()

  // ── Parsing CSV ───────────────────────────────────────────────────────────
  const parseResult = parseCSV(buffer, filename)

  if (parseResult.errors.length > 0 && parseResult.transactions.length === 0) {
    return NextResponse.json(
      { error: "Échec du parsing CSV", details: parseResult.errors },
      { status: 422 },
    )
  }

  if (parseResult.transactions.length === 0) {
    return NextResponse.json({ error: "Aucune transaction parsée" }, { status: 422 })
  }

  // ── Supabase client ───────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 })
  }

  // ── INSERT csv_imports ────────────────────────────────────────────────────
  const { data: importRow, error: importError } = await supabase
    .from("csv_imports")
    .insert({
      user_id:   user.id,
      filename,
      type:      parseResult.type,
      row_count: parseResult.transactions.length,
      status:    "parsed",
    })
    .select("id")
    .single()

  if (importError || !importRow) {
    console.error("[reconciliation/upload] csv_imports insert error:", importError?.message)
    return NextResponse.json({ error: "Erreur lors de la création de l'import" }, { status: 500 })
  }

  const importId = importRow.id

  // ── INSERT bank_transactions (sans matching) ───────────────────────────────
  const rows = parseResult.transactions.map(t => ({
    user_id:          user.id,
    import_id:        importId,
    date:             t.date,
    label:            t.label,
    amount:           t.amount,
    category_bank:    t.categoryBank,
    type_operation:   t.typeOperation,
    matched_entry_id: null,
    match_status:     t.excluded ? "excluded" : "unmatched",
  }))

  const BATCH = 200
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error: insertError } = await supabase
      .from("bank_transactions")
      .insert(rows.slice(i, i + BATCH))

    if (insertError) {
      console.error("[reconciliation/upload] bank_transactions insert error:", insertError.message)
      return NextResponse.json({ error: "Erreur lors de l'insertion des transactions" }, { status: 500 })
    }
  }

  // ── Agrégation par catégorie bancaire ─────────────────────────────────────
  const summary    = summarizeByBankCategory(parseResult.transactions)
  const period     = computePeriod(parseResult.transactions)
  const debits     = parseResult.transactions.filter(t => !t.excluded && t.amount < 0)
  const totalSpent = Math.round(debits.reduce((s, t) => s + Math.abs(t.amount), 0) * 100) / 100

  console.log(
    `[reconciliation/upload] type=${parseResult.type} rows=${rows.length}` +
    ` débits=${debits.length} total=${totalSpent}€ catégories=${summary.length} période="${period}"`,
  )

  // Transactions individuelles pour le drill-down côté client (zéro requête Supabase).
  // Seuls les débits actifs (non exclus, amount < 0) sont inclus.
  const transactions = debits.map(t => ({
    date:         t.date,
    label:        t.label,
    amount:       t.amount,
    categoryBank: t.categoryBank,
  }))

  return NextResponse.json({
    importId,
    type:              parseResult.type,
    filename,
    totalSpent,
    totalTransactions: debits.length,
    period,
    summary,
    transactions,
    parseErrors: parseResult.errors,
  })
}
