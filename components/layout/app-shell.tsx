"use client"

import { useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { AICommandBar } from "@/components/layout/ai-command-bar"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
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
