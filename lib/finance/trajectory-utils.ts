// ── lib/finance/trajectory-utils.ts ──────────────────────────────────────────
//
// Fonctions pures pour la trajectoire patrimoniale.
// Aucune dépendance externe. Edge cases gérés explicitement.

import {
  TRAJECTORY_MILESTONES,
  TRAJECTORY_THRESHOLDS,
} from "./trajectory-config"
import type { TrajectoryMilestone } from "./trajectory-config"

// ─── Formatters ───────────────────────────────────────────────────────────────

const EUR_FR = new Intl.NumberFormat("fr-FR", {
  style:                "currency",
  currency:             "EUR",
  maximumFractionDigits: 0,
})

export function formatAmount(n: number): string {
  return EUR_FR.format(n)
}

// ─── Calculs de trajectoire ───────────────────────────────────────────────────

/**
 * Nombre de mois entiers entre aujourd'hui et le 1er janvier de `targetYear`.
 * Retourne 0 si targetYear est passé ou égal à l'année courante.
 */
export function getMonthsRemaining(targetYear: number): number {
  const now = new Date()
  const target = new Date(targetYear, 0, 1)   // 1er janv. de l'année cible
  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 0) return 0
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4375))
}

/**
 * Écart entre l'objectif et le patrimoine actuel.
 * Retourne 0 si le patrimoine dépasse déjà la cible.
 */
export function calculateGap(target: number, current: number): number {
  return Math.max(0, target - current)
}

/**
 * Épargne mensuelle requise pour combler le gap en `months` mois.
 * Retourne null si months === 0 (cible déjà dépassée dans le temps).
 */
export function calculateRequiredMonthlySavings(
  gap:    number,
  months: number,
): number | null {
  if (months === 0) return null
  if (gap <= 0)     return 0
  return Math.ceil(gap / months)
}

/**
 * Ratio couverture = épargne actuelle / épargne requise.
 * - current = 0 → ratio = 0 (rouge)
 * - required = 0 → ratio = 1 (objectif déjà atteint)
 * - required = null → ratio = 1 (délai écoulé, on ne peut plus rien faire)
 */
export function calculateCoverageRatio(
  current:  number,
  required: number | null,
): number {
  if (required === null || required === 0) return 1
  if (current <= 0) return 0
  return Math.min(current / required, 1)
}

/**
 * Statut de trajectoire d'après les seuils de TRAJECTORY_THRESHOLDS.
 */
export function getTrajectoryStatus(ratio: number): "green" | "orange" | "red" {
  if (ratio >= TRAJECTORY_THRESHOLDS.green)  return "green"
  if (ratio >= TRAJECTORY_THRESHOLDS.orange) return "orange"
  return "red"
}

/**
 * Prochain jalon non encore atteint (netWorth < target).
 * Retourne null si tous les jalons sont déjà dépassés.
 */
export function getNextMilestone(netWorth: number): TrajectoryMilestone | null {
  return (
    TRAJECTORY_MILESTONES.find((m) => netWorth < m.target) ?? null
  )
}

// ─── Type agrégé retourné par buildTrajectoryContext() ───────────────────────

export type TrajectoryContext = {
  netWorth:               number
  savingsCurrent:         number
  nextMilestone:          TrajectoryMilestone
  allMilestones:          TrajectoryMilestone[]
  gap:                    number
  monthsRemaining:        number
  requiredMonthlySavings: number | null
  coverageRatio:          number
  status:                 "green" | "orange" | "red"
}

/**
 * Point d'entrée principal — agrège toutes les métriques de trajectoire.
 *
 * @param netWorth      Patrimoine net actuel (de computeBalanceSheet)
 * @param monthlySavings Épargne mensuelle actuelle (capex de computePL, peut être 0)
 * @returns TrajectoryContext | null si aucun jalon disponible
 */
export function buildTrajectoryContext(
  netWorth:       number,
  monthlySavings: number,
): TrajectoryContext | null {
  const nextMilestone = getNextMilestone(netWorth)
  if (!nextMilestone) return null  // tous les jalons dépassés

  const gap                    = calculateGap(nextMilestone.target, netWorth)
  const monthsRemaining        = getMonthsRemaining(nextMilestone.year)
  const requiredMonthlySavings = calculateRequiredMonthlySavings(gap, monthsRemaining)
  const coverageRatio          = calculateCoverageRatio(monthlySavings, requiredMonthlySavings)
  const status                 = getTrajectoryStatus(coverageRatio)

  return {
    netWorth,
    savingsCurrent:  monthlySavings,
    nextMilestone,
    allMilestones:   TRAJECTORY_MILESTONES,
    gap,
    monthsRemaining,
    requiredMonthlySavings,
    coverageRatio,
    status,
  }
}
