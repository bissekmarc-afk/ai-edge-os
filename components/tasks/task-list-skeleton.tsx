import { Skeleton } from "@/components/ui/skeleton"

interface TaskListSkeletonProps {
  count?: number
}

export function TaskListSkeleton({ count = 6 }: TaskListSkeletonProps) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
        >
          <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
