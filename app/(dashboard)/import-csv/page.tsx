import { SectionHeading }   from "@/components/shared/section-heading"
import { CsvImportClient } from "@/components/finance/csv-import-client"

export const metadata = {
  title: "Import CSV — AI Edge OS",
}

export default function ImportCsvPage() {
  return (
    <div className="flex flex-col gap-8">
      <SectionHeading
        title="Import CSV Caisse d'Épargne"
        description="Analyse et prévisualisation du fichier CSV avant import dans finance_entries"
      />

      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <CsvImportClient />
        </div>
      </div>
    </div>
  )
}
