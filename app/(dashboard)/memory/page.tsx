import { Brain } from "lucide-react"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export default function MemoryPage() {
  return (
    <PagePlaceholder
      title="Mémoire"
      description="Base de connaissances personnelle stockée dans Supabase. Catégories, niveaux de sensibilité et validation par l'utilisateur."
      icon={<Brain className="size-7" />}
    />
  )
}
