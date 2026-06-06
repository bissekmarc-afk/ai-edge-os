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

/**
 * Deux dates sont dans le même mois calendaire (YYYY-MM).
 * Utilisé comme fallback pour les finance_entries datées au 1er du mois
 * (export Google Sheets : toutes les entrées d'un mois → date = YYYY-MM-01).
 */
function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
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
  // ── Debug : inspecter le premier exemple de chaque côté ──────────────────
  const firstActive = transactions.find(t => !t.excluded)
  if (firstActive) {
    console.log(
      `[matcher] first bank_txn  : date="${firstActive.date}" amount=${firstActive.amount}` +
      ` label="${firstActive.label.slice(0, 50)}"`,
    )
  }
  if (candidates.length > 0) {
    const c0 = candidates[0]
    console.log(
      `[matcher] first fe_candidate: date="${c0.date}" amount=${c0.amount}` +
      ` label="${c0.label.slice(0, 50)}"`,
    )
  } else {
    console.warn("[matcher] ⚠️  0 finance_entries candidates → aucun rapprochement possible")
  }

  // Pré-calculer les tokens des candidats une seule fois
  const candidateTokens = candidates.map(c => ({
    ...c,
    tokens: tokenize(c.label),
  }))

  let debuggedFirst = false  // Logger un seul exemple de filtre dans les logs

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

    // 1. Filtrer par montant ±AMOUNT_TOLERANCE et date (±DATE_TOLERANCE_DAYS OU même mois).
    //
    //    Fallback "même mois" nécessaire car les finance_entries issues de Google Sheets
    //    sont toutes datées au 1er du mois (ex: 2026-05-01), tandis que les transactions
    //    bancaires ont des dates réelles (ex: 2026-05-15) → diff = 14 jours > 3 jours.
    const eligible = candidateTokens.filter(c => {
      const amountOk = Math.abs(c.amount - txnAmount) <= AMOUNT_TOLERANCE_EUR
      const dateOk   = daysDiff(txn.date, c.date) <= DATE_TOLERANCE_DAYS
                    || sameMonth(txn.date, c.date)
      return amountOk && dateOk
    })

    // Debug : logguer le premier cas pour diagnostiquer les filtres
    if (!debuggedFirst && !txn.excluded) {
      debuggedFirst = true
      const byAmount = candidateTokens.filter(c => Math.abs(c.amount - txnAmount) <= AMOUNT_TOLERANCE_EUR)
      const byDate   = candidateTokens.filter(c =>
        daysDiff(txn.date, c.date) <= DATE_TOLERANCE_DAYS || sameMonth(txn.date, c.date)
      )
      console.log(
        `[matcher] debug txn "${txn.label.slice(0, 40)}" amount=${txnAmount} date=${txn.date}` +
        ` | byAmount=${byAmount.length} byDate=${byDate.length} eligible=${eligible.length}`,
      )
    }

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
