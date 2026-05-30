"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog"
import { updateManualFinanceEntry, type UpdateResult } from "@/app/actions/update-manual-finance-entry"
import { deleteManualFinanceEntry }                    from "@/app/actions/delete-manual-finance-entry"
import { SAISIE_CATEGORIES, SAISIE_SUBTYPES, CATEGORY_DISPLAY } from "@/lib/finance/saisie-schema"
import type { ManualEntry } from "@/lib/finance/manual-entry-queries"
import { Button }         from "@/components/ui/button"
import { Input }          from "@/components/ui/input"
import { buttonVariants } from "@/components/ui/button"
import { cn }             from "@/lib/utils"
import { Pencil, Trash2, AlertTriangle } from "lucide-react"

// ─── Shared select className (h-12 for mobile) ───────────────────────────────

const selectCn =
  "h-12 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30"

// ─── Field error ──────────────────────────────────────────────────────────────

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

// ─── Save button ──────────────────────────────────────────────────────────────

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="h-11 flex-1">
      {pending ? "Enregistrement…" : "Enregistrer"}
    </Button>
  )
}

// ─── Edit form (isolated so useActionState resets via key) ────────────────────

function EditForm({
  entry,
  onSuccess,
}: {
  entry: ManualEntry
  onSuccess: () => void
}) {
  const [state, formAction] = useActionState<UpdateResult | null, FormData>(
    updateManualFinanceEntry,
    null,
  )

  useEffect(() => {
    if (state?.status === "success") onSuccess()
  }, [state, onSuccess])

  const fieldErrors = state?.status === "error" ? state.errors : undefined

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {/* Hidden row id */}
      <input type="hidden" name="id" value={entry.id} />

      {state?.status === "fatal" && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.message}
        </div>
      )}

      {/* Date */}
      <div>
        <label htmlFor="edit-date" className="mb-1.5 block text-sm font-medium text-foreground">
          Date
        </label>
        <Input
          id="edit-date"
          name="date"
          type="date"
          defaultValue={entry.date}
          className="h-12 text-base"
          aria-invalid={!!fieldErrors?.date}
          required
        />
        <FieldError errors={fieldErrors} name="date" />
      </div>

      {/* Libellé */}
      <div>
        <label htmlFor="edit-label" className="mb-1.5 block text-sm font-medium text-foreground">
          Libellé
        </label>
        <Input
          id="edit-label"
          name="label"
          type="text"
          defaultValue={entry.label}
          className="h-12 text-base"
          aria-invalid={!!fieldErrors?.label}
          required
        />
        <FieldError errors={fieldErrors} name="label" />
      </div>

      {/* Flux */}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-foreground">Flux</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["Cash In", "Cash Out"] as const).map((flux) => (
            <label
              key={flux}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-3.5 text-base font-medium transition-colors",
                "border-input bg-background hover:bg-muted",
                "has-[:checked]:border-[var(--ai-accent)] has-[:checked]:bg-[var(--ai-accent-soft)] has-[:checked]:text-[var(--ai-accent)]",
              )}
            >
              <input
                type="radio"
                name="flux_nature"
                value={flux}
                defaultChecked={entry.flux_nature === flux}
                className="sr-only"
              />
              {flux === "Cash In" ? "💰 Cash In" : "💸 Cash Out"}
            </label>
          ))}
        </div>
        <FieldError errors={fieldErrors} name="flux_nature" />
      </fieldset>

      {/* Montant */}
      <div>
        <label htmlFor="edit-amount" className="mb-1.5 block text-sm font-medium text-foreground">
          Montant <span className="font-normal text-muted-foreground">(€, toujours positif)</span>
        </label>
        <Input
          id="edit-amount"
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={Math.abs(entry.amount)}
          className="h-12 text-base"
          aria-invalid={!!fieldErrors?.amount}
          required
        />
        <FieldError errors={fieldErrors} name="amount" />
      </div>

      {/* Catégorie */}
      <div>
        <label htmlFor="edit-category" className="mb-1.5 block text-sm font-medium text-foreground">
          Catégorie
        </label>
        <select
          id="edit-category"
          name="category"
          className={selectCn}
          defaultValue={entry.category}
          aria-invalid={!!fieldErrors?.category}
          required
        >
          {SAISIE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_DISPLAY[c]}
            </option>
          ))}
        </select>
        <FieldError errors={fieldErrors} name="category" />
      </div>

      {/* Sous-type */}
      <div>
        <label htmlFor="edit-subtype" className="mb-1.5 block text-sm font-medium text-foreground">
          Sous-type{" "}
          <span className="font-normal text-muted-foreground">(optionnel)</span>
        </label>
        <select
          id="edit-subtype"
          name="entry_subtype"
          className={selectCn}
          defaultValue={entry.entry_subtype ?? ""}
        >
          <option value="">—</option>
          {SAISIE_SUBTYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <DialogClose
          className={cn(buttonVariants({ variant: "outline" }), "h-11 flex-1")}
        >
          Annuler
        </DialogClose>
        <SaveButton />
      </div>
    </form>
  )
}

// ─── Delete section ───────────────────────────────────────────────────────────

function DeleteSection({
  entryId,
  onDeleted,
}: {
  entryId: string
  onDeleted: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const result = await deleteManualFinanceEntry(entryId)
      if (result.status === "success") {
        onDeleted()
      } else {
        setError(result.message)
        setConfirming(false)
      }
    })
  }

  if (!confirming) {
    return (
      <div className="mt-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex items-center gap-2 text-sm text-destructive/70 transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
          Supprimer cette entrée
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 pt-4">
      <div className="mb-3 flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p className="text-sm text-destructive">
          Cette suppression est logique et définitive. L'entrée ne sera plus visible.
        </p>
      </div>
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={handleDelete}
          className="flex-1"
        >
          {isPending ? "Suppression…" : "Confirmer la suppression"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => setConfirming(false)}
        >
          Annuler
        </Button>
      </div>
    </div>
  )
}

// ─── Main dialog component ────────────────────────────────────────────────────

export function EditManualEntryDialog({ entry }: { entry: ManualEntry }) {
  const [open, setOpen] = useState(false)
  // Incrementing key resets EditForm (and its useActionState) on each open
  const [formKey, setFormKey] = useState(0)

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen) setFormKey((k) => k + 1)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "gap-1.5")}
      >
        <Pencil className="size-3" />
        Modifier
      </DialogTrigger>

      <DialogContent>
        <DialogHeader className="mb-4">
          <DialogTitle>Modifier l'entrée</DialogTitle>
          <DialogDescription>
            Supabase uniquement · Google Sheets non mis à jour
          </DialogDescription>
        </DialogHeader>

        {/* Form — keyed so useActionState resets on each open */}
        <EditForm
          key={formKey}
          entry={entry}
          onSuccess={() => setOpen(false)}
        />

        {/* Delete zone */}
        <DeleteSection
          entryId={entry.id}
          onDeleted={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
