import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import { SectionHeading } from "@/components/shared/section-heading"
import type { SyncStatus } from "@/types"

interface SyncActivity {
  source: string
  status: SyncStatus
  lastSyncedAt: string
  label: string
}

interface SyncActivityFeedProps {
  activities: SyncActivity[]
}

export function SyncActivityFeed({ activities }: SyncActivityFeedProps) {
  return (
    <div className="space-y-3">
      <SectionHeading
        title="Activité de sync"
        description="État des connexions aux sources de données"
      />
      <Card className="bg-[var(--panel-background)]">
        <CardContent className="divide-y divide-border pt-2">
          {activities.map((activity) => {
            const date = new Date(activity.lastSyncedAt)
            const formattedTime = new Intl.DateTimeFormat("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(date)
            const formattedDate = new Intl.DateTimeFormat("fr-FR", {
              day: "numeric",
              month: "short",
            }).format(date)

            return (
              <div
                key={activity.source}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {activity.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Dernière sync : {formattedDate} à {formattedTime}
                  </span>
                </div>
                <StatusBadge status={activity.status} />
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
