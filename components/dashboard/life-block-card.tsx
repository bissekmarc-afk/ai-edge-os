import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface LifeBlockCardProps {
  title: string
  icon: React.ReactNode
  stats: Array<{ label: string; value: string }>
  progress?: number
  progressLabel?: string
  className?: string
}

export function LifeBlockCard({
  title,
  icon,
  stats,
  progress,
  progressLabel,
  className,
}: LifeBlockCardProps) {
  return (
    <Card className={cn("bg-[var(--panel-background)]", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-sm font-semibold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>
        {progress !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{progressLabel ?? "Progression"}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
