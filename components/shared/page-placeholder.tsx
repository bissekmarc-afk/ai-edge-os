import { Construction } from "lucide-react"
import { SectionHeading } from "@/components/shared/section-heading"

interface PagePlaceholderProps {
  title: string
  description: string
  icon?: React.ReactNode
}

export function PagePlaceholder({ title, description, icon }: PagePlaceholderProps) {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={title} description={description} />
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon ?? <Construction className="size-7" />}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Module en construction</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Cette section sera connectée aux vraies API lors de la phase suivante.
          </p>
        </div>
      </div>
    </div>
  )
}
