import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface KpiCardProps {
  title: string
  value: string
  sub: string
  icon: React.ReactNode
  trend?: "up" | "down" | "neutral"
  accentColor?: string
}

export function KpiCard({
  title,
  value,
  sub,
  icon,
  trend = "neutral",
  accentColor,
}: KpiCardProps) {
  return (
    <Card className="bg-[var(--panel-background)]">
      <CardContent className="flex items-start justify-between gap-3 pt-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums",
              accentColor ? "" : "text-foreground"
            )}
            style={accentColor ? { color: accentColor } : undefined}
          >
            {value}
          </p>
          <p
            className={cn(
              "text-xs",
              trend === "up" && "text-[var(--success)]",
              trend === "down" && "text-[var(--danger)]",
              trend === "neutral" && "text-muted-foreground"
            )}
          >
            {sub}
          </p>
        </div>
        <div className="shrink-0 rounded-lg bg-muted p-2 text-muted-foreground">
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}
