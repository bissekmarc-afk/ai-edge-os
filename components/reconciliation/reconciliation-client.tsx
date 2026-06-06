"use client"

import { useRef, useState, useCallback } from "react"
import { Upload, CheckCircle2, AlertCircle, MinusCircle, Loader2, RotateCcw, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchedEntry {
  id:     string
  date:   string
  label:  string
  amount: number
  source: string
}

interface TransactionRow {
  date:          string
  label:         string
  amount:        number
  categoryBank:  string | null
  subCategory:   string | null
  typeOperation: string | null
  excluded:      boolean
  excludeReason: string | null
  matchStatus:   "matched" | "unmatched" | "excluded"
  matchScore:    number
  matchedEntry:  MatchedEntry | null
}

interface ImportSummary {
  total:     number
  matched:   number
  unmatched: number
  excluded:  number
}

interface ImportResult {
  importId:     string
  type:         "carte" | "compte"
  filename:     string
  summary:      ImportSummary
  transactions: TransactionRow[]
  parseErrors:  string[]
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const formatEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style:                 "currency",
    currency:              "EUR",
    minimumFractionDigits: 2,
  }).format(n)

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso))

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadZone({ onFile, disabled }: { onFile: (f: File) => void; disabled: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith(".csv")) onFile(file)
  }, [onFile])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click() }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 transition-colors",
        dragging
          ? "border-[var(--ai-accent)] bg-[var(--ai-accent)]/5"
          : "border-border hover:border-[var(--ai-accent)]/60 hover:bg-muted/30",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <Upload className="size-8 text-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          Déposez un fichier CSV ou cliquez pour choisir
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Relevé Carte (<code>carte_XXXX_*.csv</code>) ou Compte courant
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ""
        }}
      />
    </div>
  )
}

// ─── Summary KPI chips ────────────────────────────────────────────────────────

function SummaryChips({ summary, type }: { summary: ImportSummary; type: "carte" | "compte" }) {
  const chips = [
    { label: "Total",          value: summary.total,     color: "text-foreground" },
    { label: "Rapprochés",     value: summary.matched,   color: "text-[var(--success)]" },
    { label: "Non rapprochés", value: summary.unmatched, color: "text-[var(--warning)]" },
    { label: "Exclus",         value: summary.excluded,  color: "text-muted-foreground" },
  ]
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="outline" className="text-xs font-normal capitalize">
        {type === "carte" ? "Relevé Carte" : "Compte courant"}
      </Badge>
      {chips.map(c => (
        <div key={c.label} className="flex items-center gap-1.5 text-sm">
          <span className={cn("text-xl font-bold tabular-nums", c.color)}>{c.value}</span>
          <span className="text-xs text-muted-foreground">{c.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, reason }: { status: TransactionRow["matchStatus"]; reason?: string | null }) {
  if (status === "matched") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--success)]">
        <CheckCircle2 className="size-3" /> Rapproché
      </span>
    )
  }
  if (status === "excluded") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground" title={reason ?? undefined}>
        <MinusCircle className="size-3" /> Exclu
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warning)]/10 px-2 py-0.5 text-xs font-medium text-[var(--warning)]">
      <AlertCircle className="size-3" /> Non rapproché
    </span>
  )
}

// ─── Transactions table ───────────────────────────────────────────────────────

function TransactionsTable({ transactions }: { transactions: TransactionRow[] }) {
  const [filter, setFilter] = useState<"all" | "matched" | "unmatched" | "excluded">("all")

  const visible = transactions.filter(t =>
    filter === "all" ? true : t.matchStatus === filter,
  )

  return (
    <div className="space-y-3">
      {/* Filtres */}
      <div className="flex gap-2">
        {(["all", "matched", "unmatched", "excluded"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              filter === f
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {f === "all"       ? "Tout"
             : f === "matched"   ? "Rapprochés"
             : f === "unmatched" ? "Non rapprochés"
             :                    "Exclus"}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">
          {visible.length} ligne{visible.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-[90px]">Date</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Libellé</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-[100px]">Montant</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-[120px]">Catégorie</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-[110px]">Statut</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Entrée correspondante</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((t, i) => (
              <tr
                key={i}
                className={cn(
                  "transition-colors hover:bg-muted/20",
                  t.matchStatus === "excluded" && "opacity-50",
                )}
              >
                {/* Date */}
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(t.date)}
                </td>

                {/* Libellé + type op */}
                <td className="px-3 py-2 max-w-[240px]">
                  <p className="truncate font-medium text-foreground" title={t.label}>{t.label}</p>
                  {(t.typeOperation && t.typeOperation !== "Carte bancaire") && (
                    <p className="text-[10px] text-muted-foreground">{t.typeOperation}</p>
                  )}
                  {t.excludeReason && (
                    <p className="text-[10px] text-muted-foreground italic">{t.excludeReason}</p>
                  )}
                </td>

                {/* Montant */}
                <td className={cn(
                  "px-3 py-2 text-right font-mono text-xs tabular-nums whitespace-nowrap",
                  t.excluded ? "text-muted-foreground"
                  : t.amount < 0 ? "text-[var(--danger)]"
                  : "text-[var(--success)]",
                )}>
                  {t.excluded ? "—" : formatEur(t.amount)}
                </td>

                {/* Catégorie */}
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-[120px]">
                  <span className="truncate block" title={[t.categoryBank, t.subCategory].filter(Boolean).join(" / ")}>
                    {t.categoryBank ?? "—"}
                  </span>
                </td>

                {/* Statut */}
                <td className="px-3 py-2">
                  <StatusBadge status={t.matchStatus} reason={t.excludeReason} />
                </td>

                {/* Entrée correspondante */}
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px]">
                  {t.matchedEntry ? (
                    <div>
                      <p className="truncate text-foreground" title={t.matchedEntry.label}>
                        {t.matchedEntry.label}
                      </p>
                      <p className="text-[10px]">
                        {formatDate(t.matchedEntry.date)} · {formatEur(t.matchedEntry.amount)}
                        {t.matchScore > 0 && (
                          <span className="ml-1 text-muted-foreground/60">({Math.round(t.matchScore * 100)}%)</span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visible.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucune transaction pour ce filtre.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

type Phase = "idle" | "uploading" | "review" | "confirmed"

export function ReconciliationClient() {
  const [phase, setPhase]   = useState<Phase>("idle")
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function handleFile(file: File) {
    setPhase("uploading")
    setError(null)

    try {
      const fd = new FormData()
      fd.append("file", file)

      const res = await fetch("/api/reconciliation/upload", {
        method: "POST",
        body:   fd,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Erreur HTTP ${res.status}`)
      }

      const data = (await res.json()) as ImportResult
      setResult(data)
      setPhase("review")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
      setPhase("idle")
    }
  }

  async function handleConfirm() {
    if (!result) return
    setConfirming(true)
    try {
      await fetch("/api/reconciliation/confirm", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ importId: result.importId }),
      })
      setPhase("confirmed")
    } catch {
      // silencieux — le statut n'est pas critique
      setPhase("confirmed")
    } finally {
      setConfirming(false)
    }
  }

  function handleReset() {
    setResult(null)
    setError(null)
    setPhase("idle")
  }

  // ── Idle ────────────────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div className="space-y-4">
        <UploadZone onFile={handleFile} disabled={false} />
        {error && (
          <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-4 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
      </div>
    )
  }

  // ── Uploading ───────────────────────────────────────────────────────────────
  if (phase === "uploading") {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="text-sm">Analyse du fichier et rapprochement en cours…</p>
      </div>
    )
  }

  // ── Confirmed ───────────────────────────────────────────────────────────────
  if (phase === "confirmed") {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <div className="flex size-14 items-center justify-center rounded-full bg-[var(--success)]/10">
          <Check className="size-7 text-[var(--success)]" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">Import confirmé</p>
          <p className="text-sm text-muted-foreground">
            {result?.summary.matched} transaction{result?.summary.matched !== 1 ? "s" : ""} rapprochée{result?.summary.matched !== 1 ? "s" : ""}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="size-3.5 mr-1.5" />
          Importer un autre fichier
        </Button>
      </div>
    )
  }

  // ── Review ──────────────────────────────────────────────────────────────────
  if (phase === "review" && result) {
    const matchRate = result.summary.total > 0
      ? Math.round((result.summary.matched / result.summary.total) * 100)
      : 0

    return (
      <div className="space-y-4">
        <Card className="bg-[var(--panel-background)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate font-mono text-xs text-muted-foreground">{result.filename}</span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {matchRate}% rapprochés
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SummaryChips summary={result.summary} type={result.type} />
          </CardContent>
        </Card>

        {result.parseErrors.length > 0 && (
          <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/5 px-4 py-2">
            <p className="text-xs font-medium text-[var(--warning)]">Avertissements de parsing :</p>
            {result.parseErrors.map((e, i) => (
              <p key={i} className="text-xs text-muted-foreground">{e}</p>
            ))}
          </div>
        )}

        <TransactionsTable transactions={result.transactions} />

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="size-3.5 mr-1.5" />
            Nouveau fichier
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={confirming}>
            {confirming ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Check className="size-3.5 mr-1.5" />
            )}
            Confirmer l&apos;import
          </Button>
        </div>
      </div>
    )
  }

  return null
}
