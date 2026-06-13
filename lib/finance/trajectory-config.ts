// ── lib/finance/trajectory-config.ts ─────────────────────────────────────────
//
// Jalons patrimoniaux et seuils de statut.
// Toutes les valeurs monétaires sont exprimées en EUR constants 2026.

export type MilestoneTrigger = {
  type:        "sale" | "investment" | "cashflow" | "lbo" | "buildup"
  action:      string        // description courte de l'action déclenchante
  dependency?: string        // libellé du jalon précédent dont il dépend
  amount?:     number        // montant de l'opération déclenchante (EUR)
}

export type TrajectoryMilestone = {
  year:             number
  month?:           number
  toleranceMonths?: number
  target:           number
  label:            string
  currencyBasis:    "EUR_CONSTANT_2026"
  trigger:          MilestoneTrigger
}

export const TRAJECTORY_MILESTONES: TrajectoryMilestone[] = [
  {
    year:          2027,
    target:        145_000,
    label:         "Déploiement PE1 + Immo + Art",
    currencyBasis: "EUR_CONSTANT_2026",
    trigger: {
      type:   "sale",
      action: "Vente actif + déploiement PE1 + Immo Grèce + Art1",
      amount: 90_000,
    },
  },
  {
    year:          2030,
    target:        420_000,
    label:         "Accélération patrimoine",
    currencyBasis: "EUR_CONSTANT_2026",
    trigger: {
      type:       "investment",
      action:     "Cash-flow PE1 + Art2 + New Ticket PE",
      dependency: "2027 — Déploiement réussi",
    },
  },
  {
    year:          2034,
    target:        800_000,
    label:         "War Chest LBO",
    currencyBasis: "EUR_CONSTANT_2026",
    trigger: {
      type:       "lbo",
      action:     "War Chest constitué — apport LBO PME 800k€",
      dependency: "2030 — Accélération PE",
      amount:     800_000,
    },
  },
  {
    year:          2044,
    target:        8_100_000,
    label:         "LBO + Build-up — Apogée",
    currencyBasis: "EUR_CONSTANT_2026",
    trigger: {
      type:       "buildup",
      action:     "Cash-flow PME + Build-up + Art institutionnel",
      dependency: "2034 — LBO exécuté",
    },
  },
]

export const TRAJECTORY_THRESHOLDS = {
  green:  0.70,
  orange: 0.30,
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Icône emoji associée à chaque type de déclencheur. */
export const TRIGGER_ICON: Record<MilestoneTrigger["type"], string> = {
  sale:       "💰",
  investment: "📈",
  cashflow:   "📈",
  lbo:        "🏭",
  buildup:    "🏗️",
}

/**
 * Retourne true si la dépendance d'un jalon est satisfaite.
 * Un jalon sans dépendance est toujours accessible.
 * Un jalon avec dépendance requiert que le jalon précédent soit atteint.
 */
export function isDependencyMet(
  milestone:  TrajectoryMilestone,
  netWorth:   number,
): boolean {
  if (!milestone.trigger.dependency) return true
  // Trouver le jalon précédent dans la liste ordonnée
  const idx = TRAJECTORY_MILESTONES.findIndex((m) => m.year === milestone.year)
  if (idx <= 0) return true
  const prev = TRAJECTORY_MILESTONES[idx - 1]
  return netWorth >= prev.target
}
