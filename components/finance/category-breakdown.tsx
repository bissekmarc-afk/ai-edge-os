import { cn } from "@/lib/utils"
import { formatEur } from "@/lib/queries/finance-dashboard"
import type { CategoryBreakdownItem } from "@/lib/queries/finance-dashboard"

const CATEGORY_COLORS: Record<string, string> = {
  Logement:      "bg-blue-500",
  Alimentation:  "bg-green-500",
  Transport:     "bg-yellow-500",
  Loisirs:       "bg-purple-500",
  Santé:         "bg-pink-500",
  Épargne:       "bg-emerald-500",
  Taxes:         "bg-red-500",
}

function categoryColor(name: string): string {
  return CATEGORY_COLORS[name] ?? "bg-muted-foreground/60"
}

interface CategoryBreakdownProps {
  data: CategoryBreakdownItem[]
}

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Aucune donnée de dépense
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((item) => (
        <div key={item.category} className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={cn("size-2 shrink-0 rounded-full", categoryColor(item.category))}
              />
              <span className="text-sm text-foreground">{item.category}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-medium tabular-nums text-foreground">
                {formatEur(item.amount)}
              </span>
              <span className="text-xs text-muted-foreground">
                {item.percentage.toFixed(1)} %
              </span>
            </div>
          </div>
          {/* CSS progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", categoryColor(item.category))}
              style={{ width: `${Math.min(100, item.percentage)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
