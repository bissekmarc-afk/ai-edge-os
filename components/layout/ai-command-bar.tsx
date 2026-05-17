"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, X, Sparkles, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { mockAICommands } from "@/lib/mock-data"

interface AICommandBarProps {
  marginLeft: number
}

const MOCK_RESPONSE =
  "Voici ton brief du jour : 5 tâches prioritaires aujourd'hui dont 2 urgentes. Budget mai en bonne voie (−18% dépenses vs mois dernier). Streak lecture : 21 jours. Prochaine séance de boxe recommandée ce soir. Bonne journée ! 💡"

export function AICommandBar({ marginLeft }: AICommandBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [response, setResponse] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const closeBar = useCallback(() => {
    setIsOpen(false)
    setResponse("")
    setQuery("")
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

  function simulateResponse(prompt: string) {
    if (!prompt.trim()) return
    setIsTyping(true)
    setResponse("")
    setTimeout(() => {
      setIsTyping(false)
      setResponse(
        prompt.toLowerCase().includes("budget")
          ? "Budget mai : revenus 3 800 € · dépenses 2 158,80 € · solde +1 641,20 €. Taux d'épargne : 20 %. Objectif atteint ✅"
          : prompt.toLowerCase().includes("lecture")
          ? "En cours : Atomic Habits (65%) + Thinking in Systems (30%). Terminés ce mois : Zero to One. Streak : 21 jours 🔥"
          : MOCK_RESPONSE
      )
    }, 900)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    simulateResponse(query)
  }

  function handleQuickCommand(prompt: string) {
    setQuery(prompt)
    setIsOpen(true)
    simulateResponse(prompt)
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
              {mockAICommands.slice(0, 3).map((cmd) => (
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
