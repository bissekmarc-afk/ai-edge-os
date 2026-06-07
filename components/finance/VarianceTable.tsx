// ─── VarianceTable (Server Component) ────────────────────────────────────────
//
// Deux blocs fixes toujours visibles :
//
//   1. Variance YTD  — actual cumulé mai→mois courant inclus
//                      vs budget_initial même plage
//      Label : "YTD mai → juin 2026 (mois courant inclus)"
//
//   2. Variance MTD  — actual mois courant vs budget_initial mois courant
//      Label : "MTD juin 2026"
//
// Outer merge : union(actualCategories, budgetCategories) par catégorie.
// Variance % : budget = 0 → "N/A"

import { cn }                    from "@/lib/utils"
import { getYearRows }           from "@/lib/finance/queries"
import { computePL }             from "@/lib/finance/aggregations"
import type { FinanceEntry }     from "@/lib/finance/aggregations"

// ─── Constantes périmètre budget ──────────────────────────────────────────────

const BUDGET_START_MONTH = 5
const BUDGET_START_YEAR  = 2026

// ─── Formatters ───────────────────────────────────────────────────────────────

const EUR = new Intl.NumberFormat("fr-FR", {
  style:                "currency",
  currency:             "EUR",
  maximumFractionDigits: 0,
})

function fmtEur(n: number)    { return EUR.format(n) }
function fmtPct(n: number)    { return `${n >= 0 ? "+" : ""}${n.toFixed(1)} %` }
function fmtSigned(n: number) { return `${n >= 0 ? "+" : ""}${fmtEur(n)}` }

function fmtMonth(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("fr-FR", { month: "long" })
}

// ─── Types ────────────────────────────────────────────────────────────────────

type VarianceStatus = "ok" | "favourable" | "unfavourable" | "na"

interface VarianceRow {
  category:    string
  actual:      number        // normalisé (abs pour dépenses)
  budget:      number        // normalisé
  varianceEur: number        // actual − budget
  variancePct: number | null // null si budget = 0
  status:      VarianceStatus
  entryType:   "income" | "expense"
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CLS: Record<VarianceStatus, string> = {
  ok:           "bg-muted text-muted-foreground",
  favourable:   "bg-[var(--success)]/10 text-[var(--success)]",
  unfavourable: "bg-[var(--danger)]/10  text-[var(--danger)]",
  na:           "bg-muted/60 text-muted-foreground",
}

const STATUS_LABEL: Record<VarianceStatus, string> = {
  ok:           "OK",
  favourable:   "Favorable",
  unfavourable: "Alerte",
  na:           "N/A",
}

function StatusBadge({ status }: { status: VarianceStatus }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_CLS[status])}>
      {STATUS_LABEL[status]}
    </span>
  )
}

// ─── Normalisation des catégories ────────────────────────────────────────────
//
// budget_initial et actual peuvent utiliser des libellés différents pour
// la même catégorie économique. Cette map ramène les variantes vers une
// catégorie canonique (clé merge + libellé affiché).
//
// Format : "variante_normalisée" → "Catégorie Canonique"

const CATEGORY_ALIASES: Record<string, string> = {
  "debt repayments": "Debt",
  "debt repayment":  "Debt",
  "remboursements":  "Debt",
  "loan repayments": "Debt",
  "loan repayment":  "Debt",
}

/**
 * Retourne la catégorie canonique à utiliser comme clé de merge.
 * Le display (affiché à l'utilisateur) reprend la valeur canonique.
 */
function normalizeCategory(cat: string): { key: string; display: string } {
  const trimmed = cat.trim()
  const lower   = trimmed.toLowerCase()
  const canonical = CATEGORY_ALIASES[lower]
  if (canonical) {
    return { key: canonical.toLowerCase(), display: canonical }
  }
  return { key: lower || "non categorise", display: trimmed || "Non catégorisé" }
}

// ─── Résolution du type income / expense ──────────────────────────────────────
//
// budget_initial et actual stockent parfois des entry_type incorrects
// (null, "revenue" au lieu de "income", ou "expense" pour des revenus).
// On force la classification via la catégorie normalisée en priorité.
//
// Priorité : catégorie connue > entry_type de la DB > défaut "expense"

const INCOME_CATEGORIES = new Set([
  "income", "revenue", "revenues", "salaire", "loyer recu",
])

const EXPENSE_CATEGORIES = new Set([
  "personal", "housing", "transport", "food", "health", "leisure",
  "debt", "debt repayments", "debt repayment", "loan repayments", "loan repayment",
  "savings", "savings or investments", "investment", "investments",
  "tontine", "capex", "tax", "taxes", "odd", "one-off",
  "big & one-offs", "big one-offs", "gifts", "gift", "art",
])

function resolveEntryType(
  rawType: string | null,
  catKey:  string,          // clé normalisée (toLowerCase, sans accents)
): "income" | "expense" {
  // 1. Catégorie explicitement reconnue comme income
  if (INCOME_CATEGORIES.has(catKey)) return "income"
  // 2. Catégorie explicitement reconnue comme expense
  if (EXPENSE_CATEGORIES.has(catKey)) return "expense"
  // 3. Fallback sur le entry_type de la DB
  if (rawType === "income" || rawType === "revenue") return "income"
  // 4. Défaut : expense
  return "expense"
}

// ─── Statut variance ──────────────────────────────────────────────────────────
//
// Seuils (calculés sur variancePct = varianceEur / budgetNorm × 100) :
//
//   expense :
//     variancePct > +15%  → "unfavourable" (sur-dépense)
//     variancePct < -5%   → "favourable"   (économie)
//     sinon               → "ok"
//
//   income :
//     variancePct < -15%  → "unfavourable" (sous-recette)
//     variancePct > +5%   → "favourable"   (surplus)
//     sinon               → "ok"

function getVarianceStatus(
  variancePct: number,
  entryType:   "income" | "expense",
): VarianceStatus {
  if (entryType === "expense") {
    if (variancePct > 15)  return "unfavourable"
    if (variancePct < -5)  return "favourable"
    return "ok"
  }
  // income
  if (variancePct < -15) return "unfavourable"
  if (variancePct > 5)   return "favourable"
  return "ok"
}

// ─── Agrégation par catégorie ─────────────────────────────────────────────────
//
// Les montants actual expense sont stockés négatifs en DB (Cash Out).
// On normalise immédiatement à la valeur absolue pour les dépenses,
// afin que les comparaisons actual vs budget soient homogènes :
//   expense → Math.abs(amount)   (toujours positif)
//   income  → amount             (toujours positif en pratique)

type CatBucket = { raw: number; entryType: "income" | "expense"; display: string }

function aggregateByCategory(entries: FinanceEntry[]): Map<string, CatBucket> {
  const map = new Map<string, CatBucket>()
  for (const row of entries) {
    const { key, display } = normalizeCategory(row.category ?? "")
    const rawType   = row.entry_type as string | null
    const entryType = resolveEntryType(rawType, key)

    // Normaliser dès l'agrégation : expense → abs, income → tel quel
    const rawAmount = Number(row.amount ?? 0)
    const amount    = entryType === "expense" ? Math.abs(rawAmount) : rawAmount

    const existing = map.get(key)
    if (existing) {
      existing.raw += amount
    } else {
      map.set(key, { raw: amount, entryType, display })
    }
  }
  return map
}

// ─── Outer merge ──────────────────────────────────────────────────────────────
//
// entryType final résolu via resolveEntryType(catKey) — catégorie prime
// sur le entry_type stocké en DB (peut être erroné dans budget_initial).
// varianceEur = actualNorm − budgetNorm (toujours positifs après agrégation).

function buildVarianceRows(
  actualMap: Map<string, CatBucket>,
  budgetMap: Map<string, CatBucket>,
): VarianceRow[] {
  const keys = new Set([...actualMap.keys(), ...budgetMap.keys()])

  return [...keys].map(key => {
    const a = actualMap.get(key)
    const b = budgetMap.get(key)

    // entryType : priorité à la catégorie (résolution par nom) pour corriger
    // les erreurs de classification en DB (budget_initial entry_type = null etc.)
    const rawType   = (b?.entryType ?? a?.entryType ?? null) as string | null
    const entryType = resolveEntryType(rawType, key)
    const category  = b?.display ?? a?.display ?? key

    // raw est déjà normalisé positif dans aggregateByCategory
    const actualNorm = a?.raw ?? 0
    const budgetNorm = b?.raw ?? 0

    const varianceEur = actualNorm - budgetNorm

    let variancePct: number | null = null
    let status: VarianceStatus = "na"

    if (budgetNorm !== 0) {
      variancePct = (varianceEur / budgetNorm) * 100
      status      = getVarianceStatus(variancePct, entryType)
    }

    return { category, actual: actualNorm, budget: budgetNorm, varianceEur, variancePct, status, entryType }
  })
}

// ─── Table générique ──────────────────────────────────────────────────────────

function VarianceTableBody({
  rows,
  sortMode = "alert-first",
}: {
  rows:     VarianceRow[]
  sortMode?: "alert-first" | "variance-abs"
}) {
  const sorted = [...rows].sort((a, b) => {
    if (sortMode === "alert-first") {
      const priority = (s: VarianceStatus) => s === "unfavourable" ? 0 : s === "favourable" ? 1 : 2
      const p = priority(a.status) - priority(b.status)
      if (p !== 0) return p
    }
    return Math.abs(b.varianceEur) - Math.abs(a.varianceEur)
  })

  if (sorted.length === 0) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-6 text-center text-xs text-muted-foreground">
          Aucune donnée disponible.
        </td>
      </tr>
    )
  }

  return (
    <>
      {sorted.map((row, i) => (
        <tr
          key={i}
          className={cn(
            "transition-colors",
            row.status === "unfavourable" && "bg-[var(--danger)]/4",
            row.status === "favourable"   && "bg-[var(--success)]/4",
          )}
        >
          <td className="px-4 py-2 font-medium capitalize text-foreground">
            {row.category}
          </td>
          <td className="px-4 py-2 text-right tabular-nums font-mono">
            {fmtEur(row.actual)}
          </td>
          <td className="px-4 py-2 text-right tabular-nums font-mono text-muted-foreground">
            {row.budget > 0 ? fmtEur(row.budget) : <span className="text-muted-foreground/50">—</span>}
          </td>
          <td
            className={cn(
              "px-4 py-2 text-right tabular-nums font-mono",
              row.varianceEur > 0 && row.entryType === "income"  && "text-[var(--success)]",
              row.varianceEur < 0 && row.entryType === "income"  && "text-[var(--danger)]",
              row.varianceEur > 0 && row.entryType === "expense" && "text-[var(--danger)]",
              row.varianceEur < 0 && row.entryType === "expense" && "text-[var(--success)]",
              row.varianceEur === 0                               && "text-muted-foreground",
            )}
          >
            {fmtSigned(row.varianceEur)}
          </td>
          <td className="px-4 py-2 text-right tabular-nums font-mono text-muted-foreground">
            {row.variancePct !== null ? fmtPct(row.variancePct) : (
              <span className="text-muted-foreground/50">N/A</span>
            )}
          </td>
          <td className="px-4 py-2 text-center">
            <StatusBadge status={row.status} />
          </td>
        </tr>
      ))}
    </>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VarianceTableProps {
  currentMonth: number
  currentYear:  number
}

// ─── Component ────────────────────────────────────────────────────────────────

export async function VarianceTable({ currentMonth, currentYear }: VarianceTableProps) {

  // Guard : le budget couvre uniquement BUDGET_START_YEAR, mois ≥ BUDGET_START_MONTH
  const inBudgetScope = currentYear === BUDGET_START_YEAR && currentMonth >= BUDGET_START_MONTH

  // Fetch 2 requêtes (toute l'année), filtrer en mémoire pour YTD et MTD
  const [allActual, allBudget] = await Promise.all([
    getYearRows(currentYear, "actual"),
    inBudgetScope ? getYearRows(currentYear, "budget_initial") : Promise.resolve([]),
  ])

  // ── Plages ──────────────────────────────────────────────────────────────────

  const ytdStart = BUDGET_START_MONTH  // toujours mai

  const filterRange = (rows: FinanceEntry[], mMin: number, mMax: number) =>
    rows.filter(r => r.month != null && r.month >= mMin && r.month <= mMax)

  const ytdActualRows = filterRange(allActual, ytdStart, currentMonth)
  const ytdBudgetRows = filterRange(allBudget, ytdStart, currentMonth)
  const mtdActualRows = filterRange(allActual, currentMonth, currentMonth)
  const mtdBudgetRows = filterRange(allBudget, currentMonth, currentMonth)

  // ── Agrégation & merge ──────────────────────────────────────────────────────

  const ytdRows = buildVarianceRows(
    aggregateByCategory(ytdActualRows),
    aggregateByCategory(ytdBudgetRows),
  )

  const mtdRows = buildVarianceRows(
    aggregateByCategory(mtdActualRows),
    aggregateByCategory(mtdBudgetRows),
  )

  // ── NCF de synthèse via computePL() ─────────────────────────────────────────
  //
  // Utilise computePL() sur les lignes brutes pour un NCF exact (même logique
  // que le P&L Statement), plutôt que de reconstituer à partir des catégories.

  const ytdActualNcf = computePL(ytdActualRows).netCashFlow
  const ytdBudgetNcf = computePL(ytdBudgetRows).netCashFlow

  // ── Labels ──────────────────────────────────────────────────────────────────

  const ytdLabel = ytdStart === currentMonth
    ? `YTD ${fmtMonth(ytdStart)} ${currentYear} (mois courant)`
    : `YTD ${fmtMonth(ytdStart)} → ${fmtMonth(currentMonth)} ${currentYear}`

  const mtdLabel = `MTD ${fmtMonth(currentMonth)} ${currentYear}`

  const thead = (
    <thead>
      <tr className="border-b border-border/50 text-muted-foreground">
        <th className="px-4 py-2 text-left   text-xs font-medium">Catégorie</th>
        <th className="px-4 py-2 text-right  text-xs font-medium">Actual</th>
        <th className="px-4 py-2 text-right  text-xs font-medium">Budget</th>
        <th className="px-4 py-2 text-right  text-xs font-medium">Variance €</th>
        <th className="px-4 py-2 text-right  text-xs font-medium">Variance %</th>
        <th className="px-4 py-2 text-center text-xs font-medium">Statut</th>
      </tr>
    </thead>
  )

  return (
    <div className="flex flex-col gap-4">

      {/* ── Bandeau contexte ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/60 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        <span>
          Périmètre budget :&nbsp;
          <strong className="font-medium text-foreground">
            mai {BUDGET_START_YEAR} → déc {BUDGET_START_YEAR}
          </strong>
        </span>
        <span className="text-border">·</span>
        <span>
          YTD as of&nbsp;
          <strong className="font-medium text-foreground">
            {fmtMonth(currentMonth)} {currentYear}
          </strong>
        </span>
      </div>

      {/* ══ Variance YTD ════════════════════════════════════════════════════ */}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Variance YTD
            </p>
            <span className="text-[10px] text-muted-foreground">
              {ytdLabel}
            </span>
            {/* Indicateur mois courant partiel */}
            <span className="rounded bg-[var(--warning)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--warning)]">
              mois courant partiel
            </span>
          </div>
          {/* NCF YTD */}
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold",
              (ytdActualNcf - ytdBudgetNcf) >= 0
                ? "bg-[var(--success)]/10 text-[var(--success)]"
                : "bg-[var(--danger)]/10  text-[var(--danger)]",
            )}
          >
            NCF {fmtSigned(ytdActualNcf - ytdBudgetNcf)}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            {thead}
            <tbody className="divide-y divide-border/30">
              <VarianceTableBody rows={ytdRows} sortMode="variance-abs" />
            </tbody>
            {/* Totaux YTD */}
            <tfoot>
              <tr className="border-t border-border bg-muted/30 text-xs font-semibold">
                <td className="px-4 py-2 text-foreground">Net Cash Flow YTD</td>
                <td className="px-4 py-2 text-right tabular-nums font-mono">
                  {fmtEur(ytdActualNcf)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-mono text-muted-foreground">
                  {fmtEur(ytdBudgetNcf)}
                </td>
                <td
                  className={cn(
                    "px-4 py-2 text-right tabular-nums font-mono",
                    (ytdActualNcf - ytdBudgetNcf) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]",
                  )}
                >
                  {fmtSigned(ytdActualNcf - ytdBudgetNcf)}
                </td>
                <td className="px-4 py-2 text-right text-muted-foreground/50 text-xs">N/A</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ══ Variance MTD ════════════════════════════════════════════════════ */}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Variance MTD
          </p>
          <span className="text-xs font-medium text-foreground">{mtdLabel}</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            {thead}
            <tbody className="divide-y divide-border/30">
              <VarianceTableBody rows={mtdRows} sortMode="alert-first" />
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
