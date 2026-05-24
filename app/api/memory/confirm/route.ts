import { NextResponse } from "next/server"
import { getSupabaseUser, createSupabaseServerClient } from "@/lib/supabase/server"

const VALID_CATEGORIES = ["general", "goals", "habits", "preferences", "projects", "personal"] as const
const VALID_SENSITIVITY = ["low", "medium", "high"] as const

export async function POST(request: Request) {
  const user = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
  }

  const title = typeof body.title === "string" ? body.title.trim() : ""
  const content = typeof body.content === "string" ? body.content.trim() : ""
  const category = typeof body.category === "string" ? body.category : "general"
  const source = typeof body.source === "string" ? body.source : "claude"
  const sensitivityLevel = VALID_SENSITIVITY.includes(body.sensitivity_level as typeof VALID_SENSITIVITY[number])
    ? (body.sensitivity_level as string)
    : "low"
  const confidenceScore =
    typeof body.confidence_score === "number" &&
    body.confidence_score >= 0 &&
    body.confidence_score <= 1
      ? body.confidence_score
      : 0.9

  if (!title || !content) {
    return NextResponse.json({ error: "Titre et contenu requis" }, { status: 400 })
  }
  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non disponible" }, { status: 503 })
  }

  const { data, error } = await supabase
    .from("ai_memory")
    .insert({
      user_id: user.id,
      title,
      content,
      category,
      source,
      sensitivity_level: sensitivityLevel,
      confidence_score: confidenceScore,
      confirmed_by_user: true,
    })
    .select("id")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}

export async function DELETE(request: Request) {
  const user = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  let id: string
  try {
    const body = await request.json()
    id = typeof body.id === "string" ? body.id.trim() : ""
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
  }

  if (!id) {
    return NextResponse.json({ error: "ID manquant" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non disponible" }, { status: 503 })
  }

  const { error } = await supabase
    .from("ai_memory")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
