import { createSupabaseServerClient } from "@/lib/supabase/server"

export interface BudgetSummary {
  income: number
  expenses: number
  balance: number
  currency: string
  entriesCount: number
}

export async function getBudgetSummaryFromSupabase(month?: string): Promise<BudgetSummary | null> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return null

  // Default to current month
  const target = month ?? new Date().toISOString().slice(0, 7) // "YYYY-MM"
  const from = `${target}-01`
  const to   = `${target}-31`

  const { data, error } = await supabase
    .from("finance_entries")
    .select("amount, entry_type")
    .gte("date", from)
    .lte("date", to)

  if (error || !data || data.length === 0) return null

  const income   = data.filter((r) => r.entry_type === "income").reduce((s, r) => s + Number(r.amount), 0)
  const expenses = data.filter((r) => r.entry_type === "expense").reduce((s, r) => s + Number(r.amount), 0)

  return {
    income,
    expenses,
    balance: income - expenses,
    currency: "EUR",
    entriesCount: data.length,
  }
}
