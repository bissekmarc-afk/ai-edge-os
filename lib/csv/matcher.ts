// ── lib/csv/matcher.ts ────────────────────────────────────────────────────────
//
// Rapprochement bank_transactions ↔ finance_entries (scenario=actual).
// Critères : montant exact (±0.02 €) + date ±3 jours + similarité libellé.

import type { ParsedTransaction } from "./parsers"

export interface MatchCandidate {
  id:     string
  date:   string   // YYYY-MM-DD
  label:  string
  amount: number   // always positive (finance_entries convention)
  source: string
}

export interface MatchResult {
  transaction:     ParsedTransaction
  matchStatus:     "matched" | "unmatched" | "excluded"
  matchedEntryId:  string | null
  matchScore:      number
  matchedEntry:    MatchCandidate | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AMOUNT_TOLERANCE_EUR = 0.02
const DATE_TOLERANCE_DAYS  = 3
const LABEL_THRESHOLD      = 0.25   // Jaccard minimum pour considérer un match

function daysDiff(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return Math.floor(ms / 86_400_000)
}

/** Tokenise et normalise un libellé en set de mots (≥ 3 chars) */
function tokenize(s: string): Set<string> {
  const normalized = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 3)
  return new Set(normalized)
}

/** Similarité de Jaccard sur ensembles de mots */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0
  const intersection = [...a].filter(w => b.has(w)).length
  const union        = new Set([...a, ...b]).size
  return intersection / union
}

// ─── Matching ─────────────────────────────────────────────────────────────────

/**
 * Rapproche chaque transaction contre les candidats finance_entries.
 * Les transactions exclues (DEBIT DIFFERE, Carte bancaire) sont directement
 * marquées 'excluded' sans recherche.
 *
 * @param transactions Transactions parsées du CSV
 * @param candidates   Entrées finance_entries pour la plage de dates concernée
 */
export function matchTransactions(
  transactions: ParsedTransaction[],
  candidates:   MatchCandidate[],
): MatchResult[] {
  // Pré-calculer les tokens des candidats une seule fois
  const candidateTokens = candidates.map(c => ({
    ...c,
    tokens: tokenize(c.label),
  }))

  return transactions.map(txn => {
    // Transaction exclue → pas de matching
    if (txn.excluded) {
      return {
        transaction:    txn,
        matchStatus:    "excluded",
        matchedEntryId: null,
        matchScore:     0,
        matchedEntry:   null,
      }
    }

    const txnAmount = Math.abs(txn.amount)
    const txnTokens = tokenize(txn.label)

    // 1. Filtrer par montant ±AMOUNT_TOLERANCE et date ±DATE_TOLERANCE_DAYS
    const eligible = candidateTokens.filter(c => {
      const amountOk = Math.abs(c.amount - txnAmount) <= AMOUNT_TOLERANCE_EUR
      const dateOk   = daysDiff(txn.date, c.date) <= DATE_TOLERANCE_DAYS
      return amountOk && dateOk
    })

    if (eligible.length === 0) {
      return {
        transaction:    txn,
        matchStatus:    "unmatched",
        matchedEntryId: null,
        matchScore:     0,
        matchedEntry:   null,
      }
    }

    // 2. Scorer par similarité libellé + proximité de date
    const scored = eligible.map(c => {
      const labelScore = jaccardSimilarity(txnTokens, c.tokens)
      const dateScore  = 1 - daysDiff(txn.date, c.date) / (DATE_TOLERANCE_DAYS + 1)
      return { candidate: c, score: labelScore * 0.75 + dateScore * 0.25 }
    }).sort((a, b) => b.score - a.score)

    const best = scored[0]

    if (best.score >= LABEL_THRESHOLD) {
      return {
        transaction:    txn,
        matchStatus:    "matched",
        matchedEntryId: best.candidate.id,
        matchScore:     Math.round(best.score * 100) / 100,
        matchedEntry:   best.candidate,
      }
    }

    // Candidats trouvés mais score insuffisant
    return {
      transaction:    txn,
      matchStatus:    "unmatched",
      matchedEntryId: null,
      matchScore:     Math.round(best.score * 100) / 100,
      matchedEntry:   null,
    }
  })
}
