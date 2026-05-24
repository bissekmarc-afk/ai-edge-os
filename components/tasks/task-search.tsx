"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface TaskSearchProps {
  initialValue?: string
}

export function TaskSearch({ initialValue = "" }: TaskSearchProps) {
  const [value, setValue] = useState(initialValue)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Sync when the URL changes externally (e.g. tab switch clears query)
  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const pushSearch = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (q) {
        params.set("q", q)
      } else {
        params.delete("q")
      }
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setValue(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => pushSearch(v), 400)
  }

  function handleClear() {
    setValue("")
    clearTimeout(debounceRef.current)
    pushSearch("")
  }

  return (
    <div className="relative flex-1 min-w-0 max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder="Rechercher une tâche…"
        className={cn(
          "h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-8 text-sm outline-none",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "transition-colors dark:bg-input/30"
        )}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Effacer la recherche"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
