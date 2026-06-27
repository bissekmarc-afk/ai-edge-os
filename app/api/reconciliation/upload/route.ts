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
  const transactions = debits.map(t => ({
    date:         t.date,
    label:        t.label,
    amount:       t.amount,
    categoryBank: t.categoryBank,
  }))

  // ── Contrôle d'exhaustivité ───────────────────────────────────────────────
  //
  // bankExpenses  = sum(abs(bank_transactions.amount < 0)) — tous types ce mois
  // actualExpenses = sum(abs(finance_entries.amount))
  //                 WHERE source='manual_saisie' AND scenario='actual'
  //                 AND entry_type='expense' AND category NOT IN ('Tax','Taxes')
  // Si les deux CSV présents → coverage complet.
  // Si un seul → message "Couverture partielle".

  type Coverage = {
    month:               number
    year:                number
    currentMonthPartial: boolean
    bothTypesPresent:    boolean  // carte + compte ont des bank_transactions ce mois
    bankExpenses:        number
    actualExpenses:      number
    gap:                 number
    coverageRatio:       number
  }

  let coverage: Coverage | null = null

  if (debits.length > 0) {
    // Derive the primary month from the filename end-date token (most reliable).
    // SG filenames embed two DDMMYYYY dates: e.g. carte_2267_29052026_26062026.csv
    // or 76543210_27052026_25062026.csv.  The last 8-digit group is the end date.
    // Fall back to the last transaction date when the filename has no such token.
    let primaryKey: string | undefined
    const dateTokens = filename.match(/\d{8}/g)
    if (dateTokens && dateTokens.length >= 2) {
      const endToken = dateTokens.at(-1)!          // e.g. "26062026"
      const endMonth = endToken.slice(2, 4)         // "06"
      const endYear  = endToken.slice(4, 8)         // "2026"
      primaryKey = `${endYear}-${endMonth}`         // "2026-06"
    }
    if (!primaryKey) {
      const lastDate = debits.map(t => t.date).sort().at(-1)
      primaryKey = lastDate?.slice(0, 7)
    }

    if (primaryKey) {
      const [yearStr, monthStr] = primaryKey.split("-")
      const txMonth = parseInt(monthStr, 10)
      const txYear  = parseInt(yearStr,  10)
      console.log("[coverage] mois détecté:", txMonth, txYear)
      const mm      = String(txMonth).padStart(2, "0")
      const lastDay = new Date(txYear, txMonth, 0).getDate() // day-0 of next month = last day of txMonth
      const dateMin = `${txYear}-${mm}-01`
      const dateMax = `${txYear}-${mm}-${String(lastDay).padStart(2, "0")}`
      console.log("[coverage] plage:", dateMin, "→", dateMax)

      // Req 1 : bank_transactions du mois (tous types)
      const { data: btMonth, error: btError } = await supabase
        .from("bank_transactions")
        .select("import_id, amount")
        .eq("user_id", user.id)
        .gte("date", dateMin)
        .lte("date", dateMax)

      if (btError) console.error("[coverage] Req1 error:", btError.message)
      const monthImportIds = [...new Set((btMonth ?? []).map(r => r.import_id as string))]
      const bankExpenses   = Math.round(
        (btMonth ?? [])
          .filter(r => Number(r.amount) < 0)
          .reduce((s, r) => s + Math.abs(Number(r.amount)), 0) * 100,
      ) / 100

      // Req 2 : vérifier si les deux types (carte + compte) sont présents
      let bothTypesPresent = false
      if (monthImportIds.length > 0) {
        const { data: importsData } = await supabase
          .from("csv_imports")
          .select("type")
          .in("id", monthImportIds)
          .eq("user_id", user.id)
        const types = new Set((importsData ?? []).map(i => i.type as string))
        console.log("[coverage] imports confirmés:", [...types])
        bothTypesPresent = types.has("carte") && types.has("compte")
      }

      // Req 3 : saisies manuelles (source='manual_saisie') — toutes catégories incluses
      const { data: feData, error: feError } = await supabase
        .from("finance_entries")
        .select("amount")
        .eq("user_id",     user.id)
        .eq("scenario",    "actual")
        .eq("source",      "manual_saisie")
        .eq("entry_type",  "expense")
        .eq("is_non_cash", false)
        .eq("is_subtotal", false)
        .eq("month",       txMonth)
        .eq("year",        txYear)
        .or("sync_status.neq.deleted,sync_status.is.null")

      if (!feError && feData) {
        const actualExpenses = Math.round(
          feData.reduce((s, r) => s + Math.abs(Number(r.amount)), 0) * 100,
        ) / 100

        const gap           = Math.round((bankExpenses - actualExpenses) * 100) / 100
        const coverageRatio = bankExpenses > 0
          ? Math.round((actualExpenses / bankExpenses) * 1000) / 1000
          : 0

        const now = new Date()
        coverage = {
          month: txMonth, year: txYear,
          currentMonthPartial: txMonth === (now.getMonth() + 1) && txYear === now.getFullYear(),
          bothTypesPresent,
          bankExpenses, actualExpenses, gap, coverageRatio,
        }

        console.log(
          `[coverage] ${txYear}-M${txMonth} both=${bothTypesPresent}` +
          ` bank=${bankExpenses}€ actual=${actualExpenses}€ gap=${gap}€ ratio=${(coverageRatio * 100).toFixed(1)}%`,
        )
      }
    }
  }

  return NextResponse.json({
    importId,
    type:              parseResult.type,
    filename,
    totalSpent,
    totalTransactions: debits.length,
    period,
    summary,
    transactions,
    coverage,
    parseErrors: parseResult.errors,
  })
}
