"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function completeTask(taskId: string): Promise<void> {
  if (!taskId) throw new Error("taskId requis")

  const supabase = await createSupabaseServerClient()
  if (!supabase) throw new Error("Supabase non disponible")

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Non authentifié")

  const { error } = await supabase
    .from("tasks_sync")
    .update({ is_completed: true })
    .eq("id", taskId)
    .eq("user_id", user.id)

  if (error) throw new Error(error.message)

  revalidatePath("/tasks")
}
