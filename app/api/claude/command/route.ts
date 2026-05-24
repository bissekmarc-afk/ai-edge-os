import Anthropic from "@anthropic-ai/sdk"
import { getTasksFromSupabase } from "@/lib/queries/tasks"
import { getBudgetSummaryFromSupabase } from "@/lib/queries/finance"
import { getConfirmedMemories } from "@/lib/queries/memory"

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

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

  const budgetText = budget
    ? `Revenus : ${budget.income} ${budget.currency} · Dépenses : ${budget.expenses} ${budget.currency} · Solde : ${budget.balance} ${budget.currency} (${budget.entriesCount} entrées)`
    : "Données budget non disponibles."

  const memoriesText =
    memories.length === 0
      ? "Aucune mémoire enregistrée."
      : memories
          .map((m) => `- [${m.category}] ${m.title} : ${m.content}`)
          .join("\n")

  return `Tu es l'assistant personnel de l'utilisateur, intégré dans son OS personnel (AI Edge OS). Aujourd'hui : ${today}.

## Contexte — Mémoire personnelle
${memoriesText}

## Contexte — Top 5 tâches prioritaires
${tasksText}

## Contexte — Budget du mois en cours
${budgetText}

Réponds en français, de façon concise et directe. Utilise les données ci-dessus pour donner des réponses personnalisées et pertinentes. Si la question ne concerne pas ces données, réponds normalement.`
}

export async function POST(request: Request) {
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
