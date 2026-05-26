"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { saisieSchema } from "@/lib/finance/saisie-schema"

// ─── Return type ──────────────────────────────────────────────────────────────

export type UpdateResult =
  | { status: "success" }
  | { status: "error";   errors: Partial<Record<string, string[]>> }
  | { status: "fatal";   message: string }

// ─── Server Action ────────────────────────────────────────────────────────────

export async function updateManualFinanceEntry(
  _prev: UpdateResult | null,
  formData: FormData,
): Promise<UpdateResult> {

  // ── 1. Row ID (from hidden field, never trusted for auth) ─────────────────
  const id = formData.get("id")
  if (typeof id !== "string" || !id) {
    return { status: "fatal", message: "ID manquant" }
  }

  // ── 2. Validate editable fields ───────────────────────────────────────────
  const parsed = saisieSchema.safeParse({
    date:          formData.get("date"),
    label:         formData.get("label"),
    category:      formData.get("category"),
    flux_nature:   formData.get("flux_nature"),
    amount:        formData.get("amount"),
    entry_subtype: formData.get("entry_subtype") ?? "",
  })

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors }
  }

  const { date, label, category, flux_nature, amount, entry_subtype } = parsed.data

  // ── 3. Auth — user_id depuis session uniquement ───────────────────────────
  const supabase = await createSupabaseServerClient()
  if (!supabase) return { status: "fatal", message: "Supabase non disponible" }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "fatal", message: "Non authentifié" }

  // ── 4. Derive fields ──────────────────────────────────────────────────────
  const [yearStr, monthStr] = date.split("-")
  const year  = parseInt(yearStr,  10)
  const month = parseInt(monthStr, 10)

  const entryType    = flux_nature === "Cash In" ? "income" : "expense"
  const signedAmount = flux_nature === "Cash Out" ? -Math.abs(amount) : Math.abs(amount)

  // ── 5. Update — scoped to user_id + source (non-modifiables inchangés) ────
  const { error } = await supabase
    .from("finance_entries")
    .update({
      date,
      label,
      category,
      entry_subtype: entry_subtype ?? null,
      flux_nature,
      amount:        signedAmount,
      entry_type:    entryType,
      month,
      year,
    })
    .eq("id",      id)
    .eq("user_id", user.id)
    .eq("source",  "manual_saisie")

  if (error) {
    return { status: "fatal", message: `Erreur Supabase : ${error.message}` }
  }

  revalidatePath("/finance")
  revalidatePath("/saisie")

  return { status: "success" }
}
