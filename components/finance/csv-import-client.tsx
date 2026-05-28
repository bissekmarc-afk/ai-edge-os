"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedEntry {
  external_id:   string
  source:        string
  date:          string
  label:         string
  category:      string
  amount:        number
  currency:      string
  entry_type:    "income" | "expense"
  flux_nature:   string
  month:         number
  year:          number
  scenario:      string
  sync_status:   string
}

interface SkipDetail  { line: number; reason: string; raw: string }
interface ErrorDetail { line: number; reason: string; raw: string }

interface ParseResult {
  parsed:           number
  skipped:          number
  errors:           number
  headers_detected: string[]
  entries:          ParsedEntry[]
  skipped_detail:   SkipDetail[]
  error_detail:     ErrorDetail[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAmount(amount: number, type: "income" | "expense"): string {
  const sign = type === "expense" ? "-" : "+"
  return `${sign}${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CsvImportClient() {
  const inputRef             = useRef<HTMLInputElement>(null)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<ParseResult | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = inputRef.current?.files?.[0]
    if (!file) return

    setLoading(true)
    setResult(null)
    setApiError(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res  = await fetch("/api/import/csv-bootstrap", { method: "POST", body: formData })
      const data = await res.json() as ParseResult & { error?: string }

      if (!res.ok) {
        setApiError(data.error ?? `Erreur HTTP ${res.status}`)
        return
      }

      setResult(data)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setFileName(file?.name ?? null)
    setResult(null)
    setApiError(null)
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Upload form ─────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="csv-file"
            className="text-sm font-medium text-foreground"
          >
            Fichier CSV Caisse d'Épargne
          </label>

          <div className="flex items-center gap-3">
            <label
              htmlFor="csv-file"
              className="cursor-pointer rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-ring hover:bg-muted/60"
            >
              {fileName ?? "Choisir un fichier .csv"}
            </label>
            <input
              id="csv-file"
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleFileChange}
            />

            <Button type="submit" disabled={!fileName || loading}>
              {loading ? "Parsing en cours…" : "Analyser"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Séparateur <code>;</code> · encodage latin-1 · colonnes Date, Libellé, Debit, Credit
          </p>
        </div>
      </form>

      {/* ── Erreur API ──────────────────────────────────────────────────── */}
      {apiError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="font-medium">Erreur : </span>{apiError}
        </div>
      )}

      {/* ── Résultats ───────────────────────────────────────────────────── */}
      {result && (
        <div className="flex flex-col gap-4">

          {/* Compteurs */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Lignes parsées"  value={result.parsed}  color="green" />
            <Stat label="Lignes skippées" value={result.skipped} color="yellow" />
            <Stat label="Erreurs"         value={result.errors}  color="red" />
          </div>

          {/* Headers détectés */}
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Headers détectés : </span>
            {result.headers_detected.join(" · ")}
          </div>

          {/* Tableau des entrées */}
          {result.entries.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Entrées parsées ({result.entries.length})
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Libellé</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Montant</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mois/An</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.entries.map((entry, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-3 py-2 font-mono text-muted-foreground">{entry.date}</td>
                        <td className="max-w-[260px] truncate px-3 py-2 font-medium">{entry.label}</td>
                        <td className={`px-3 py-2 text-right font-mono font-medium ${
                          entry.entry_type === "income"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}>
                          {fmtAmount(entry.amount, entry.entry_type)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground capitalize">{entry.flux_nature}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {String(entry.month).padStart(2, "0")}/{entry.year}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Erreurs de parsing */}
          {result.error_detail.length > 0 && (
            <details className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-destructive">
                {result.error_detail.length} erreur(s) de parsing
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {result.error_detail.map((e, i) => (
                  <li key={i} className="text-xs text-destructive/80">
                    Ligne {e.line} — {e.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Lignes skippées */}
          {result.skipped_detail.length > 0 && (
            <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                {result.skipped_detail.length} ligne(s) ignorée(s)
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {result.skipped_detail.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    Ligne {s.line} — {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Stat chip ───────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: "green" | "yellow" | "red"
}) {
  const colors = {
    green:  "border-green-500/30  bg-green-500/10  text-green-700  dark:text-green-400",
    yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    red:    "border-red-500/30    bg-red-500/10    text-red-700    dark:text-red-400",
  }
  return (
    <div className={`rounded-lg border px-3 py-3 text-center ${colors[color]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs opacity-80">{label}</p>
    </div>
  )
}
