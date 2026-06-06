"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import {
  Upload, CheckCircle2, AlertCircle, MinusCircle,
  Loader2, RotateCcw, Check, ChevronDown, ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─── Types partagés ──────────────────────────────────────────────────────────

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

interface ImportStats {
  total:       number
  matched:     number
  unmatched:   number
  excluded:    number
  totalAmount: number
}

interface ImportResult {
  importId:     string
  type:         "carte" | "compte"
  filename:     string
  summary:      ImportStats
  transactions: TransactionRow[]
  parseErrors:  string[]
}

// Pour l'historique
interface HistoryImport {
  id:         string
  filename:   string
  type:       "carte" | "compte"
  uploadedAt: string
  rowCount:   number
  status:     "parsed" | "confirmed" | "error"
  stats:      ImportStats | null
}

// Transactions DB (depuis /api/reconciliation/import/[id])
interface DbTransactionRow {
  id:            string
  date:          string
  label:         string
  amount:        number
  categoryBank:  string | null
  typeOperation: string | null
  matchStatus:   "matched" | "unmatched" | "excluded"
}

// ─── Formatters ──────────────────────────────────────────────────────────────

const formatEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n)

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso))

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, reason }: { status: "matched" | "unmatched" | "excluded"; reason?: string | null }) {
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

// ─── Stats inline ─────────────────────────────────────────────────────────────

function StatsRow({ stats, type, showAmount = false }: { stats: ImportStats; type: "carte" | "compte"; showAmount?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Badge variant="outline" className="text-[10px] font-normal">
        {type === "carte" ? "Carte" : "Compte"}
      </Badge>
      <span className="text-xs text-foreground tabular-nums font-medium">{stats.total} lignes</span>
      <span className="text-xs text-[var(--success)] tabular-nums">{stats.matched} rapprochés</span>
      <span className="text-xs text-[var(--warning)] tabular-nums">{stats.unmatched} non rapprochés</span>
      <span className="text-xs text-muted-foreground tabular-nums">{stats.excluded} exclus</span>
      {showAmount && stats.totalAmount > 0 && (
        <span className="text-xs text-foreground tabular-nums font-medium ml-auto">
          {formatEur(stats.totalAmount)} traités
        </span>
      )}
    </div>
  )
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith(".csv")) onFile(file)
  }, [onFile])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click() }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors",
        dragging
          ? "border-[var(--ai-accent)] bg-[var(--ai-accent)]/5"
          : "border-border hover:border-[var(--ai-accent)]/60 hover:bg-muted/30",
      )}
    >
      <Upload className="size-7 text-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Déposez un fichier CSV ou cliquez</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Carte (<code>carte_XXXX_*.csv</code>) ou Compte courant
        </p>
      </div>
      <input ref={inputRef} type="file" accept=".csv" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = "" }}
      />
    </div>
  )
}

// ─── Transactions table (réview après upload) ─────────────────────────────────

function TransactionsTable({ transactions }: { transactions: TransactionRow[] }) {
  const [filter, setFilter] = useState<"all" | "matched" | "unmatched" | "excluded">("all")
  const visible = transactions.filter(t => filter === "all" || t.matchStatus === filter)

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {(["all", "matched", "unmatched", "excluded"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors",
              filter === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}>
            {f === "all" ? "Tout" : f === "matched" ? "Rapprochés" : f === "unmatched" ? "Non rapprochés" : "Exclus"}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">{visible.length} ligne{visible.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-[88px]">Date</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Libellé</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-[96px]">Montant</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-[110px]">Catégorie</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-[108px]">Statut</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Entrée correspondante</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((t, i) => (
              <tr key={i} className={cn("transition-colors hover:bg-muted/20", t.matchStatus === "excluded" && "opacity-50")}>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(t.date)}</td>
                <td className="px-3 py-2 max-w-[220px]">
                  <p className="truncate font-medium text-foreground" title={t.label}>{t.label}</p>
                  {t.typeOperation && t.typeOperation !== "Carte bancaire" && (
                    <p className="text-[10px] text-muted-foreground">{t.typeOperation}</p>
                  )}
                  {t.excludeReason && <p className="text-[10px] text-muted-foreground italic">{t.excludeReason}</p>}
                </td>
                <td className={cn("px-3 py-2 text-right font-mono text-xs tabular-nums whitespace-nowrap",
                  t.excluded ? "text-muted-foreground" : t.amount < 0 ? "text-[var(--danger)]" : "text-[var(--success)]")}>
                  {t.excluded ? "—" : formatEur(t.amount)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-[110px]">
                  <span className="truncate block" title={[t.categoryBank, t.subCategory].filter(Boolean).join(" / ")}>
                    {t.categoryBank ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-2"><StatusBadge status={t.matchStatus} reason={t.excludeReason} /></td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-[180px]">
                  {t.matchedEntry ? (
                    <div>
                      <p className="truncate text-foreground" title={t.matchedEntry.label}>{t.matchedEntry.label}</p>
                      <p className="text-[10px]">
                        {formatDate(t.matchedEntry.date)} · {formatEur(t.matchedEntry.amount)}
                        {t.matchScore > 0 && <span className="ml-1 text-muted-foreground/60">({Math.round(t.matchScore * 100)}%)</span>}
                      </p>
                    </div>
                  ) : <span className="text-muted-foreground/50">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucune transaction pour ce filtre.</p>
        )}
      </div>
    </div>
  )
}

// ─── Table transactions DB (depuis historique) ────────────────────────────────

function DbTransactionsTable({ transactions }: { transactions: DbTransactionRow[] }) {
  const [filter, setFilter] = useState<"all" | "matched" | "unmatched" | "excluded">("all")
  const visible = transactions.filter(t => filter === "all" || t.matchStatus === filter)

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-2 flex-wrap">
        {(["all", "matched", "unmatched", "excluded"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors",
              filter === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
            {f === "all" ? "Tout" : f === "matched" ? "Rapprochés" : f === "unmatched" ? "Non rapprochés" : "Exclus"}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">{visible.length} ligne{visible.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground w-[88px]">Date</th>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Libellé</th>
              <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground w-[96px]">Montant</th>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground w-[108px]">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map(t => (
              <tr key={t.id} className={cn("hover:bg-muted/20", t.matchStatus === "excluded" && "opacity-50")}>
                <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(t.date)}</td>
                <td className="px-3 py-1.5 max-w-[260px]">
                  <p className="truncate text-sm text-foreground" title={t.label}>{t.label}</p>
                  {t.typeOperation && t.typeOperation !== "Carte bancaire" && (
                    <p className="text-[10px] text-muted-foreground">{t.typeOperation}</p>
                  )}
                </td>
                <td className={cn("px-3 py-1.5 text-right font-mono text-xs tabular-nums whitespace-nowrap",
                  t.matchStatus === "excluded" ? "text-muted-foreground"
                  : t.amount < 0 ? "text-[var(--danger)]" : "text-[var(--success)]")}>
                  {t.matchStatus === "excluded" ? "—" : formatEur(t.amount)}
                </td>
                <td className="px-3 py-1.5"><StatusBadge status={t.matchStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucune transaction pour ce filtre.</p>
        )}
      </div>
    </div>
  )
}

// ─── Carte historique d'un import ────────────────────────────────────────────

function ImportHistoryCard({
  imp,
  onExpand,
  expanded,
  loadingDetail,
  detail,
}: {
  imp:           HistoryImport
  onExpand:      (id: string) => void
  expanded:      boolean
  loadingDetail: boolean
  detail:        DbTransactionRow[] | null
}) {
  const matchRate = imp.stats && imp.stats.total > 0
    ? Math.round((imp.stats.matched / imp.stats.total) * 100)
    : null

  return (
    <div className="rounded-lg border border-border bg-[var(--panel-background)] overflow-hidden">
      {/* Header cliquable */}
      <button
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
        onClick={() => onExpand(imp.id)}
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="truncate text-sm font-medium text-foreground">{imp.filename}</span>
            <Badge
              variant="outline"
              className={cn("text-[10px] font-normal shrink-0",
                imp.status === "confirmed" && "border-[var(--success)]/40 text-[var(--success)]"
              )}
            >
              {imp.status === "confirmed" ? "Confirmé" : imp.status === "error" ? "Erreur" : "Parsé"}
            </Badge>
          </div>
          {imp.stats ? (
            <StatsRow stats={imp.stats} type={imp.type} showAmount />
          ) : (
            <p className="text-xs text-muted-foreground">{imp.rowCount} lignes</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">{formatDateTime(imp.uploadedAt)}</p>
          {matchRate !== null && (
            <p className="text-xs tabular-nums font-medium text-foreground">{matchRate}% rapprochés</p>
          )}
        </div>
      </button>

      {/* Détail expandable */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {loadingDetail ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Chargement des transactions…
            </div>
          ) : detail ? (
            <DbTransactionsTable transactions={detail} />
          ) : (
            <p className="text-xs text-muted-foreground py-4">Impossible de charger les transactions.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Section historique ───────────────────────────────────────────────────────

function ImportHistory({
  history,
  loading,
}: {
  history: HistoryImport[]
  loading: boolean
}) {
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [loadingId, setLoadingId]     = useState<string | null>(null)
  const [details, setDetails]         = useState<Record<string, DbTransactionRow[]>>({})

  async function handleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }

    setExpandedId(id)
    if (details[id]) return   // déjà chargé

    setLoadingId(id)
    try {
      const res = await fetch(`/api/reconciliation/import/${id}`)
      if (res.ok) {
        const data = await res.json()
        setDetails(prev => ({ ...prev, [id]: data.transactions }))
      }
    } finally {
      setLoadingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Chargement de l&apos;historique…
      </div>
    )
  }

  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Aucun import précédent.</p>
  }

  return (
    <div className="space-y-2">
      {history.map(imp => (
        <ImportHistoryCard
          key={imp.id}
          imp={imp}
          expanded={expandedId === imp.id}
          loadingDetail={loadingId === imp.id}
          detail={details[imp.id] ?? null}
          onExpand={handleExpand}
        />
      ))}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

type Phase = "idle" | "uploading" | "review" | "confirmed"

export function ReconciliationClient() {
  const [phase, setPhase]       = useState<Phase>("idle")
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [history, setHistory]   = useState<HistoryImport[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // Charger l'historique au montage et après chaque confirmation
  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const res = await fetch("/api/reconciliation/history")
      if (res.ok) {
        const data = await res.json()
        setHistory(data.imports ?? [])
      }
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => { loadHistory() }, [])

  async function handleFile(file: File) {
    setPhase("uploading")
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/reconciliation/upload", { method: "POST", body: fd })
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
    } finally {
      setConfirming(false)
      setPhase("confirmed")
      loadHistory()  // Rafraîchir l'historique après confirmation
    }
  }

  function handleReset() {
    setResult(null)
    setError(null)
    setPhase("idle")
  }

  // ── Uploading ────────────────────────────────────────────────────────────────
  if (phase === "uploading") {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="text-sm">Analyse du fichier et rapprochement en cours…</p>
      </div>
    )
  }

  // ── Review ───────────────────────────────────────────────────────────────────
  if (phase === "review" && result) {
    const matchRate = result.summary.total > 0
      ? Math.round((result.summary.matched / result.summary.total) * 100)
      : 0

    return (
      <div className="space-y-4">
        <Card className="bg-[var(--panel-background)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between gap-4 text-sm">
              <span className="truncate font-mono text-xs text-muted-foreground">{result.filename}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{matchRate}% rapprochés</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatsRow stats={result.summary} type={result.type} showAmount />
          </CardContent>
        </Card>

        {result.parseErrors.length > 0 && (
          <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/5 px-4 py-2 space-y-1">
            <p className="text-xs font-medium text-[var(--warning)]">Avertissements de parsing :</p>
            {result.parseErrors.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
          </div>
        )}

        <TransactionsTable transactions={result.transactions} />

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="size-3.5 mr-1.5" /> Nouveau fichier
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={confirming}>
            {confirming ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Check className="size-3.5 mr-1.5" />}
            Confirmer l&apos;import
          </Button>
        </div>
      </div>
    )
  }

  // ── Confirmed ─────────────────────────────────────────────────────────────────
  if (phase === "confirmed" && result) {
    const totalAmount = result.transactions
      .filter(t => !t.excluded)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    return (
      <div className="space-y-6">
        {/* Bannière de confirmation */}
        <Card className="border-[var(--success)]/30 bg-[var(--success)]/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/15">
                <Check className="size-5 text-[var(--success)]" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">Import confirmé</p>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <Upload className="size-3.5 mr-1.5" /> Nouvel import
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground truncate font-mono">{result.filename}</p>

                {/* Résumé chiffré */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 pt-1 sm:grid-cols-4">
                  {[
                    { label: "Transactions",   value: String(result.summary.total),      color: "text-foreground" },
                    { label: "Rapprochées",    value: String(result.summary.matched),    color: "text-[var(--success)]" },
                    { label: "Non rapprochées", value: String(result.summary.unmatched), color: "text-[var(--warning)]" },
                    { label: "Montant total",  value: formatEur(totalAmount),             color: "text-foreground" },
                  ].map(c => (
                    <div key={c.label}>
                      <p className={cn("text-lg font-bold tabular-nums", c.color)}>{c.value}</p>
                      <p className="text-[10px] text-muted-foreground">{c.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Détail des transactions de l'import confirmé */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Transactions importées</h3>
          <TransactionsTable transactions={result.transactions} />
        </div>

        {/* Historique des imports précédents */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Historique des imports</h3>
          <ImportHistory history={history} loading={historyLoading} />
        </div>
      </div>
    )
  }

  // ── Idle (+ historique) ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <UploadZone onFile={handleFile} />
        {error && (
          <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-4 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
      </div>

      {/* Historique visible dès le premier chargement */}
      {(historyLoading || history.length > 0) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Historique des imports</h3>
          <ImportHistory history={history} loading={historyLoading} />
        </div>
      )}
    </div>
  )
}
