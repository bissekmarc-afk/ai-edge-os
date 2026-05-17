import { CheckSquare } from "lucide-react"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export default function TasksPage() {
  return (
    <PagePlaceholder
      title="Tâches"
      description="Vue complète des tâches Todoist synchronisées, filtrables par projet et priorité."
      icon={<CheckSquare className="size-7" />}
    />
  )
}
