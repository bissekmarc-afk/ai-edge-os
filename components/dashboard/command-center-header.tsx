import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { SyncButton } from "@/components/dashboard/sync-button"
import { getSupabaseUser } from "@/lib/supabase/server"

export async function CommandCenterHeader() {
  const user = await getSupabaseUser()
  const displayName = user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "vous"

  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date())

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-3.5" />
          <span className="capitalize">{today}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Bonjour, {displayName} 👋
        </h1>
        <div className="flex items-center gap-2">
          <StatusBadge status="success" />
          <span className="text-xs text-muted-foreground">Système opérationnel</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SyncButton />
        <Button size="sm">Revue hebdo</Button>
      </div>
    </div>
  )
}
