"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// ─── Return type ──────────────────────────────────────────────────────────────

export type DeleteResult =
  | { status: "success" }
  | { status: "fatal"; message: string }

// ─── Server Action ────────────────────────────────────────────────────────────

export async function deleteManualFinanceEntry(id: string): Promise<DeleteResult> {
  if (!id) return { status: "fatal", message: "ID manquant" }

  // Auth — user_id depuis session uniquement
  const supabase = await createSupabaseServerClient()
  if (!supabase) return { status: "fatal", message: "Supabase non disponible" }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "fatal", message: "Non authentifié" }

  // Suppression logique — scoped à user_id + source pour éviter tout accès cross-user
  const { error } = await supabase
    .from("finance_entries")
    .update({ sync_status: "deleted" })
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
