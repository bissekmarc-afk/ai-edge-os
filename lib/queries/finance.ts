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

  // Dernier mois ayant des données réelles (cash uniquement, même logique que getLastDataMonth)
  const lastMonth = await getLastDataMonth()
  if (!lastMonth) return null

  const { month, year } = lastMonth

  const { data, error } = await supabase
    .from("finance_entries")
    .select("amount, entry_type")
    .eq("month",       month)
    .eq("year",        year)
    .eq("is_non_cash", false)
    .eq("is_subtotal", false)

  if (error || !data || data.length === 0) return null

  const income   = data.filter((r) => r.entry_type === "income").reduce((s, r) => s + Number(r.amount), 0)
  const expenses = data.filter((r) => r.entry_type === "expense").reduce((s, r) => s + Number(r.amount), 0)

  return {
    income,
    expenses,
    balance: income - expenses,
    currency: "EUR",
    entriesCount: data.length,
    month,
    year,
  }
}
