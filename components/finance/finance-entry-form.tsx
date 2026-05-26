"use client"

import { useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { createFinanceEntry, type ActionResult } from "@/app/actions/create-finance-entry"
import { SAISIE_CATEGORIES, SAISIE_SUBTYPES } from "@/lib/finance/saisie-schema"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { cn }     from "@/lib/utils"

// ─── Submit button (reads pending state from form context) ────────────────────

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Enregistrement…" : "Enregistrer l'entrée"}
    </Button>
  )
}

// ─── Inline field error ───────────────────────────────────────────────────────

function FieldError({
  errors,
  name,
}: {
  errors: Partial<Record<string, string[]>> | undefined
  name: string
}) {
  const msgs = errors?.[name]
  if (!msgs?.length) return null
  return (
    <p className="mt-1 text-xs text-destructive" role="alert">
      {msgs[0]}
    </p>
  )
}

// ─── Select styling (consistent with Input) ───────────────────────────────────

const selectCn =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30"

// ─── Form ─────────────────────────────────────────────────────────────────────

export function FinanceEntryForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createFinanceEntry,
    null,
  )
  const formRef = useRef<HTMLFormElement>(null)

  // Reset form on success
  useEffect(() => {
    if (state?.status === "success") {
      formRef.current?.reset()
    }
  }, [state])

  const fieldErrors = state?.status === "error" ? state.errors : undefined

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5" noValidate>

      {/* ── Feedback banners ──────────────────────────────────────────── */}
      {state?.status === "success" && (
        <div
          role="status"
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            state.syncStatus === "synced"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800/50 dark:bg-green-950/40 dark:text-green-300"
              : "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800/50 dark:bg-yellow-950/40 dark:text-yellow-300",
          )}
        >
          {state.syncStatus === "synced" ? "✓ " : "⚠ "}
          {state.message}
        </div>
      )}

      {state?.status === "fatal" && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.message}
        </div>
      )}

      {/* ── Date ──────────────────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="saisie-date"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Date
        </label>
        <Input
          id="saisie-date"
          name="date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          aria-invalid={!!fieldErrors?.date}
          required
        />
        <FieldError errors={fieldErrors} name="date" />
      </div>

      {/* ── Libellé ───────────────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="saisie-label"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Libellé
        </label>
        <Input
          id="saisie-label"
          name="label"
          type="text"
          placeholder="Ex : Loyer mai 2026"
          aria-invalid={!!fieldErrors?.label}
          required
        />
        <FieldError errors={fieldErrors} name="label" />
      </div>

      {/* ── Flux (Cash In / Cash Out) ──────────────────────────────────── */}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-foreground">Flux</legend>
        <div className="flex gap-3">
          {(["Cash In", "Cash Out"] as const).map((flux) => (
            <label
              key={flux}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                "border-input bg-background hover:bg-muted",
                "has-[:checked]:border-[var(--ai-accent)] has-[:checked]:bg-[var(--ai-accent-soft)] has-[:checked]:text-[var(--ai-accent)]",
              )}
            >
              <input
                type="radio"
                name="flux_nature"
                value={flux}
                defaultChecked={flux === "Cash Out"}
                className="sr-only"
              />
              <span>{flux === "Cash In" ? "💰 Cash In" : "💸 Cash Out"}</span>
            </label>
          ))}
        </div>
        <FieldError errors={fieldErrors} name="flux_nature" />
      </fieldset>

      {/* ── Montant ───────────────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="saisie-amount"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Montant <span className="text-muted-foreground">(€, toujours positif)</span>
        </label>
        <Input
          id="saisie-amount"
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          aria-invalid={!!fieldErrors?.amount}
          required
        />
        <FieldError errors={fieldErrors} name="amount" />
      </div>

      {/* ── Catégorie ─────────────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="saisie-category"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Catégorie
        </label>
        <select
          id="saisie-category"
          name="category"
          className={selectCn}
          aria-invalid={!!fieldErrors?.category}
          defaultValue=""
          required
        >
          <option value="" disabled>
            — Choisir une catégorie —
          </option>
          {SAISIE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <FieldError errors={fieldErrors} name="category" />
      </div>

      {/* ── Sous-type (optionnel) ──────────────────────────────────────── */}
      <div>
        <label
          htmlFor="saisie-subtype"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Sous-type{" "}
          <span className="font-normal text-muted-foreground">(optionnel)</span>
        </label>
        <select
          id="saisie-subtype"
          name="entry_subtype"
          className={selectCn}
          defaultValue=""
        >
          <option value="">—</option>
          {SAISIE_SUBTYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* ── Submit ────────────────────────────────────────────────────── */}
      <SubmitButton />
    </form>
  )
}
