import { Settings } from "lucide-react"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export default function SettingsPage() {
  return (
    <PagePlaceholder
      title="Réglages"
      description="Configuration des intégrations API, préférences utilisateur, gestion des tokens et paramètres de synchronisation."
      icon={<Settings className="size-7" />}
    />
  )
}
