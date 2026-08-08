// POST /api/finance/create-reforecast
//
// 1. Supprime les lignes reforecast_6m pour months 8-12, year 2026
// 2. Copie les lignes budget_initial correspondantes → scenario reforecast_6m
// 3. Ajuste les montants : Transport → 180€/mois, Leisure → 300€/mois
//    (distribution proportionnelle sur les sous-catégories)
// 4. Insère via upsert_finance_entries_batch (bypass PostgREST schema cache)

import { randomUUID }   from "node:crypto"
import { NextResponse } from "next/server"
import { getSupabaseUser, createSupabaseServerClient } from "@/lib/supabase/server"

const YEAR   = 2026
const MONTHS = [8, 9, 10, 11, 12] as const

// Cibles mensuelles par catégorie (valeur absolue, dépense)
const CATEGORY_TARGETS: Record<string, number> = {
  Transport: 180,
  Leisure:   300,
}

type BudgetRow = {
  id:            string
  category:      string
  label:         string
  amount:        number
  entry_type:    string
  entry_subtype: string | null
  flux_nature:   string | null
  is_non_cash:   boolean
  is_subtotal:   boolean
  is_recurring:  boolean
  month:         number
  year:          number
  currency:      string | null
}

export async function POST() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 })
  }

  const userId = user.id

  // ── 1. Suppression des reforecast_6m existants ────────────────────────────
  const { error: deleteError } = await supabase
    .from("finance_entries")
    .delete()
    .eq("user_id", userId)
    .eq("scenario", "reforecast_6m")
    .in("month", MONTHS)
    .eq("year",  YEAR)

  if (deleteError) {
    console.error("[create-reforecast] delete error:", deleteError.message)
    return NextResponse.json({ error: `Suppression échouée : ${deleteError.message}` }, { status: 500 })
  }

  // ── 2. Lecture des lignes budget_initial ──────────────────────────────────
  const { data: budgetRows, error: fetchError } = await supabase
    .from("finance_entries")
    .select(
      "id, category, label, amount, entry_type, entry_subtype, flux_nature, " +
      "is_non_cash, is_subtotal, is_recurring, month, year, currency",
    )
    .eq("user_id", userId)
    .eq("scenario", "budget_initial")
    .in("month", MONTHS)
    .eq("year",  YEAR)
    .neq("sync_status", "deleted")

  if (fetchError) {
    console.error("[create-reforecast] fetch error:", fetchError.message)
    return NextResponse.json({ error: `Lecture budget_initial échouée : ${fetchError.message}` }, { status: 500 })
  }

  if (!budgetRows || budgetRows.length === 0) {
    return NextResponse.json(
      { error: "Aucune ligne budget_initial trouvée pour H2 2026" },
      { status: 404 },
    )
  }

  // ── 3. Ajustement proportionnel des catégories cibles ─────────────────────
  //
  // On travaille sur une copie mutable des montants.
  // Pour chaque catégorie cible et chaque mois :
  //   - Calculer la somme absolue des lignes non-subtotal
  //   - Scaler chaque ligne → total = targetTotal
  //   - Recalculer la ligne is_subtotal si elle existe

  const rows: (BudgetRow & { adjustedAmount: number })[] = (budgetRows as unknown as BudgetRow[]).map(r => ({
    ...r,
    adjustedAmount: r.amount,
  }))

  for (const [category, targetTotal] of Object.entries(CATEGORY_TARGETS)) {
    for (const month of MONTHS) {
      const nonSubtotal = rows.filter(
        r => r.category === category && r.month === month && !r.is_subtotal,
      )
      const totalAbs = nonSubtotal.reduce((s, r) => s + Math.abs(r.amount), 0)

      if (totalAbs === 0 || nonSubtotal.length === 0) continue

      const scale = targetTotal / totalAbs

      for (const r of nonSubtotal) {
        r.adjustedAmount = Math.round(r.amount * scale * 100) / 100
      }

      // Recalculer is_subtotal → signe conservé, montant = targetTotal
      const subtotal = rows.find(
        r => r.category === category && r.month === month && r.is_subtotal,
      )
      if (subtotal) {
        const sign = subtotal.amount <= 0 ? -1 : 1
        subtotal.adjustedAmount = sign * targetTotal
      }
    }
  }

  // ── 4. Construction du payload pour upsert_finance_entries_batch ──────────
  const now     = new Date().toISOString()
  const payload = rows.map(r => ({
    user_id:       userId,
    source:        "reforecast_6m",
    external_id:   randomUUID(),
    date:          `${YEAR}-${String(r.month).padStart(2, "0")}-01`,
    category:      r.category,
    label:         r.label,
    amount:        r.adjustedAmount,
    currency:      r.currency ?? "EUR",
    entry_type:    r.entry_type,
    entry_subtype: r.entry_subtype ?? null,
    flux_nature:   r.flux_nature ?? null,
    is_non_cash:   r.is_non_cash  ?? false,
    is_subtotal:   r.is_subtotal  ?? false,
    is_recurring:  r.is_recurring ?? false,
    month:         r.month,
    year:          r.year,
    scenario:      "reforecast_6m",
    validated:     true,
    sync_status:   "synced",
    synced_at:     now,
  }))

  // ── 5. Insert via RPC (bypass PostgREST schema cache) ─────────────────────
  const { data: inserted, error: rpcError } = await supabase
    .rpc("upsert_finance_entries_batch", { p_entries: payload })

  if (rpcError) {
    console.error("[create-reforecast] rpc error:", rpcError.message)
    return NextResponse.json({ error: `Insertion échouée : ${rpcError.message}` }, { status: 500 })
  }

  console.log(
    `[create-reforecast] user=${userId.slice(0, 8)}… ` +
    `deleted+reinserted=${payload.length} rows (${inserted} affected) ` +
    `months=[${MONTHS.join(",")}] year=${YEAR}`,
  )

  return NextResponse.json({
    ok:       true,
    inserted: inserted as number,
    rows:     payload.length,
    months:   MONTHS,
    year:     YEAR,
    adjustments: Object.entries(CATEGORY_TARGETS).map(([cat, target]) => ({
      category: cat, targetPerMonth: target,
    })),
  })
}
