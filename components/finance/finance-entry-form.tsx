"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { createFinanceEntry, type ActionResult } from "@/app/actions/create-finance-entry"
import { SAISIE_CATEGORIES, SAISIE_SUBTYPES, CATEGORY_DISPLAY } from "@/lib/finance/saisie-schema"
import type { BudgetLabel } from "@/lib/finance/queries"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { cn }     from "@/lib/utils"

// ─── Submit button ────────────────────────────────────────────────────────────

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-12 w-full text-base font-semibold"
    >
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
    <p className="mt-1.5 text-xs text-destructive" role="alert">
      {msgs[0]}
    </p>
  )
}

// ─── Shared select className ──────────────────────────────────────────────────
// h-12 for touch targets, text-base for readability on mobile

const selectCn =
  "h-12 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30"

// ─── Shared label className ───────────────────────────────────────────────────

const labelCn = "mb-2 block text-sm font-medium text-foreground"

// ─── Form ─────────────────────────────────────────────────────────────────────

interface FinanceEntryFormProps {
  budgetLabels?: BudgetLabel[]
}

export function FinanceEntryForm({ budgetLabels = [] }: FinanceEntryFormProps) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createFinanceEntry,
    null,
  )
  const formRef    = useRef<HTMLFormElement>(null)
  const labelBoxRef = useRef<HTMLDivElement>(null)

  // ── Combobox state ─────────────────────────────────────────────────────────
  const [labelValue, setLabelValue]   = useState("")
  const [labelOpen,  setLabelOpen]    = useState(false)

  // Filtered suggestions: all when empty, substring-filtered when typing
  const suggestions = budgetLabels.filter(b =>
    !labelValue || b.label.toLowerCase().includes(labelValue.toLowerCase()),
  ).slice(0, 10)

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (labelBoxRef.current && !labelBoxRef.current.contains(e.target as Node)) {
        setLabelOpen(false)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [])

  // Reset form and combobox value on successful submit
  useEffect(() => {
    if (state?.status === "success") {
      formRef.current?.reset()
      setLabelValue("")
      setLabelOpen(false)
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
            "rounded-lg border px-4 py-3 text-sm leading-relaxed",
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
        <label htmlFor="saisie-date" className={labelCn}>
          Date
        </label>
        <Input
          id="saisie-date"
          name="date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="h-12 text-base"
          aria-invalid={!!fieldErrors?.date}
          required
        />
        <FieldError errors={fieldErrors} name="date" />
      </div>

      {/* ── Libellé — combobox avec suggestions budget DAF ───────────── */}
      <div>
        <label htmlFor="saisie-label" className={labelCn}>
          Libellé
          {budgetLabels.length > 0 && (
            <span className="ml-2 font-normal text-muted-foreground">
              ({budgetLabels.length} labels budget disponibles)
            </span>
          )}
        </label>

        <div ref={labelBoxRef} className="relative">
          <Input
            id="saisie-label"
            name="label"
            type="text"
            value={labelValue}
            onChange={e => {
              setLabelValue(e.target.value)
              setLabelOpen(true)
            }}
            onFocus={() => setLabelOpen(true)}
            placeholder="Chercher ou saisir un libellé…"
            className="h-12 text-base"
            aria-invalid={!!fieldErrors?.label}
            aria-autocomplete="list"
            aria-expanded={labelOpen && suggestions.length > 0}
            autoComplete="off"
            required
          />

          {/* Dropdown suggestions */}
          {labelOpen && suggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
            >
              {suggestions.map((b, i) => (
                <li key={i} role="option">
                  <button
                    type="button"
                    onMouseDown={e => {
                      // preventDefault keeps the input focused while clicking
                      e.preventDefault()
                      setLabelValue(b.label)
                      setLabelOpen(false)
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <span className="font-medium text-foreground">{b.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{b.category}</span>
                  </button>
                </li>
              ))}

              {/* Custom value hint — shown only when typed value ≠ any suggestion */}
              {labelValue.trim() !== "" &&
               !suggestions.some(b => b.label.toLowerCase() === labelValue.toLowerCase()) && (
                <li className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  ↵ Valeur personnalisée :{" "}
                  <span className="font-medium text-foreground">{labelValue}</span>
                </li>
              )}
            </ul>
          )}
        </div>

        <FieldError errors={fieldErrors} name="label" />
      </div>

      {/* ── Flux (Cash In / Cash Out) ──────────────────────────────────── */}
      <fieldset>
        <legend className={labelCn}>Flux</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["Cash In", "Cash Out"] as const).map((flux) => (
            <label
              key={flux}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-4 text-base font-medium transition-colors",
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
              {flux === "Cash In" ? "💰 Cash In" : "💸 Cash Out"}
            </label>
          ))}
        </div>
        <FieldError errors={fieldErrors} name="flux_nature" />
      </fieldset>

      {/* ── Montant ───────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="saisie-amount" className={labelCn}>
          Montant{" "}
          <span className="font-normal text-muted-foreground">(€, toujours positif)</span>
        </label>
        <Input
          id="saisie-amount"
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          className="h-12 text-base"
          aria-invalid={!!fieldErrors?.amount}
          required
        />
        <FieldError errors={fieldErrors} name="amount" />
      </div>

      {/* ── Catégorie ─────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="saisie-category" className={labelCn}>
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
              {CATEGORY_DISPLAY[c]}
            </option>
          ))}
        </select>
        <FieldError errors={fieldErrors} name="category" />
      </div>

      {/* ── Sous-type (optionnel) ──────────────────────────────────────── */}
      <div>
        <label htmlFor="saisie-subtype" className={labelCn}>
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
      <div className="pt-1">
        <SubmitButton />
      </div>
    </form>
  )
}
