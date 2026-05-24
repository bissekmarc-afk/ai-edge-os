"use client"

import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface TabCounts {
  today: number
  week: number
  all: number
  inbox: number
}

interface TaskViewTabsProps {
  currentView: string
  counts: TabCounts
}

const TABS = [
  { id: "today", label: "Aujourd'hui",    countKey: "today" as const },
  { id: "week",  label: "Cette semaine",  countKey: "week"  as const },
  { id: "all",   label: "Toutes",         countKey: "all"   as const },
  { id: "inbox", label: "Inbox",          countKey: "inbox" as const },
]

export function TaskViewTabs({ currentView, counts }: TaskViewTabsProps) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5 w-fit">
      {TABS.map((tab) => {
        const isActive = currentView === tab.id
        const count = counts[tab.countKey]
        return (
          <button
            key={tab.id}
            onClick={() => router.push(`${pathname}?view=${tab.id}`)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {count > 0 && (
              <span
                className={cn(
                  "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium",
                  isActive
                    ? "bg-[var(--ai-accent)] text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
