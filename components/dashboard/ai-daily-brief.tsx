"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const BRIEF_PROMPT =
  "Donne-moi un brief concis du jour : mes tâches prioritaires et ma situation budget du mois. " +
  "Sois direct et factuel, maximum 3 phrases. " +
  "Si les données sont absentes, dis-le clairement sans inventer."

export function AIDailyBrief() {
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchBrief() {
      try {
        const res = await fetch("/api/claude/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: BRIEF_PROMPT }),
        })

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}))
          if (!cancelled) {
            setError(
              (data as { error?: string }).error ??
                "Erreur lors du chargement du brief.",
            )
            setLoading(false)
          }
          return
        }

        if (!cancelled) setLoading(false)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done || cancelled) break
          setContent((prev) => prev + decoder.decode(value, { stream: true }))
        }
      } catch {
        if (!cancelled) {
          setError("Impossible de joindre l'API Claude.")
          setLoading(false)
        }
      }
    }

    fetchBrief()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card className="border-[var(--ai-accent-soft)] bg-[var(--panel-background)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-[var(--ai-accent)]" />
          Brief IA du jour
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && !content && (
          <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
            <span className="flex gap-1">
              <span className="inline-block size-1.5 animate-bounce rounded-full bg-[var(--ai-accent)] [animation-delay:0ms]" />
              <span className="inline-block size-1.5 animate-bounce rounded-full bg-[var(--ai-accent)] [animation-delay:150ms]" />
              <span className="inline-block size-1.5 animate-bounce rounded-full bg-[var(--ai-accent)] [animation-delay:300ms]" />
            </span>
            Claude prépare votre brief…
          </div>
        )}
        {error && !content && (
          <p className="text-sm text-muted-foreground">{error}</p>
        )}
        {content && (
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {content}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
