"use client"

import { useState }    from "react"
import { useRouter }   from "next/navigation"
import { RefreshCw }   from "lucide-react"
import { Button }      from "@/components/ui/button"
import { cn }          from "@/lib/utils"

export function GenerateReforecastButton() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const router = useRouter()

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch("/api/finance/create-reforecast", { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((json as { error?: string }).error ?? `Erreur ${res.status}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleGenerate}
        disabled={loading}
      >
        <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        {loading ? "Génération…" : "Générer Reforecast 6M"}
      </Button>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
