import { CalendarDays, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { mockUserProfile } from "@/lib/mock-data"

export function CommandCenterHeader() {
  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date("2026-05-17"))

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-3.5" />
          <span className="capitalize">{today}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Bonjour, {mockUserProfile.displayName} 👋
        </h1>
        <div className="flex items-center gap-2">
          <StatusBadge status="success" />
          <span className="text-xs text-muted-foreground">
            Dernière sync il y a 12 min
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5">
          <RefreshCw className="size-3.5" />
          Synchroniser
        </Button>
        <Button size="sm">Revue hebdo</Button>
      </div>
    </div>
  )
}
