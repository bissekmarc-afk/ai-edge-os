// ── lib/csv/matcher.ts ────────────────────────────────────────────────────────
//
// Algorithme de rapprochement amount-first, sans similarité de libellé.
//
// Stratégies (par priorité) :
//   1. exact_signed  — même mois + montant signé exact (centimes)
//   2. absolute      — même mois + abs(montant) exact  (fallback sign-agnostic)
//   3. no_match      — aucun candidat

import type { ParsedTransaction } from "./parsers"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatchCandidate {
  id:           string
  date:         string             // YYYY-MM-DD
  label:        string
  amount:       number             // toujours positif (convention finance_entries)
  signedAmount: number             // income → +amount, expense → -amount
  entry_type:   "income" | "expense"
  source:       string
}

export type MatchStrategy   = "exact_signed" | "absolute" | "no_match"
export type MatchConfidence = "high" | "medium" | "low"

export interface ReconciliationMatch {
  transaction:    ParsedTransaction
  /** DB value — 'ambiguous' est mappé vers 'matched' */
  matchStatus:    "matched" | "unmatched" | "excluded"
  matchedEntryId: string | null
  matchedEntry:   MatchCandidate | null
  /** 0.9 = high, 0.6 = medium, 0 = no_match */
  matchScore:     number
  confidence:     MatchConfidence
  strategy:       MatchStrategy
  reason:         string
}

/** Alias pour compatibilité avec le code existant */
export type MatchResult = ReconciliationMatch

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convertit un montant float en centimes entiers (évite les erreurs float). */
function toCents(amount: number): number {
  return Math.round(amount * 100)
}

/** Extrait YYYY-MM depuis une date YYYY-MM-DD. */
function toMonth(date: string): string {
  return date.slice(0, 7)
}

// ─── Matching ─────────────────────────────────────────────────────────────────

export function matchTransactions(
  transactions: ParsedTransaction[],
  candidates:   MatchCandidate[],
): ReconciliationMatch[] {

  // ── 1. Construire les index ─────────────────────────────────────────────────
  //
  // Index signed  : "YYYY-MM|centimes_signés" → MatchCandidate[]
  //   income entry → +centimes  (argent qui rentre)
  //   expense entry → -centimes (argent qui sort)
  //   bank credit  → +centimes  (même convention)
  //   bank debit   → -centimes  (même convention)
  //
  // Index absolu   : "YYYY-MM|abs_centimes" → MatchCandidate[]
  //   fallback quand le signe ne correspond pas (ex: virement classé
  //   différemment entre banque et budget).

  const signedIndex = new Map<string, MatchCandidate[]>()
  const absIndex    = new Map<string, MatchCandidate[]>()

  for (const c of candidates) {
    const month      = toMonth(c.date)
    const signedKey  = `${month}|${toCents(c.signedAmount)}`
    const absKey     = `${month}|${toCents(c.amount)}`

    const sl = signedIndex.get(signedKey) ?? []; sl.push(c); signedIndex.set(signedKey, sl)
    const al = absIndex.get(absKey)       ?? []; al.push(c); absIndex.set(absKey, al)
  }

  // Debug : aperçu de l'index
  const signedKeys = [...signedIndex.entries()]
    .map(([k, v]) => `${k}(×${v.length})`).slice(0, 15).join(" ")
  console.log(`[matcher] index signed (${signedIndex.size} keys): ${signedKeys}`)

  // ── 2. Ensemble de déduplication ───────────────────────────────────────────
  //
  // Chaque finance_entry ne peut être rapprochée qu'une seule fois.
  // Si deux transactions bancaires ont le même montant/mois, la première
  // prend le match ; la seconde passe en stratégie absolute ou no_match.

  const usedIds = new Set<string>()

  // ── 3. Collecter les raisons d'échec pour le résumé ───────────────────────
  const unmatchedLog: string[] = []

  // ── 4. Traitement transaction par transaction ──────────────────────────────

  const results: ReconciliationMatch[] = transactions.map(txn => {

    // Exclues (DEBIT DIFFERE, Carte bancaire) → pas de matching
    if (txn.excluded) {
      return {
        transaction: txn, matchStatus: "excluded",
        matchedEntryId: null, matchedEntry: null,
        matchScore: 0, confidence: "low",
        strategy: "no_match", reason: txn.excludeReason ?? "excluded",
      }
    }

    const txnCents    = toCents(txn.amount)          // signé (- = débit)
    const txnAbsCents = Math.abs(txnCents)
    const txnMonth    = toMonth(txn.date)

    // ── Stratégie 1 : montant signé exact + même mois ─────────────────────
    const signedKey        = `${txnMonth}|${txnCents}`
    const signedCandidates = (signedIndex.get(signedKey) ?? [])
      .filter(c => !usedIds.has(c.id))

    if (signedCandidates.length > 0) {
      const best       = signedCandidates[0]   // déterministe : premier de la liste
      const ambiguous  = signedCandidates.length > 1
      usedIds.add(best.id)
      return {
        transaction: txn, matchStatus: "matched",
        matchedEntryId: best.id, matchedEntry: best,
        matchScore:    ambiguous ? 0.6 : 0.9,
        confidence:    ambiguous ? "medium" : "high",
        strategy:      "exact_signed",
        reason: ambiguous
          ? `${signedCandidates.length} candidats à ${(txnAbsCents / 100).toFixed(2)}€ en ${txnMonth} — premier sélectionné`
          : `Montant signé exact (${(txnAbsCents / 100).toFixed(2)}€) en ${txnMonth}`,
      }
    }

    // ── Stratégie 2 : abs(montant) même mois (fallback sign-agnostic) ─────
    const absKey        = `${txnMonth}|${txnAbsCents}`
    const absCandidates = (absIndex.get(absKey) ?? [])
      .filter(c => !usedIds.has(c.id))

    if (absCandidates.length > 0) {
      const best = absCandidates[0]
      usedIds.add(best.id)
      return {
        transaction: txn, matchStatus: "matched",
        matchedEntryId: best.id, matchedEntry: best,
        matchScore: 0.6, confidence: "medium",
        strategy: "absolute",
        reason: `abs(${(txnAbsCents / 100).toFixed(2)}€) en ${txnMonth} — signe différent (${best.entry_type})`,
      }
    }

    // ── Stratégie 3 : aucun candidat ──────────────────────────────────────
    unmatchedLog.push(
      `  ${(txnAbsCents / 100).toFixed(2).padStart(10)}€ | ${txnMonth} | "${txn.label.slice(0, 45)}"`,
    )
    return {
      transaction: txn, matchStatus: "unmatched",
      matchedEntryId: null, matchedEntry: null,
      matchScore: 0, confidence: "low",
      strategy: "no_match",
      reason: `Aucun candidat finance_entries pour ${(txnAbsCents / 100).toFixed(2)}€ en ${txnMonth}`,
    }
  })

  // ── Résumé ─────────────────────────────────────────────────────────────────
  const matched   = results.filter(r => r.matchStatus === "matched").length
  const unmatched = results.filter(r => r.matchStatus === "unmatched").length
  const excluded  = results.filter(r => r.matchStatus === "excluded").length
  const high      = results.filter(r => r.confidence === "high").length
  const medium    = results.filter(r => r.confidence === "medium" && r.matchStatus === "matched").length

  console.log(
    `[matcher] ── résumé ──\n` +
    `  matched  : ${matched} (high=${high} medium=${medium})\n` +
    `  unmatched: ${unmatched}\n` +
    `  excluded : ${excluded}`,
  )

  if (unmatchedLog.length > 0) {
    console.log(
      `[matcher] transactions sans candidat (${unmatchedLog.length}):\n` +
      unmatchedLog.join("\n"),
    )
  }

  return results
}
