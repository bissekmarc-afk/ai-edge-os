// POST /api/reconciliation/upload
//
// 1. Auth (getUser)
// 2. Parse FormData → buffer
// 3. Détecte type + parse CSV
// 4. INSERT csv_imports
// 5. Fetch finance_entries (plage de dates des transactions)
// 6. Match en mémoire
// 7. INSERT bank_transactions (avec match_status pré-calculé)
// 8. Retourne résumé + transactions pour l'UI

import { NextRequest, NextResponse } from "next/server"
import { getSupabaseUser, createSupabaseServerClient } from "@/lib/supabase/server"
import { parseCSV } from "@/lib/csv/parsers"
import { matchTransactions } from "@/lib/csv/matcher"
import type { MatchCandidate } from "@/lib/csv/matcher"

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getSupabaseUser()
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

  const activeTxns = parseResult.transactions.filter(t => !t.excluded)
  if (activeTxns.length === 0 && parseResult.transactions.length === 0) {
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

  // ── Fetch finance_entries pour la plage de dates ──────────────────────────
  let candidates: MatchCandidate[] = []

  if (activeTxns.length > 0) {
    const dates    = activeTxns.map(t => t.date).sort()
    const minDate  = dates[0]
    const maxDate  = dates[dates.length - 1]

    // Étendre la plage de ±3 jours pour le matching
    const minDt  = new Date(minDate); minDt.setDate(minDt.getDate() - 3)
    const maxDt  = new Date(maxDate); maxDt.setDate(maxDt.getDate() + 3)
    const rangeMin = minDt.toISOString().slice(0, 10)
    const rangeMax = maxDt.toISOString().slice(0, 10)

    console.log(`[reconciliation/upload] fetching finance_entries date range: ${rangeMin} → ${rangeMax}`)

    const { data: entries, error: fetchError } = await supabase
      .from("finance_entries")
      .select("id, date, label, amount, source, sync_status")
      .gte("date",       rangeMin)
      .lte("date",       rangeMax)
      .eq("scenario",    "actual")
      .eq("is_subtotal", false)
      .eq("is_non_cash", false)
      // Exclure les "deleted" tout en conservant les lignes où sync_status est null.
      // PostgREST: .neq() exclut les NULL → utiliser .or() pour inclure les nulls.
      .or("sync_status.neq.deleted,sync_status.is.null")

    if (fetchError) {
      console.error("[reconciliation/upload] finance_entries fetch error:", fetchError.message)
      // Non fatal — on continue sans candidates
    } else {
      candidates = (entries ?? []).map(e => ({
        id:     e.id as string,
        date:   e.date as string,
        label:  e.label as string,
        amount: Math.abs(Number(e.amount)),
        source: e.source as string,
      }))

      console.log(
        `[reconciliation/upload] finance_entries found: ${candidates.length}` +
        (candidates.length > 0
          ? ` | first: date="${candidates[0].date}" amount=${candidates[0].amount}` +
            ` label="${candidates[0].label.slice(0, 40)}"`
          : " ← ⚠️ plage vide ou filtres trop restrictifs"),
      )
      console.log(
        `[reconciliation/upload] first bank_txn: date="${activeTxns[0]?.date}"` +
        ` amount=${activeTxns[0]?.amount} label="${activeTxns[0]?.label.slice(0, 40)}"`,
      )
    }
  }

  // ── Matching en mémoire ───────────────────────────────────────────────────
  const matchResults = matchTransactions(parseResult.transactions, candidates)

  // ── INSERT bank_transactions ──────────────────────────────────────────────
  const rows = matchResults.map(r => ({
    user_id:          user.id,
    import_id:        importId,
    date:             r.transaction.date,
    label:            r.transaction.label,
    amount:           r.transaction.amount,
    category_bank:    r.transaction.categoryBank,
    type_operation:   r.transaction.typeOperation,
    matched_entry_id: r.matchedEntryId,
    match_status:     r.matchStatus,
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

  // ── Résumé ────────────────────────────────────────────────────────────────
  const summary = {
    total:      matchResults.length,
    matched:    matchResults.filter(r => r.matchStatus === "matched").length,
    unmatched:  matchResults.filter(r => r.matchStatus === "unmatched").length,
    excluded:   matchResults.filter(r => r.matchStatus === "excluded").length,
  }

  console.log(
    `[reconciliation/upload] type=${parseResult.type} rows=${rows.length}` +
    ` matched=${summary.matched} unmatched=${summary.unmatched} excluded=${summary.excluded}`,
  )

  // Transactions à renvoyer à l'UI (avec détails de l'entrée rapprochée)
  const transactionsForUI = matchResults.map(r => ({
    date:           r.transaction.date,
    label:          r.transaction.label,
    amount:         r.transaction.amount,
    categoryBank:   r.transaction.categoryBank,
    subCategory:    r.transaction.subCategory,
    typeOperation:  r.transaction.typeOperation,
    excluded:       r.transaction.excluded,
    excludeReason:  r.transaction.excludeReason,
    matchStatus:    r.matchStatus,
    matchScore:     r.matchScore,
    matchedEntry:   r.matchedEntry
      ? {
          id:     r.matchedEntry.id,
          date:   r.matchedEntry.date,
          label:  r.matchedEntry.label,
          amount: r.matchedEntry.amount,
          source: r.matchedEntry.source,
        }
      : null,
  }))

  return NextResponse.json({
    importId,
    type:         parseResult.type,
    filename,
    summary,
    transactions: transactionsForUI,
    parseErrors:  parseResult.errors,
  })
}
