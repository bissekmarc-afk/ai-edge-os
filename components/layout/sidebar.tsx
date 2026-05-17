"use client"

import { usePathname } from "next/navigation"
import { useTransition } from "react"
import {
  LayoutDashboard,
  CheckSquare,
  Brain,
  DollarSign,
  LayoutGrid,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Loader,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SidebarNavItem } from "@/components/layout/sidebar-nav-item"
import { signOut } from "@/app/login/actions"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const NAV_ITEMS = [
  { href: "/", label: "Command Center", icon: <LayoutDashboard className="size-4" /> },
  { href: "/tasks", label: "Tâches", icon: <CheckSquare className="size-4" /> },
  { href: "/memory", label: "Mémoire", icon: <Brain className="size-4" /> },
  { href: "/finance", label: "Finance", icon: <DollarSign className="size-4" /> },
  { href: "/life", label: "Life Blocks", icon: <LayoutGrid className="size-4" /> },
  { href: "/settings", label: "Réglages", icon: <Settings className="size-4" /> },
] as const

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-14" : "w-[220px]"
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-sidebar-border px-3",
          collapsed ? "justify-center" : "gap-2"
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--ai-accent)] text-xs font-bold text-white">
          AI
        </span>
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-sidebar-foreground">
            Edge OS
          </span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            collapsed={collapsed}
            isActive={
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
            }
          />
        ))}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-sidebar-border p-2">
        <button
          onClick={() => startTransition(() => signOut())}
          disabled={isPending}
          aria-label="Déconnexion"
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-50",
            collapsed && "justify-center"
          )}
        >
          {isPending ? (
            <Loader className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4 shrink-0" />
          )}
          {!collapsed && <span className="truncate">Déconnexion</span>}
        </button>

        <button
          onClick={onToggle}
          aria-label={collapsed ? "Étendre la sidebar" : "Réduire la sidebar"}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "justify-center"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <>
              <PanelLeftClose className="size-4 shrink-0" />
              <span className="truncate">Réduire</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
