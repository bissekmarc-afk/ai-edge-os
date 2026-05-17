"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { AICommandBar } from "@/components/layout/ai-command-bar"

const AUTH_PATHS = ["/login", "/auth/"]

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const isAuthRoute = AUTH_PATHS.some((p) => pathname.startsWith(p))

  if (isAuthRoute) {
    return <>{children}</>
  }

  const sidebarWidth = collapsed ? 56 : 220

  return (
    <div className="flex min-h-screen bg-[var(--main-background)]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main
        className="flex min-h-screen flex-1 flex-col overflow-x-hidden transition-[margin] duration-200"
        style={{ marginLeft: sidebarWidth, paddingBottom: 120 }}
      >
        <div className="flex-1 p-6">{children}</div>
      </main>
      <AICommandBar marginLeft={sidebarWidth} />
    </div>
  )
}
