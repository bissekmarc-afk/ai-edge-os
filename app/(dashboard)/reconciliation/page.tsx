import { SectionHeading }          from "@/components/shared/section-heading"
import { ReconciliationClient }    from "@/components/reconciliation/reconciliation-client"

export const metadata = {
  title: "Réconciliation CSV — AI Edge OS",
}

export default function ReconciliationPage() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Réconciliation bancaire"
        description="Importez vos relevés Société Générale (Carte ou Compte courant) et rapprochez-les de vos entrées finance."
      />
      <ReconciliationClient />
    </div>
  )
}
