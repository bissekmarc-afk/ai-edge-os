import { Brain, Sparkles } from "lucide-react"
import { getAllMemories } from "@/lib/queries/memory"
import { SectionHeading } from "@/components/shared/section-heading"
import type { MemoryEntry } from "@/types"

const CATEGORY_META: Record<string, { label: string; className: string }> = {
  general:     { label: "Général",      className: "bg-muted text-muted-foreground" },
  goals:       { label: "Objectifs",    className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  habits:      { label: "Habitudes",    className: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" },
  preferences: { label: "Préférences", className: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  projects:    { label: "Projets",      className: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  personal:    { label: "Personnel",   className: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300" },
}

function categoryMeta(category: string) {
  return CATEGORY_META[category] ?? { label: category, className: "bg-muted text-muted-foreground" }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function MemoryCard({ memory }: { memory: MemoryEntry }) {
  const meta = categoryMeta(memory.category)
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-[var(--panel-border)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-foreground leading-snug">{memory.title}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
        >
          {meta.label}
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{memory.content}</p>
      <p className="text-xs text-muted-foreground/60">{formatDate(memory.createdAt)}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Brain className="size-7" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Aucun souvenir enregistré</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Utilise la barre IA en bas pour parler à Claude. Il proposera automatiquement des entrées mémoire à confirmer.
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
        <Sparkles className="size-3" />
        <span>Les souvenirs enrichissent le contexte de chaque conversation</span>
      </div>
    </div>
  )
}

export default async function MemoryPage() {
  const memories = await getAllMemories(50)
  const confirmed = memories.filter((m) => m.confirmedByUser)

  const byCategory = confirmed.reduce<Record<string, MemoryEntry[]>>((acc, m) => {
    ;(acc[m.category] ??= []).push(m)
    return acc
  }, {})

  const categoryOrder = ["personal", "goals", "projects", "habits", "preferences", "general"]
  const sortedCategories = categoryOrder.filter((c) => byCategory[c]?.length)

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Mémoire"
        description={
          confirmed.length === 0
            ? "Base de connaissances personnelle — aucune entrée pour l'instant"
            : `${confirmed.length} souvenir${confirmed.length > 1 ? "s" : ""} confirmé${confirmed.length > 1 ? "s" : ""}`
        }
      />

      {confirmed.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-8">
          {sortedCategories.map((cat) => {
            const meta = categoryMeta(cat)
            const items = byCategory[cat]
            return (
              <section key={cat}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {items.length} entrée{items.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((m) => (
                    <MemoryCard key={m.id} memory={m} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
