"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, X, Sparkles, ChevronUp, Check, Brain } from "lucide-react"
import { cn } from "@/lib/utils"

const QUICK_COMMANDS = [
  { id: "q1", label: "Brief du jour",  prompt: "Donne-moi un résumé de mes priorités pour aujourd'hui." },
  { id: "q2", label: "Revue semaine",  prompt: "Aide-moi à faire ma revue de la semaine." },
  { id: "q3", label: "Budget du mois", prompt: "Analyse ma situation budget du mois en cours." },
]

interface AICommandBarProps {
  marginLeft: number
}

interface MemorySuggestion {
  title: string
  content: string
  category: string
}

export function AICommandBar({ marginLeft }: AICommandBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [response, setResponse] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [suggestions, setSuggestions] = useState<MemorySuggestion[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const closeBar = useCallback(() => {
    setIsOpen(false)
    setResponse("")
    setQuery("")
    setSuggestions([])
    setIsAnalyzing(false)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeBar()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [closeBar])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeBar()
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen, closeBar])

  function openBar() {
    setIsOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function fetchMemorySuggestions(prompt: string, claudeResponse: string) {
    setIsAnalyzing(true)
    try {
      const res = await fetch("/api/memory/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: prompt, response: claudeResponse }),
      })
      if (res.ok) {
        const { suggestions: s } = await res.json()
        if (Array.isArray(s) && s.length > 0) setSuggestions(s)
      }
    } catch {
      // silent — suggestions are optional
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function askClaude(prompt: string) {
    if (!prompt.trim()) return
    setIsTyping(true)
    setResponse("")
    setSuggestions([])
    setIsAnalyzing(false)

    try {
      const res = await fetch("/api/claude/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: prompt }),
      })

      if (!res.ok || !res.body) {
        const { error } = await res.json().catch(() => ({ error: "Erreur inconnue" }))
        setResponse(error ?? "Erreur lors de la requête")
        setIsTyping(false)
        return
      }

      setIsTyping(false)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setResponse(text)
      }

      // Analyse la conversation pour proposer des souvenirs
      if (text) fetchMemorySuggestions(prompt, text)
    } catch (err) {
      console.error("[ai-command-bar] fetch error:", err)
      setResponse("Impossible de joindre l'API Claude.")
      setIsTyping(false)
    }
  }

  async function handleConfirmMemory(index: number) {
    const suggestion = suggestions[index]
    setSuggestions((prev) => prev.filter((_, i) => i !== index))
    try {
      await fetch("/api/memory/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(suggestion),
      })
    } catch {
      // silent
    }
  }

  function handleDismissSuggestion(index: number) {
    setSuggestions((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    askClaude(query)
  }

  function handleQuickCommand(prompt: string) {
    setQuery(prompt)
    setIsOpen(true)
    askClaude(prompt)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div
      ref={containerRef}
      style={{ left: marginLeft }}
      className={cn(
        "fixed bottom-0 right-0 z-50 border-t border-[var(--panel-border)] bg-[var(--panel-background)] backdrop-blur-sm transition-[left] duration-200"
      )}
    >
      {isOpen && (
        <div className="border-b border-[var(--panel-border)] px-4 py-1">
          {isTyping && (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <span className="flex gap-1">
                <span className="inline-block size-1.5 animate-bounce rounded-full bg-[var(--ai-accent)] [animation-delay:0ms]" />
                <span className="inline-block size-1.5 animate-bounce rounded-full bg-[var(--ai-accent)] [animation-delay:150ms]" />
                <span className="inline-block size-1.5 animate-bounce rounded-full bg-[var(--ai-accent)] [animation-delay:300ms]" />
              </span>
              Claude réfléchit…
            </div>
          )}

          {response && !isTyping && (
            <div className="max-h-[120px] overflow-y-auto py-2 text-sm text-foreground leading-relaxed">
              {response}
            </div>
          )}

          {isAnalyzing && !isTyping && (
            <p className="pb-1 text-xs italic text-muted-foreground/60">
              Analyse de la conversation…
            </p>
          )}

          {suggestions.length > 0 && (
            <div className="border-t border-[var(--panel-border)] pt-2 pb-1">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Brain className="size-3 text-[var(--ai-accent)]" />
                <span className="text-xs font-medium text-muted-foreground">
                  Mémoriser ?
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5"
                  >
                    <span className="flex-1 truncate text-xs text-foreground">
                      {s.title}
                    </span>
                    <span className="shrink-0 rounded px-1 py-0.5 text-[10px] text-muted-foreground bg-muted">
                      {s.category}
                    </span>
                    <button
                      onClick={() => handleConfirmMemory(i)}
                      aria-label="Confirmer"
                      className="flex size-5 shrink-0 items-center justify-center rounded text-emerald-600 transition-colors hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-950"
                    >
                      <Check className="size-3" />
                    </button>
                    <button
                      onClick={() => handleDismissSuggestion(i)}
                      aria-label="Ignorer"
                      className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex h-14 items-center gap-2 px-4">
        <Sparkles className="size-4 shrink-0 text-[var(--ai-accent)]" />

        {isOpen ? (
          <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Demande quelque chose à Claude…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button
              type="submit"
              aria-label="Envoyer"
              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--ai-accent)] text-white transition-opacity hover:opacity-90"
            >
              <Send className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={closeBar}
              aria-label="Fermer"
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </form>
        ) : (
          <div className="flex flex-1 items-center gap-2">
            <button
              onClick={openBar}
              className="flex flex-1 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>Demande quelque chose à Claude…</span>
            </button>
            <div className="hidden items-center gap-1 sm:flex">
              {QUICK_COMMANDS.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => handleQuickCommand(cmd.prompt)}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-[var(--ai-accent)] hover:text-[var(--ai-accent)]"
                >
                  {cmd.label}
                </button>
              ))}
            </div>
            <button
              onClick={openBar}
              aria-label="Ouvrir la barre IA"
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronUp className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
