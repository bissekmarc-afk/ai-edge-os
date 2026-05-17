"use client"

import Link from "next/link"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface SidebarNavItemProps {
  href: string
  label: string
  icon: React.ReactNode
  collapsed: boolean
  isActive: boolean
}

export function SidebarNavItem({
  href,
  label,
  icon,
  collapsed,
  isActive,
}: SidebarNavItemProps) {
  const linkClass = cn(
    "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground/80",
    collapsed && "justify-center"
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="block w-full" />}>
          <Link href={href} aria-label={label} className={linkClass}>
            <span className="shrink-0">{icon}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Link href={href} className={linkClass}>
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  )
}
