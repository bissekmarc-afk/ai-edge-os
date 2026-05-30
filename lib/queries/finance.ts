import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getLastDataMonth } from "@/lib/finance/queries"

export interface BudgetSummary {
  income: number
  expenses: number
  balance: number
  currency: string
  entriesCount: number
  month: number
  year: number
}

export async function getBudgetSummaryFromSupabase(): Promise<BudgetSummary | null> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return null

  // Chercher le mois le plus récent ayant des données ACTUAL (pas budget/reforecast).
  // On ne passe pas par getLastDataMonth() car cette fonction ne filtre pas le scenario.
  const today  = new Date()
  const todayY = today.getFullYear()
  const todayM = today.getMonth() + 1

  const { data: monthData, error: monthError } = await supabase
    .from("finance_entries")
    .select("month, year")
    .eq("scenario",    "actual")
    .eq("is_non_cash", false)
    .eq("is_subtotal", false)
    .lte("year", todayY)
    .order("year",  { ascending: false })
    .order("month", { ascending: false })
    .limit(500)

  if (monthError || !monthData || monthData.length === 0) return null

  // Trouver le mois le plus récent ≤ aujourd'hui avec le plus d'entrées
  const counts = new Map<string, { month: number; year: number; count: number }>()
  for (const row of monthData) {
    const m = row.month as number
    const y = row.year  as number
    if (y > todayY || (y === todayY && m > todayM)) continue
    const key = `${y}-${m}`
    const entry = counts.get(key)
    if (entry) entry.count++
    else counts.set(key, { month: m, year: y, count: 1 })
  }
  if (counts.size === 0) return null

  const best = [...counts.values()].sort((a, b) => {
    const delta = (b.year * 12 + b.month) - (a.year * 12 + a.month)
    return delta !== 0 ? delta : b.count - a.count
  })[0]

  const { month, year } = best

  // Agréger revenus / dépenses pour ce mois — scenario actual uniquement
  const { data, error } = await supabase
    .from("finance_entries")
    .select("amount, entry_type")
    .eq("month",       month)
    .eq("year",        year)
    .eq("scenario",    "actual")
    .eq("is_non_cash", false)
    .eq("is_subtotal", false)

  if (error || !data || data.length === 0) return null

  const income   = data.filter((r) => r.entry_type === "income").reduce((s, r) => s + Number(r.amount), 0)
  const expenses = data.filter((r) => r.entry_type === "expense").reduce((s, r) => s + Number(r.amount), 0)

  return {
    income,
    expenses,
    balance: income - expenses,   // NCF réel du mois
    currency: "EUR",
    entriesCount: data.length,
    month,
    year,
  }
}
