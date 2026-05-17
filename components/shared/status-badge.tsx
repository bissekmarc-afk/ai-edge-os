import { CheckCircle, Clock, Loader, AlertCircle, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SyncStatus } from "@/types"

interface StatusBadgeProps {
  status: SyncStatus
  showLabel?: boolean
  className?: string
}

const STATUS_CONFIG: Record<
  SyncStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  success: {
    label: "Synchronisé",
    icon: <CheckCircle className="size-3" />,
    className: "text-[var(--success)] bg-[var(--success)]/10",
  },
  error: {
    label: "Erreur",
    icon: <AlertCircle className="size-3" />,
    className: "text-[var(--danger)] bg-[var(--danger)]/10",
  },
  syncing: {
    label: "Sync…",
    icon: <Loader className="size-3 animate-spin" />,
    className: "text-[var(--syncing)] bg-[var(--syncing)]/10",
  },
  pending: {
    label: "En attente",
    icon: <Clock className="size-3" />,
    className: "text-[var(--warning)] bg-[var(--warning)]/10",
  },
  idle: {
    label: "Inactif",
    icon: <Minus className="size-3" />,
    className: "text-muted-foreground bg-muted",
  },
}

export function StatusBadge({
  status,
  showLabel = true,
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.icon}
      {showLabel && config.label}
    </span>
  )
}
