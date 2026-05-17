import { LayoutGrid } from "lucide-react"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export default function LifePage() {
  return (
    <PagePlaceholder
      title="Life Blocks"
      description="Lecture, gym, boxe, habitudes récurrentes et revue hebdomadaire. Vue agrégée de tous les blocs de vie."
      icon={<LayoutGrid className="size-7" />}
    />
  )
}
