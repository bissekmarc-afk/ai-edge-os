"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface TaskPaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
}

export function TaskPagination({
  currentPage,
  totalPages,
  totalItems,
}: TaskPaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  function goTo(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(page))
    router.push(`${pathname}?${params.toString()}`)
  }

  const btnCls = cn(
    "flex size-8 items-center justify-center rounded-lg border border-border text-sm",
    "transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
  )

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-muted-foreground">
        {totalItems} tâche{totalItems > 1 ? "s" : ""} au total
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Page précédente"
          className={btnCls}
        >
          <ChevronLeft className="size-4" />
        </button>

        <span className="min-w-[5rem] text-center text-sm text-muted-foreground">
          {currentPage} / {totalPages}
        </span>

        <button
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Page suivante"
          className={btnCls}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
