import Anthropic from "@anthropic-ai/sdk"
import { getSupabaseUser } from "@/lib/supabase/server"
import { getTasksFromSupabase } from "@/lib/queries/tasks"
import { getBudgetSummaryFromSupabase } from "@/lib/queries/finance"
import { getConfirmedMemories } from "@/lib/queries/memory"

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

function sortTasks<T extends { priority: string; dueDate: string }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4)
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    const dateDiff = a.dueDate.localeCompare(b.dueDate)
    if (dateDiff !== 0) return dateDiff
    return (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4)
  })
}

function buildSystemPrompt(
  tasks: Awaited<ReturnType<typeof getTasksFromSupabase>>,
  budget: Awaited<ReturnType<typeof getBudgetSummaryFromSupabase>>,
  memories: Awaited<ReturnType<typeof getConfirmedMemories>>,
): string {
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const tasksText =
    tasks.length === 0
      ? "Aucune tâche en cours."
      : tasks
          .map((t, i) => {
            const due = t.dueDate ? ` (échéance : ${t.dueDate})` : ""
            return `${i + 1}. [${t.priority.toUpperCase()}] ${t.title}${due} — ${t.projectName}`
          })
          .join("\n")

  const budgetLabel = budget
    ? `${MONTHS_FR[budget.month - 1]} ${budget.year}`
    : null
  const budgetText = budget
    ? `${budgetLabel} — Revenus : ${budget.income} ${budget.currency} · Dépenses : ${budget.expenses} ${budget.currency} · Solde : ${budget.balance} ${budget.currency} (${budget.entriesCount} entrées cash)`
    : "Données budget non disponibles."

  const memoriesText =
    memories.length === 0
      ? "Aucune mémoire enregistrée."
      : memories
          .map((m) => `- [${m.category}] ${m.title} : ${m.content}`)
          .join("\n")

  return `Tu es l'assistant personnel de l'utilisateur, intégré dans son OS personnel (AI Edge OS). Aujourd'hui : ${today}.

## Règles strictes — OBLIGATOIRES

1. **Utilise UNIQUEMENT les données fournies ci-dessous.** Ne complète jamais avec tes connaissances d'entraînement pour des données personnelles.
2. **Si une donnée personnelle est absente du contexte** (ex. : streak, gym, lecture, habitudes, Notion, sommeil, sport), réponds exactement : "données non disponibles" — ne l'invente pas, ne l'estime pas, ne la déduis pas.
3. **Les seules sources de données disponibles sont :**
   - Tâches : synchronisées depuis Todoist (tasks_sync) — titre, priorité, échéance, projet
   - Budget : entrées financières du mois en cours (finance_entries) — revenus, dépenses, solde
   - Mémoires : notes confirmées manuellement par l'utilisateur (memories)
4. **Ne mentionne jamais** streak de lecture, séances gym, suivi d'habitudes, sync Notion, ou toute autre donnée qui n'apparaît pas explicitement dans le contexte ci-dessous.
5. Pour les questions générales (définitions, calculs, rédaction), réponds normalement — cette restriction ne s'applique qu'aux données personnelles de l'utilisateur.

## Contexte — Mémoire personnelle
${memoriesText}

## Contexte — Top 5 tâches prioritaires
${tasksText}

## Contexte — Budget${budgetLabel ? ` (${budgetLabel})` : ""}
${budgetText}

Réponds en français, de façon concise et directe.`
}

export async function POST(request: Request) {
  // ── Auth — must precede any external API call ──────────────────────────────
  const user = await getSupabaseUser()
  if (!user) {
    return Response.json({ error: "Non authentifié" }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    return Response.json({ error: "ANTHROPIC_API_KEY non configurée" }, { status: 503 })
  }

  const client = new Anthropic({ apiKey })

  let query: string
  try {
    const body = await request.json()
    query = typeof body.query === "string" ? body.query.trim() : ""
  } catch {
    return Response.json({ error: "Corps de requête invalide" }, { status: 400 })
  }

  if (!query) {
    return Response.json({ error: "Requête vide" }, { status: 400 })
  }

  const [rawTasks, budget, memories] = await Promise.all([
    getTasksFromSupabase(10),
    getBudgetSummaryFromSupabase(),
    getConfirmedMemories(10),
  ])
  const tasks = sortTasks(rawTasks).slice(0, 5)

  const systemPrompt = buildSystemPrompt(tasks, budget, memories)

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: query }],
  })

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
    async cancel() {
      await stream.finalMessage().catch(() => {})
    },
  })

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
