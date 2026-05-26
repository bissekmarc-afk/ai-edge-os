import { getManualEntries } from "@/lib/finance/manual-entry-queries"
import { CATEGORY_DISPLAY, type SaisieCategory } from "@/lib/finance/saisie-schema"
import { EditManualEntryDialog } from "@/components/finance/edit-manual-entry-dialog"
import { cn } from "@/lib/utils"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
  })
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style:          "currency",
    currency:       "EUR",
    signDisplay:    "always",
    maximumFractionDigits: 0,
  }).format(amount)
}

function categoryLabel(raw: string) {
  return CATEGORY_DISPLAY[raw as SaisieCategory] ?? raw
}

function SyncBadge({ status }: { status: string | null }) {
  if (status === "synced") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
        ✓ Sheets
      </span>
    )
  }
  if (status === "sheet_failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
        ⚠ Sheets KO
      </span>
    )
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        ⋯ En attente
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      —
    </span>
  )
}

// ─── Server Component ─────────────────────────────────────────────────────────

export async function ManualEntriesTable() {
  const entries = await getManualEntries()

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 px-6 py-8 text-center text-sm text-muted-foreground">
        Aucune saisie manuelle pour le moment.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Desktop table — hidden on small screens */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Libellé</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Catégorie</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Montant</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                  {formatDate(entry.date)}
                </td>
                <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">
                  {entry.label}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {categoryLabel(entry.category)}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap",
                    entry.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
                  )}
                >
                  {formatAmount(entry.amount)}
                </td>
                <td className="px-4 py-3">
                  <SyncBadge status={entry.sync_status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <EditManualEntryDialog entry={entry} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — shown only on small screens */}
      <ul className="sm:hidden divide-y divide-border">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-2 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{entry.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(entry.date)} · {categoryLabel(entry.category)}
                </p>
              </div>
              <span
                className={cn(
                  "tabular-nums font-semibold text-sm whitespace-nowrap",
                  entry.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
                )}
              >
                {formatAmount(entry.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <SyncBadge status={entry.sync_status} />
              <EditManualEntryDialog entry={entry} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
