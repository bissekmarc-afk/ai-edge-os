import { Suspense }           from "react"
import { SectionHeading }     from "@/components/shared/section-heading"
import { FinanceEntryForm }   from "@/components/finance/finance-entry-form"
import { ManualEntriesTable } from "@/components/finance/manual-entries-table"
import { Skeleton }           from "@/components/ui/skeleton"
import { getBudgetLabels }    from "@/lib/finance/queries"

export const metadata = {
  title: "Saisie manuelle — AI Edge OS",
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-lg" />
      ))}
    </div>
  )
}

export default async function SaisiePage() {
  // Fetch budget labels server-side — passed as props so the Client Component
  // never needs its own network call.
  const budgetLabels = await getBudgetLabels()

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading
        title="Saisie manuelle"
        description="Ajouter une entrée budgétaire · enregistrée dans Supabase et Google Sheets"
      />

      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <FinanceEntryForm budgetLabels={budgetLabels} />
        </div>
      </div>

      {/* ── Dernières saisies ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Dernières saisies manuelles
        </h3>
        <Suspense fallback={<TableSkeleton />}>
          <ManualEntriesTable />
        </Suspense>
      </div>
    </div>
  )
}
