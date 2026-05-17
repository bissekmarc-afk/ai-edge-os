import { DollarSign } from "lucide-react"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export default function FinancePage() {
  return (
    <PagePlaceholder
      title="Finance"
      description="Suivi des revenus, dépenses et épargne depuis Google Sheets. Analyses mensuelles et tendances budgétaires."
      icon={<DollarSign className="size-7" />}
    />
  )
}
