// ── lib/finance/trajectory-config.ts ─────────────────────────────────────────
//
// Jalons patrimoniaux et seuils de statut.
// Toutes les valeurs monétaires sont exprimées en EUR constants 2026.

export type TrajectoryMilestone = {
  year:          number
  target:        number
  label:         string
  currencyBasis: "EUR_CONSTANT_2026"
}

export const TRAJECTORY_MILESTONES: TrajectoryMilestone[] = [
  {
    year:          2027,
    target:        145_000,
    label:         "Déploiement PE1 + Immo + Art",
    currencyBasis: "EUR_CONSTANT_2026",
  },
  {
    year:          2030,
    target:        420_000,
    label:         "Accélération patrimoine",
    currencyBasis: "EUR_CONSTANT_2026",
  },
  {
    year:          2034,
    target:        800_000,
    label:         "War Chest LBO",
    currencyBasis: "EUR_CONSTANT_2026",
  },
  {
    year:          2044,
    target:        8_100_000,
    label:         "LBO + Build-up — Apogée",
    currencyBasis: "EUR_CONSTANT_2026",
  },
]

export const TRAJECTORY_THRESHOLDS = {
  green:  0.70,
  orange: 0.30,
} as const
