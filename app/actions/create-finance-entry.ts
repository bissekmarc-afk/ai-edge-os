"use server"

import { randomUUID }    from "node:crypto"
import { revalidatePath } from "next/cache"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { saisieSchema }  from "@/lib/finance/saisie-schema"
import { writeSaisieEntry } from "@/lib/google-sheets/write-saisie-entry"

// ─── Return type ──────────────────────────────────────────────────────────────

export type ActionResult =
  | { status: "success"; syncStatus: "synced" | "sheet_failed"; message: string }
  | { status: "error";   errors: Partial<Record<string, string[]>> }
  | { status: "fatal";   message: string }

// ─── Server Action ────────────────────────────────────────────────────────────

export async function createFinanceEntry(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {

  // ── 1. Validate input ──────────────────────────────────────────────────────
  const parsed = saisieSchema.safeParse({
    date:          formData.get("date"),
    label:         formData.get("label"),
    category:      formData.get("category"),
    flux_nature:   formData.get("flux_nature"),
    amount:        formData.get("amount"),
    entry_subtype: formData.get("entry_subtype") ?? "",
  })

  if (!parsed.success) {
    return {
      status: "error",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const { date, label, category, flux_nature, amount, entry_subtype } = parsed.data

  // ── 2. Auth ────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient()
  if (!supabase) return { status: "fatal", message: "Supabase non disponible" }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "fatal", message: "Non authentifié" }

  // ── 3. Derive fields ───────────────────────────────────────────────────────
  const externalId = randomUUID()
  const [yearStr, monthStr] = date.split("-")
  const year  = parseInt(yearStr,  10)
  const month = parseInt(monthStr, 10)
  const now   = new Date().toISOString()

  // Cash Out → négatif / Cash In → positif
  const entryType    = flux_nature === "Cash In" ? "income" : "expense"
  const signedAmount = flux_nature === "Cash Out" ? -Math.abs(amount) : Math.abs(amount)

  // ── 4. Upsert Supabase via RPC (bypasses PostgREST schema cache) ────────────
  const { error: supabaseError } = await supabase
    .rpc("upsert_finance_entries_batch", {
      p_entries: [
        {
          user_id:       user.id,
          source:        "manual_saisie",
          external_id:   externalId,
          date,
          label,
          category,
          amount:        signedAmount,
          currency:      "EUR",
          entry_type:    entryType,
          entry_subtype: entry_subtype ?? null,
          flux_nature,
          is_non_cash:   false,
          is_subtotal:   false,
          is_recurring:  false,
          month,
          year,
          scenario:      "budget",
          validated:     true,
          sync_status:   "pending",
          synced_at:     now,
        },
      ],
    })

  if (supabaseError) {
    return { status: "fatal", message: `Erreur Supabase : ${supabaseError.message}` }
  }

  // Invalide le cache de la page /finance dès que Supabase est à jour
  revalidatePath("/finance")

  // ── 5. Append to Google Sheets SAISIE tab ──────────────────────────────────
  let syncStatus: "synced" | "sheet_failed" = "synced"
  try {
    await writeSaisieEntry({
      external_id:   externalId,
      date,
      label,
      category,
      entry_subtype: entry_subtype ?? "",
      flux_nature,
      amount:        signedAmount,
      month,
      year,
      validated:     true,
      created_at:    now,
      source:        "manual_saisie",
    })
  } catch (err) {
    console.error("[create-finance-entry] Sheets write failed:", err)
    syncStatus = "sheet_failed"
  }

  // ── 6. Update sync_status via RPC (bypasses PostgREST schema cache) ─────────
  await supabase
    .rpc("update_finance_entry_sync_status", {
      p_user_id:     user.id,
      p_external_id: externalId,
      p_sync_status: syncStatus,
    })

  return {
    status:     "success",
    syncStatus,
    message:
      syncStatus === "synced"
        ? "Entrée enregistrée et synchronisée avec Google Sheets."
        : "Entrée enregistrée dans Supabase. La synchronisation Google Sheets a échoué — elle sera réessayée au prochain sync.",
  }
}
