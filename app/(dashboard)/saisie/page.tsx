import { SectionHeading }    from "@/components/shared/section-heading"
import { FinanceEntryForm } from "@/components/finance/finance-entry-form"

export const metadata = {
  title: "Saisie manuelle — AI Edge OS",
}

export default function SaisiePage() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Saisie manuelle"
        description="Ajouter une entrée budgétaire · enregistrée dans Supabase et Google Sheets"
      />

      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-xl border border-border bg-card p-6">
          <FinanceEntryForm />
        </div>
      </div>
    </div>
  )
}
