"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface SyncResult {
  source: string
  synced?: number
  error?: string
}

export function SyncButton() {
  const [syncing, setSyncing] = useState(false)
  const [results, setResults] = useState<SyncResult[]>([])
  const router = useRouter()

  async function handleSync() {
    setSyncing(true)
    setResults([])
    try {
      const [todoistRes, sheetsRes] = await Promise.allSettled([
        fetch("/api/sync/todoist", { method: "POST" }).then((r) => r.json()),
        fetch("/api/sync/google-sheets", { method: "POST" }).then((r) => r.json()),
      ])

      const next: SyncResult[] = []

      if (todoistRes.status === "fulfilled") {
        const d = todoistRes.value as { synced?: number; error?: string }
        next.push({ source: "Todoist", synced: d.synced, error: d.error })
      } else {
        next.push({ source: "Todoist", error: "Erreur réseau" })
      }

      if (sheetsRes.status === "fulfilled") {
        const d = sheetsRes.value as { synced?: number; error?: string }
        next.push({ source: "Sheets", synced: d.synced, error: d.error })
      } else {
        next.push({ source: "Sheets", error: "Erreur réseau" })
      }

      setResults(next)
      router.refresh()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handleSync}
        disabled={syncing}
      >
        <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Sync..." : "Synchroniser"}
      </Button>
      {results.map((r) => (
        <span key={r.source} className="text-xs text-muted-foreground">
          {r.error
            ? `${r.source} : ${r.error}`
            : `${r.source} : ${r.synced} sync.`}
        </span>
      ))}
    </div>
  )
}
