import { z } from "zod"

// ─── Catégories disponibles ───────────────────────────────────────────────────

export const SAISIE_CATEGORIES = [
  "Income",
  "Tax",
  "Housing",
  "Transport",
  "Food",
  "Health",
  "Leisure",
  "Personal",
  "Gifts",
  "Debt Repayments",
  "Investment",
  "Tontine",
  "Savings",
  "Big & one-offs",
  "Art",
  "Legal",
  "Odd",
] as const

export type SaisieCategory = (typeof SAISIE_CATEGORIES)[number]

export const SAISIE_SUBTYPES = ["Fixed", "Variable", "One-off"] as const
export type SaisieSubtype = (typeof SAISIE_SUBTYPES)[number]

// ─── Schéma de validation ─────────────────────────────────────────────────────

export const saisieSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (format YYYY-MM-DD attendu)"),

  label: z
    .string()
    .min(1, "Libellé requis")
    .max(200, "Libellé trop long (200 caractères max)"),

  // Zod v4 : pas d'errorMap, le message custom va en second paramètre (string)
  category: z.enum(SAISIE_CATEGORIES, "Catégorie invalide"),

  flux_nature: z.enum(["Cash In", "Cash Out"] as const, "Sélectionner Cash In ou Cash Out"),

  // Toujours positif côté form — le signe est appliqué dans la Server Action
  amount: z.coerce
    .number()
    .positive("Le montant doit être supérieur à 0")
    .max(10_000_000, "Montant trop élevé"),

  // Optionnel — chaîne vide → undefined
  entry_subtype: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(SAISIE_SUBTYPES).optional(),
  ),
})

export type SaisieInput = z.infer<typeof saisieSchema>
