"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

type Phase =
  | { type: "idle" }
  | { type: "resetting" }
  | { type: "syncing"; deleted: number }
  | { type: "done"; deleted: number; synced: number }
  | { type: "error"; message: string; detail?: string }

async function callRoute(url: string): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST" })
  let body: Record<string, unknown> = {}
  try {
    body = await res.json()
  } catch {
    // Non-JSON response (HTML error page, timeout, etc.) — capture raw text
    try {
      const text = await res.text()
      body = { _raw: text.slice(0, 300) }
    } catch {
      body = { _raw: "(unreadable body)" }
    }
  }
  console.log(`[ResetResync] ${url} → ${res.status}`, body)
  return { ok: res.ok, status: res.status, body }
}

export function ResetResyncButton() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>({ type: "idle" })

  async function handleClick() {
    if (phase.type !== "idle" && phase.type !== "done" && phase.type !== "error") return

    try {
      // ── Step 1: reset ────────────────────────────────────────────────────────
      setPhase({ type: "resetting" })
      console.log("[ResetResync] Starting reset…")

      const reset = await callRoute("/api/finance/reset")
      if (!reset.ok) {
        const msg = (reset.body.error as string) ?? `Reset failed`
        const detail = (reset.body.detail as string) ?? `HTTP ${reset.status}`
        console.error("[ResetResync] Reset failed:", reset.body)
        setPhase({ type: "error", message: msg, detail })
        return
      }

      const deleted = (reset.body.deleted as number) ?? 0
      console.log(`[ResetResync] Reset OK — ${deleted} rows deleted`)

      // ── Step 2: sync ─────────────────────────────────────────────────────────
      setPhase({ type: "syncing", deleted })
      console.log("[ResetResync] Starting sync…")

      const sync = await callRoute("/api/sync/google-sheets")
      if (!sync.ok) {
        const msg = (sync.body.error as string) ?? `Sync failed`
        const detail = (sync.body.detail as string) ?? (sync.body._raw as string) ?? `HTTP ${sync.status}`
        console.error("[ResetResync] Sync failed:", sync.body)
        setPhase({ type: "error", message: msg, detail })
        return
      }

      const synced = (sync.body.synced as number) ?? 0
      const parsed = (sync.body.parsed as number) ?? 0
      console.log(`[ResetResync] Sync OK — parsed=${parsed} synced=${synced}`, sync.body)

      setPhase({ type: "done", deleted, synced })
      router.refresh()
      setTimeout(() => setPhase({ type: "idle" }), 6_000)

    } catch (err) {
      // Catches network errors, JSON parse exceptions, anything unexpected
      const message = err instanceof Error ? err.message : String(err)
      console.error("[ResetResync] Unexpected error:", err)
      setPhase({ type: "error", message, detail: "Voir la console pour plus de détails" })
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (phase.type === "done") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-800 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-300">
        <CheckCircle2 className="size-3.5 shrink-0" />
        <span>
          <span className="font-semibold">{phase.deleted}</span> supprimées →{" "}
          <span className="font-semibold">{phase.synced}</span> insérées
        </span>
      </div>
    )
  }

  if (phase.type === "error") {
    return (
      <div className="flex items-center gap-2">
        <div
          className="flex max-w-xs flex-col gap-0.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
          title={phase.detail}
        >
          <div className="flex items-center gap-1.5">
            <AlertCircle className="size-3.5 shrink-0" />
            <span className="truncate font-medium">{phase.message}</span>
          </div>
          {phase.detail && (
            <span className="truncate pl-5 text-red-600 dark:text-red-400">
              {phase.detail}
            </span>
          )}
        </div>
        <button
          onClick={() => setPhase({ type: "idle" })}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Réessayer
        </button>
      </div>
    )
  }

  const isLoading = phase.type === "resetting" || phase.type === "syncing"

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          <span>
            {phase.type === "resetting"
              ? "Suppression…"
              : `Sync… (${phase.deleted} supp.)`}
          </span>
        </>
      ) : (
        <>
          <Trash2 className="size-3.5 text-muted-foreground" />
          <RefreshCw className="size-3.5 text-muted-foreground" />
          <span>Reset &amp; Resync</span>
        </>
      )}
    </button>
  )
}
