import { NextResponse } from "next/server"
import { getSupabaseUser } from "@/lib/supabase/server"
import { getAllMemories } from "@/lib/queries/memory"

export async function GET() {
  const user = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const memories = await getAllMemories(50)
  return NextResponse.json({ memories })
}
