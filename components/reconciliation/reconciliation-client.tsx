"use client"

import React, { useRef, useState, useCallback, useEffect, useMemo } from "react"
import { Upload, Loader2, RotateCcw, Check, ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { BankCategorySummary } from "@/lib/csv/summarize"

// ─── Types ────────────────────────────────────────────────────────────────────

interface DrillTransaction {
  date:         string
  label:        string
  amount:       number        // signé (toujours < 0 pour les débits)
  categoryBank: string | null
}

interface CoverageData {
  month:               number
  year:                number
  bankExpenses:        number
  actualExpenses:      number    // hors taxes à la source
  gap:                 number
  coverageRatio:       number
  currentMonthPartial: boolean
  bothTypesConfirmed:  boolean
  confirmedTypes:      string[]
  excludedAmount:      number    // montant exclu (taxes à la source)
  excludedLabels:      string[]  // catégories exclues
}

interface ImportData {
  importId:          string
  type:              "carte" | "compte"
  filename:          string
  totalSpent:        number
  totalTransactions: number
  period:            string
  summary:           BankCategorySummary[]
  transactions:      DrillTransaction[]   // débits individuels pour le drill-down
  coverage:          CoverageData | null
  parseErrors:       string[]
}

interface HistoryStats {
  total:       number
  matched:     number
  unmatched:   number
  excluded:    number
  totalAmount: number
}

interface HistoryImport {
  id:         string
  filename:   string
  type:       "carte" | "compte"
  uploadedAt: string
  rowCount:   number
  status:     "parsed" | "confirmed" | "error"
  stats:      HistoryStats | null
}

interface DbTransactionRow {
  id:            string
  date:          string
  label:         string
  amount:        number
  categoryBank:  string | null
  typeOperation: string | null
  matchStatus:   "matched" | "unmatched" | "excluded"
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const formatEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style:                 "currency",
    currency:              "EUR",
    minimumFractionDigits: 2,
  }).format(n)

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day:    "2-digit",
    month:  "short",
    hour:   "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
  }).format(new Date(iso))

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.toLowerCase().endsWith(".csv")) onFile(file)
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
          Relevé Carte (<code>carte_XXXX_*.csv</code>) ou Compte courant
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = "" }}
      />
    </div>
  )
}

// ─── Bloc contrôle d'exhaustivité ────────────────────────────────────────────

const MONTHS_FR_FULL = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août",  "sept.", "oct.", "nov.", "déc.",
]

function CoverageBlock({ coverage }: { coverage: CoverageData }) {
  const {
    month, year, bankExpenses, actualExpenses, gap, coverageRatio,
    currentMonthPartial, bothTypesConfirmed, confirmedTypes,
    excludedAmount, excludedLabels,
  } = coverage

  const pct         = Math.round(coverageRatio * 1000) / 10
  const periodLabel = `${MONTHS_FR_FULL[month - 1]} ${year}`

  // ── Cas partiel : un seul CSV confirmé ──────────────────────────────────
  if (!bothTypesConfirmed) {
    const missing = (["carte", "compte"] as const)
      .filter(t => !confirmedTypes.includes(t))
      .map(t => t === "carte" ? "Relevé Carte" : "Compte courant")
      .join(" + ")

    return (
      <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/5 px-4 py-3 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-foreground">
            Contrôle d&apos;exhaustivité — {periodLabel}
          </p>
          {currentMonthPartial && (
            <span className="rounded bg-[var(--warning)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--warning)]">
              mois partiel
            </span>
          )}
          <span className="ml-auto rounded bg-[var(--warning)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
            Couverture partielle
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Importez et confirmez le{missing.includes("+") ? "s" : ""}{" "}
          <span className="font-medium text-foreground">{missing}</span>{" "}
          pour un contrôle d&apos;exhaustivité complet.
          {confirmedTypes.length > 0 && (
            <span className="ml-1 text-muted-foreground/70">
              ({confirmedTypes.map(t => t === "carte" ? "Carte" : "Compte").join(" + ")} déjà confirmé{confirmedTypes.length > 1 ? "s" : ""})
            </span>
          )}
        </p>
      </div>
    )
  }

  // ── Cas complet : carte + compte tous les deux confirmés ──────────────────
  const level: "red" | "orange" | "green" =
    gap > 500 || coverageRatio < 0.85 ? "red"    :
    gap > 100 || coverageRatio < 0.95 ? "orange" : "green"

  const statusLabel = level === "red" ? "Écart important" : level === "orange" ? "À surveiller" : "Exhaustif"
  const statusColor = level === "red"
    ? "bg-[var(--danger)]/10  text-[var(--danger)]"
    : level === "orange"
      ? "bg-[var(--warning)]/10 text-[var(--warning)]"
      : "bg-[var(--success)]/10 text-[var(--success)]"
  const gapColor    = gap > 0
    ? (level === "red" ? "text-[var(--danger)]" : "text-[var(--warning)]")
    : "text-[var(--success)]"

  return (
    <div className={cn(
      "rounded-lg border px-4 py-3 space-y-2",
      level === "red"    ? "border-[var(--danger)]/30  bg-[var(--danger)]/5"  :
      level === "orange" ? "border-[var(--warning)]/30 bg-[var(--warning)]/5" :
                           "border-[var(--success)]/30 bg-[var(--success)]/5",
    )}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-foreground">
          Contrôle d&apos;exhaustivité — {periodLabel}
        </p>
        {currentMonthPartial && (
          <span className="rounded bg-[var(--warning)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--warning)]">
            mois partiel
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">Carte + Compte</span>
        <span className={cn("ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold", statusColor)}>
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        {[
          { label: "Dépenses bancaires", value: formatEur(bankExpenses), color: "text-foreground" },
          { label: "Dépenses saisies",   value: formatEur(actualExpenses), color: "text-foreground" },
          { label: "Écart",              value: formatEur(gap), color: gapColor },
          { label: "Couverture P&L",     value: `${pct}%`, color: level === "green" ? "text-[var(--success)]" : level === "orange" ? "text-[var(--warning)]" : "text-[var(--danger)]" },
        ].map(m => (
          <div key={m.label}>
            <p className="text-[10px] text-muted-foreground">{m.label}</p>
            <p className={cn("text-sm font-semibold tabular-nums", m.color)}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Note : catégories exclues du calcul (taxes à la source) */}
      {excludedAmount > 0 && (
        <p className="text-[10px] text-muted-foreground border-t border-border/30 pt-2">
          ℹ️ Taxes exclues (prélevées à la source) :{" "}
          <span className="font-medium">{formatEur(excludedAmount)}</span>
          {excludedLabels.length > 0 && (
            <span className="ml-1 opacity-60">
              ({excludedLabels.join(", ")})
            </span>
          )}
          {" — "}non comptabilisées dans l&apos;écart car sans transaction bancaire.
        </p>
      )}
    </div>
  )
}

// ─── Tableau catégories avec drill-down ──────────────────────────────────────

function CategoryTable({
  summary,
  transactions,
}: {
  summary:      BankCategorySummary[]
  transactions: DrillTransaction[]
}) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const toggleCategory = (category: string) => {
    setSelectedCategory(prev => (prev === category ? null : category))
  }

  const drillTransactions = useMemo(() => {
    if (!selectedCategory) return []
    return transactions
      .filter(tx =>
        (selectedCategory === "Non catégorisé"
          ? (tx.categoryBank === null || tx.categoryBank === "Non catégorisé")
          : tx.categoryBank === selectedCategory) &&
        tx.amount < 0
      )
      .toSorted((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  }, [selectedCategory, transactions])

  const drillTotal = useMemo(
    () => drillTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
    [drillTransactions],
  )

  if (summary.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucune dépense détectée dans ce relevé.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[500px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
              Catégorie banque
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-[130px]">
              Total dépensé
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-[110px]">
              Transactions
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-[90px]">
              % du total
            </th>
          </tr>
        </thead>
        <tbody>
          {summary.map(row => (
            <React.Fragment key={row.category}>
              {/* Ligne catégorie — cliquable */}
              <tr
                role="button"
                tabIndex={0}
                aria-expanded={selectedCategory === row.category}
                onClick={() => toggleCategory(row.category)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    toggleCategory(row.category)
                  }
                }}
                className={cn(
                  "cursor-pointer transition-colors border-t border-border",
                  selectedCategory === row.category
                    ? "bg-muted/40"
                    : "hover:bg-muted/20",
                )}
              >
                <td className="px-4 py-2.5 font-medium text-foreground">
                  <span className="mr-2 text-xs text-muted-foreground" aria-hidden="true">
                    {selectedCategory === row.category ? "▼" : "▶"}
                  </span>
                  {row.category}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-[var(--danger)]">
                  {formatEur(row.totalSpent)}
                </td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums text-muted-foreground">
                  {row.transactionCount}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[var(--ai-accent)]"
                        style={{ width: `${Math.min(row.shareOfTotalPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">
                      {row.shareOfTotalPct.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>

              {/* Détail inline — visible si catégorie sélectionnée */}
              {selectedCategory === row.category && (
                <tr className="border-t border-border/50">
                  <td colSpan={4} className="p-0">
                    <div className="bg-muted/30 px-5 py-3 space-y-2">
                      {/* Header drill */}
                      <p className="text-xs font-medium text-muted-foreground">
                        {drillTransactions.length > 0
                          ? `${drillTransactions.length} transaction${drillTransactions.length > 1 ? "s" : ""} · Total ${formatEur(drillTotal)}`
                          : "Aucune transaction"}
                      </p>

                      {/* Mini-table transactions */}
                      {drillTransactions.length > 0 && (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border/50">
                              <th className="py-1 text-left font-medium text-muted-foreground w-[88px]">Date</th>
                              <th className="py-1 text-left font-medium text-muted-foreground">Libellé</th>
                              <th className="py-1 text-right font-medium text-muted-foreground w-[96px]">Montant</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {drillTransactions.map((tx, i) => (
                              <tr key={i} className="hover:bg-muted/30 transition-colors">
                                <td className="py-1.5 text-muted-foreground whitespace-nowrap">
                                  {formatDate(tx.date)}
                                </td>
                                <td className="py-1.5 max-w-[300px]">
                                  <span className="truncate block text-foreground" title={tx.label}>
                                    {tx.label}
                                  </span>
                                </td>
                                <td className="py-1.5 text-right font-mono tabular-nums text-[var(--danger)]">
                                  {formatEur(Math.abs(tx.amount))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Header résumé ────────────────────────────────────────────────────────────

function SummaryHeader({
  totalSpent,
  totalTransactions,
  period,
  type,
  filename,
}: {
  totalSpent:        number
  totalTransactions: number
  period:            string
  type:              "carte" | "compte"
  filename:          string
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px] font-normal">
          {type === "carte" ? "Relevé Carte" : "Compte courant"}
        </Badge>
        <span className="truncate text-xs font-mono text-muted-foreground">{filename}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {formatEur(totalSpent)}
        </span>
        <span className="text-sm text-muted-foreground">
          {totalTransactions} transaction{totalTransactions !== 1 ? "s" : ""}
        </span>
        <span className="text-sm text-muted-foreground">·</span>
        <span className="text-sm font-medium text-foreground">{period}</span>
      </div>
    </div>
  )
}

// ─── Historique — carte d'un import ──────────────────────────────────────────

function ImportHistoryCard({
  imp,
  expanded,
  loadingDetail,
  detail,
  onExpand,
  onDeleted,
}: {
  imp:           HistoryImport
  expanded:      boolean
  loadingDetail: boolean
  detail:        DbTransactionRow[] | null
  onExpand:      (id: string) => void
  onDeleted:     () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(true)
    try {
      await fetch(`/api/reconciliation/import/${imp.id}`, { method: "DELETE" })
      onDeleted()
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }
  const debitTotal = detail
    ? Math.round(
        detail
          .filter(t => t.matchStatus !== "excluded" && t.amount < 0)
          .reduce((s, t) => s + Math.abs(t.amount), 0) * 100,
      ) / 100
    : null

  return (
    <div className="rounded-lg border border-border bg-[var(--panel-background)] overflow-hidden">
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
              className={cn(
                "text-[10px] font-normal shrink-0",
                imp.status === "confirmed" && "border-[var(--success)]/40 text-[var(--success)]",
              )}
            >
              {imp.status === "confirmed" ? "Confirmé" : imp.status === "error" ? "Erreur" : "Parsé"}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal shrink-0">
              {imp.type === "carte" ? "Carte" : "Compte"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {imp.stats ? `${imp.stats.total} lignes` : `${imp.rowCount} lignes`}
            {imp.stats?.totalAmount
              ? ` · ${formatEur(imp.stats.totalAmount)}`
              : ""}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <p className="text-xs text-muted-foreground">{formatDateTime(imp.uploadedAt)}</p>

          {confirmDelete ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-2 py-1 text-xs">
              <span className="text-muted-foreground whitespace-nowrap">
                Supprimer {imp.stats?.total ?? imp.rowCount} tx ?
              </span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--danger)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? "…" : "Oui"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              >
                Non
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label="Supprimer cet import"
              className="flex size-6 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {loadingDetail ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Chargement des transactions…
            </div>
          ) : detail ? (
            <div className="space-y-3">
              {debitTotal !== null && debitTotal > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total dépensé : <span className="font-medium text-foreground">{formatEur(debitTotal)}</span>
                </p>
              )}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground w-[88px]">Date</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Libellé</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground w-[110px]">Catégorie</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground w-[96px]">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {detail.filter(t => t.matchStatus !== "excluded").map(t => (
                      <tr key={t.id} className="hover:bg-muted/20">
                        <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(t.date)}
                        </td>
                        <td className="px-3 py-1.5 max-w-[200px]">
                          <p className="truncate text-sm text-foreground" title={t.label}>{t.label}</p>
                        </td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground max-w-[110px]">
                          <span className="truncate block">{t.categoryBank ?? "—"}</span>
                        </td>
                        <td className={cn(
                          "px-3 py-1.5 text-right font-mono text-xs tabular-nums whitespace-nowrap",
                          t.amount < 0 ? "text-[var(--danger)]" : "text-[var(--success)]",
                        )}>
                          {formatEur(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detail.filter(t => t.matchStatus !== "excluded").length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Aucune transaction.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4">Impossible de charger les transactions.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Section historique ───────────────────────────────────────────────────────

function ImportHistory({ history, loading, onRefresh }: {
  history:   HistoryImport[]
  loading:   boolean
  onRefresh: () => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingId, setLoadingId]   = useState<string | null>(null)
  const [details, setDetails]       = useState<Record<string, DbTransactionRow[]>>({})

  async function handleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (details[id]) return
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
          onDeleted={onRefresh}
        />
      ))}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

type Phase = "idle" | "uploading" | "review" | "confirmed"

export function ReconciliationClient() {
  const [phase, setPhase]     = useState<Phase>("idle")
  const [data, setData]       = useState<ImportData | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [history, setHistory] = useState<HistoryImport[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const res = await fetch("/api/reconciliation/history")
      if (res.ok) {
        const json = await res.json()
        setHistory(json.imports ?? [])
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
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? `Erreur HTTP ${res.status}`)
      }
      const json = (await res.json()) as ImportData
      setData(json)
      setPhase("review")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
      setPhase("idle")
    }
  }

  async function handleConfirm() {
    if (!data) return
    setConfirming(true)
    try {
      await fetch("/api/reconciliation/confirm", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ importId: data.importId }),
      })
    } finally {
      setConfirming(false)
      setPhase("confirmed")
      loadHistory()
    }
  }

  function handleReset() {
    setData(null)
    setError(null)
    setPhase("idle")
  }

  // ── Uploading ────────────────────────────────────────────────────────────────
  if (phase === "uploading") {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="text-sm">Analyse du fichier en cours…</p>
      </div>
    )
  }

  // ── Review ───────────────────────────────────────────────────────────────────
  if (phase === "review" && data) {
    return (
      <div className="space-y-5">
        <Card className="bg-[var(--panel-background)]">
          <CardContent className="pt-4">
            <SummaryHeader
              totalSpent={data.totalSpent}
              totalTransactions={data.totalTransactions}
              period={data.period}
              type={data.type}
              filename={data.filename}
            />
          </CardContent>
        </Card>

        {data.parseErrors.length > 0 && (
          <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/5 px-4 py-2 space-y-1">
            <p className="text-xs font-medium text-[var(--warning)]">Avertissements de parsing :</p>
            {data.parseErrors.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
          </div>
        )}

        {data.coverage && <CoverageBlock coverage={data.coverage} />}
        <CategoryTable summary={data.summary} transactions={data.transactions} />

        <div className="flex items-center justify-between pt-1">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="size-3.5 mr-1.5" /> Nouveau fichier
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={confirming}>
            {confirming
              ? <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              : <Check className="size-3.5 mr-1.5" />}
            Confirmer l&apos;import
          </Button>
        </div>
      </div>
    )
  }

  // ── Confirmed ─────────────────────────────────────────────────────────────────
  if (phase === "confirmed" && data) {
    return (
      <div className="space-y-6">
        {/* Bannière */}
        <Card className="border-[var(--success)]/30 bg-[var(--success)]/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/15">
                <Check className="size-5 text-[var(--success)]" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">Import confirmé</p>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <Upload className="size-3.5 mr-1.5" /> Nouvel import
                  </Button>
                </div>
                <SummaryHeader
                  totalSpent={data.totalSpent}
                  totalTransactions={data.totalTransactions}
                  period={data.period}
                  type={data.type}
                  filename={data.filename}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tableau catégories */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Dépenses par catégorie</h3>
          {data.coverage && <CoverageBlock coverage={data.coverage} />}
        <CategoryTable summary={data.summary} transactions={data.transactions} />
        </div>

        {/* Historique */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Historique des imports</h3>
          <ImportHistory history={history} loading={historyLoading} onRefresh={loadHistory} />
        </div>
      </div>
    )
  }

  // ── Idle + historique ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <UploadZone onFile={handleFile} />
        {error && (
          <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-4 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
      </div>

      {(historyLoading || history.length > 0) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Historique des imports</h3>
          <ImportHistory history={history} loading={historyLoading} onRefresh={loadHistory} />
        </div>
      )}
    </div>
  )
}
