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

// ── Périmètres du coverage bancaire ──────────────────────────────────────────
//
// CARTE → dépenses variables : transactions CB = Food, Leisure, Transport, Health, Personal
// COMPTE → dépenses fixes    : virements/prélèvements = Housing, Debt Repayments
//
// Exclure complètement : Tax, Investment, Savings, Odd, Income
// (déduites à la source ou hors périmètre bancaire direct)

const CARTE_CATEGORIES = new Set([
  "food",
  "leisure",
  "personal",
  "shopping",
  "transport",
  "health",
  "big & one-offs",
  "big one-offs",
  "one-off",
  "gifts",
  "gift",
])

const COMPTE_CATEGORIES = new Set([
  "housing",
  "debt",
  "debt repayments",
  "debt repayment",
  "loan repayments",
  "loan repayment",
])

function normCat(cat: string | null): string {
  return (cat ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

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

  // ── Contrôle d'exhaustivité par périmètre ────────────────────────────────
  //
  // CARTE  → bank_transactions[type=carte]  vs finance_entries CARTE_CATEGORIES
  // COMPTE → bank_transactions[type=compte] vs finance_entries COMPTE_CATEGORIES
  // Exclus (Tax, Investment, Odd, Income) → jamais comptabilisés.

  type SubBlock = {
    bankExpenses:   number
    actualExpenses: number
    gap:            number
    coverageRatio:  number
  }

  type Coverage = {
    month:               number
    year:                number
    currentMonthPartial: boolean
    carte:               SubBlock
    compte:              SubBlock
  }

  let coverage: Coverage | null = null

  if (debits.length > 0) {
    // Mois primaire
    const monthSums = new Map<string, number>()
    for (const t of debits) {
      monthSums.set(t.date.slice(0, 7), (monthSums.get(t.date.slice(0, 7)) ?? 0) + Math.abs(t.amount))
    }
    const primaryKey = [...monthSums.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

    if (primaryKey) {
      const [yearStr, monthStr] = primaryKey.split("-")
      const txMonth = parseInt(monthStr, 10)
      const txYear  = parseInt(yearStr,  10)
      const dateMin = `${txYear}-${String(txMonth).padStart(2,"0")}-01`
      const dateMax = `${txYear}-${String(txMonth).padStart(2,"0")}-31`

      // Req 1 : bank_transactions du mois
      const { data: btMonth } = await supabase
        .from("bank_transactions")
        .select("import_id, amount")
        .eq("user_id", user.id)
        .gte("date", dateMin)
        .lte("date", dateMax)

      const monthImportIds = [...new Set((btMonth ?? []).map(r => r.import_id as string))]

      // Req 2 : types des imports
      const importTypeMap = new Map<string, string>()
      if (monthImportIds.length > 0) {
        const { data: importsData } = await supabase
          .from("csv_imports")
          .select("id, type")
          .in("id", monthImportIds)
          .eq("user_id", user.id)
        for (const i of importsData ?? []) {
          importTypeMap.set(i.id as string, i.type as string)
        }
      }

      const btRows = btMonth ?? []
      const sumDebits = (type: string) =>
        Math.round(
          btRows
            .filter(r => Number(r.amount) < 0 && importTypeMap.get(r.import_id as string) === type)
            .reduce((s, r) => s + Math.abs(Number(r.amount)), 0) * 100,
        ) / 100

      const carteDebits  = sumDebits("carte")
      const compteDebits = sumDebits("compte")

      // Req 3 : finance_entries actual du mois (category incluse)
      const { data: feData, error: feError } = await supabase
        .from("finance_entries")
        .select("amount, category")
        .eq("user_id",     user.id)
        .eq("scenario",    "actual")
        .eq("entry_type",  "expense")
        .eq("is_non_cash", false)
        .eq("is_subtotal", false)
        .eq("month",       txMonth)
        .eq("year",        txYear)
        .or("sync_status.neq.deleted,sync_status.is.null")

      if (!feError && feData) {
        const sumFe = (set: Set<string>) =>
          Math.round(
            feData
              .filter(r => set.has(normCat(r.category as string | null)))
              .reduce((s, r) => s + Math.abs(Number(r.amount)), 0) * 100,
          ) / 100

        const carteActual  = sumFe(CARTE_CATEGORIES)
        const compteActual = sumFe(COMPTE_CATEGORIES)

        const block = (bank: number, actual: number): SubBlock => ({
          bankExpenses:   bank,
          actualExpenses: actual,
          gap:            Math.round((bank - actual) * 100) / 100,
          coverageRatio:  bank > 0 ? Math.round((actual / bank) * 1000) / 1000 : 0,
        })

        const now = new Date()
        const currentMonthPartial =
          txMonth === (now.getMonth() + 1) && txYear === now.getFullYear()

        coverage = {
          month: txMonth, year: txYear, currentMonthPartial,
          carte:  block(carteDebits,  carteActual),
          compte: block(compteDebits, compteActual),
        }

        console.log(
          `[coverage] ${txYear}-M${txMonth}` +
          ` carte: bank=${carteDebits}€ actual=${carteActual}€ gap=${coverage.carte.gap}€` +
          ` compte: bank=${compteDebits}€ actual=${compteActual}€ gap=${coverage.compte.gap}€`,
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
