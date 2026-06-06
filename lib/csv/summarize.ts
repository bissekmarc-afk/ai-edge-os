// ── lib/csv/summarize.ts ─────────────────────────────────────────────────────
//
// Groupe les transactions bancaires parsées par catégorie (colonne "Categorie"
// du CSV SG) et calcule les totaux de dépenses.
//
// Règles métier :
//   - Seules les transactions avec amount < 0 (débits) sont incluses
//   - Catégorie vide / null → "Non catégorisé"
//   - Tri par totalSpent DESC
//   - Les montants sont affichés en positif (abs)

import type { ParsedTransaction } from "./parsers"

export interface BankCategorySummary {
  category:         string
  totalSpent:       number   // positif, en euros
  transactionCount: number
  shareOfTotalPct:  number   // 0–100
}

const MONTHS_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août",  "sept.", "oct.", "nov.", "déc.",
]

/** "YYYY-MM-DD" → "DD/MM/YYYY" */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

/** "YYYY-MM-DD" → "Mai 2026" */
function fmtMonth(iso: string): string {
  const [y, m] = iso.split("-")
  return `${MONTHS_FR[parseInt(m, 10) - 1]} ${y}`
}

/**
 * Calcule la période couverte par les débits parsés.
 * - Même mois calendaire → "Mai 2026"
 * - Plusieurs mois      → "01/05/2026 → 30/06/2026"
 * - Aucune transaction  → "—"
 */
export function computePeriod(transactions: ParsedTransaction[]): string {
  const debits = transactions
    .filter(t => !t.excluded && t.amount < 0)
    .map(t => t.date)
    .sort()

  if (debits.length === 0) return "—"

  const minDate = debits[0]
  const maxDate = debits[debits.length - 1]

  return minDate.slice(0, 7) === maxDate.slice(0, 7)
    ? fmtMonth(minDate)
    : `${fmtDate(minDate)} → ${fmtDate(maxDate)}`
}

/**
 * Agrège les débits par catégorie bancaire.
 *
 * @param transactions Transactions parsées par lib/csv/parsers.ts
 */
export function summarizeByBankCategory(
  transactions: ParsedTransaction[],
): BankCategorySummary[] {
  const groups = new Map<string, { total: number; count: number }>()

  for (const t of transactions) {
    if (t.excluded || t.amount >= 0) continue  // crédits et exclus ignorés

    const category = t.categoryBank?.trim() || "Non catégorisé"
    const cur      = groups.get(category) ?? { total: 0, count: 0 }
    cur.total += Math.abs(t.amount)
    cur.count++
    groups.set(category, cur)
  }

  const globalTotal = [...groups.values()].reduce((s, g) => s + g.total, 0)

  return [...groups.entries()]
    .map(([category, g]) => ({
      category,
      totalSpent:       Math.round(g.total * 100) / 100,
      transactionCount: g.count,
      shareOfTotalPct:  globalTotal > 0
        ? Math.round((g.total / globalTotal) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
}
