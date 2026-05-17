"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function signInWithPassword(
  formData: FormData
): Promise<string | null> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) return "Email et mot de passe requis."

  const supabase = await createSupabaseServerClient()
  if (!supabase) return "Configuration Supabase manquante."

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return error.message

  revalidatePath("/", "layout")
  redirect("/")
}

export async function signInWithOtp(
  formData: FormData
): Promise<string | null> {
  const email = formData.get("email") as string
  if (!email) return "Email requis."

  const supabase = await createSupabaseServerClient()
  if (!supabase) return "Configuration Supabase manquante."

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  })

  if (error) return error.message
  return null
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  if (supabase) await supabase.auth.signOut()
  redirect("/login")
}
