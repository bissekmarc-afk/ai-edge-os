import { formatEur } from "@/lib/queries/finance-dashboard"
import type { WealthAsset } from "@/lib/queries/finance-dashboard"

const ASSET_CLASS_META: Record<string, { label: string; color: string }> = {
  real_estate:  { label: "Immobilier",   color: "bg-blue-500"    },
  equities:     { label: "Actions",      color: "bg-green-500"   },
  savings:      { label: "Épargne",      color: "bg-emerald-500" },
  alternatives: { label: "Alternatifs",  color: "bg-purple-500"  },
  other:        { label: "Autre",        color: "bg-muted-foreground/60" },
}

function assetMeta(assetClass: string) {
  return ASSET_CLASS_META[assetClass] ?? ASSET_CLASS_META.other
}

interface WealthSectionProps {
  assets: WealthAsset[]
}

export function WealthSection({ assets }: WealthSectionProps) {
  if (assets.length === 0) return null

  const total = assets.reduce((s, a) => s + Number(a.amount), 0)
  const snapshotDate = assets[0]?.snapshot_date
    ? new Date(assets[0].snapshot_date + "T00:00:00Z").toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : ""

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Patrimoine</h3>
          {snapshotDate && (
            <p className="text-xs text-muted-foreground">
              Snapshot au {snapshotDate}
            </p>
          )}
        </div>
        <p className="text-xl font-bold tabular-nums text-foreground">
          {formatEur(total)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {assets.map((asset) => {
          const meta = assetMeta(asset.asset_class)
          const pct = total > 0 ? (Number(asset.amount) / total) * 100 : 0

          return (
            <div
              key={asset.asset_name}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`size-2 shrink-0 rounded-full ${meta.color}`}
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {meta.label}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{asset.asset_name}</p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {formatEur(Number(asset.amount))}
                </p>
              </div>
              {/* Allocation bar */}
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${meta.color}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <p className="text-right text-xs text-muted-foreground">
                {pct.toFixed(1)} % du total
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
