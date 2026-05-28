"use client"

// ─── ScenarioToggle ───────────────────────────────────────────────────────────
//
// Client Component — updates ?scenario= in the URL without a full page reload.
// The tabs are URL-driven so the active tab survives a hard refresh.

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScenarioValue = "actual" | "budget_initial" | "reforecast_6m" | "variance"

interface Tab {
  value: ScenarioValue
  label: string
}

const TABS: Tab[] = [
  { value: "actual",         label: "Actual" },
  { value: "budget_initial", label: "Budget Initial" },
  { value: "reforecast_6m",  label: "Reforecast 6M" },
  { value: "variance",       label: "Variance" },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function ScenarioToggle({ active }: { active: ScenarioValue }) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  const navigate = useCallback(
    (value: ScenarioValue) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("scenario", value)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  return (
    <div
      role="tablist"
      aria-label="Scénario financier"
      className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
    >
      {TABS.map((tab) => {
        const isActive = tab.value === active
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => navigate(tab.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
