"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Label,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatAmount } from "@/lib/finance/trajectory-utils"
import type { TrajectoryContext } from "@/lib/finance/trajectory-utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = Pick<
  TrajectoryContext,
  | "netWorth"
  | "savingsCurrent"
  | "nextMilestone"
  | "allMilestones"
  | "coverageRatio"
  | "status"
  | "gap"
  | "monthsRemaining"
  | "requiredMonthlySavings"
>

// ─── Badge statut ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  green:  { emoji: "🟢", label: "ON TRACK",   cls: "bg-[var(--success)]/10 text-[var(--success)]"  },
  orange: { emoji: "🟠", label: "VIGILANCE",  cls: "bg-[var(--warning)]/10 text-[var(--warning)]" },
  red:    { emoji: "🔴", label: "CRITIQUE",   cls: "bg-[var(--danger)]/10  text-[var(--danger)]"  },
} as const

// ─── Chart data ───────────────────────────────────────────────────────────────

function buildChartData(
  netWorth:      number,
  allMilestones: Props["allMilestones"],
): { year: number; projection: number | null; jalon: number | null; label: string | null }[] {
  const currentYear = new Date().getFullYear()
  const endYear     = 2044

  // Projection linéaire simple sur la base du dernier jalon atteint
  // (ou 0 si aucun jalon n'est encore atteint)
  const lastReachedMilestone = [...allMilestones]
    .reverse()
    .find((m) => netWorth >= m.target)

  const milestoneByYear = new Map(allMilestones.map((m) => [m.year, m]))
  const points: { year: number; projection: number | null; jalon: number | null; label: string | null }[] = []

  for (let y = currentYear; y <= endYear; y++) {
    const milestone = milestoneByYear.get(y)
    const isCurrentYear = y === currentYear

    // Point projection : valeur actuelle pour l'année en cours, null pour les suivantes
    // (on trace la ligne jalon à jalon pour représenter les paliers)
    const projection = isCurrentYear ? netWorth : null

    points.push({
      year:       y,
      projection,
      jalon:      milestone ? milestone.target : null,
      label:      milestone ? milestone.label  : null,
    })
  }

  return points
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function PatrimonyTrajectory({
  netWorth,
  savingsCurrent,
  nextMilestone,
  allMilestones,
  coverageRatio,
  status,
  gap,
  monthsRemaining,
  requiredMonthlySavings,
}: Props) {
  const statusCfg = STATUS_CONFIG[status]
  const chartData = buildChartData(netWorth, allMilestones)
  const gapMensuel =
    requiredMonthlySavings !== null
      ? requiredMonthlySavings - savingsCurrent
      : null

  const kpis = [
    {
      label: "Patrimoine actuel",
      value: formatAmount(netWorth),
      sub:   "EUR constants 2026",
    },
    {
      label: "Prochain jalon",
      value: formatAmount(nextMilestone.target),
      sub:   `${nextMilestone.year} — ${nextMilestone.label}`,
    },
    {
      label: "Écart",
      value: formatAmount(gap),
      sub:   gap === 0 ? "Jalon atteint ✓" : "à combler",
    },
    {
      label: "Mois restants",
      value: monthsRemaining > 0 ? String(monthsRemaining) : "Expiré",
      sub:   `jusqu'à ${nextMilestone.year}`,
    },
    {
      label: "Épargne requise / mois",
      value: requiredMonthlySavings !== null ? formatAmount(requiredMonthlySavings) : "—",
      sub:   "pour atteindre le jalon",
    },
    {
      label: "Gap mensuel",
      value:
        gapMensuel === null
          ? "—"
          : gapMensuel <= 0
            ? "✓ Couvert"
            : formatAmount(gapMensuel),
      sub:   "requis − actuel",
      danger: gapMensuel !== null && gapMensuel > 0,
    },
  ]

  return (
    <Card className="bg-[var(--panel-background)]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold text-foreground">
            Trajectoire patrimoniale — euros constants 2026
          </CardTitle>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-xs font-bold tracking-wide",
              statusCfg.cls,
            )}
          >
            {statusCfg.emoji} {statusCfg.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Grille KPI 3×2 */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {kpis.map((k) => (
            <div key={k.label}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {k.label}
              </p>
              <p
                className={cn(
                  "text-lg font-bold tabular-nums",
                  k.danger ? "text-[var(--danger)]" : "text-foreground",
                )}
              >
                {k.value}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* LineChart Recharts */}
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) =>
                  v >= 1_000_000
                    ? `${(v / 1_000_000).toFixed(1)}M€`
                    : v >= 1_000
                      ? `${Math.round(v / 1_000)}k€`
                      : `${v}€`
                }
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                width={52}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [
                  formatAmount(Number(value)),
                  name === "jalon" ? "Jalon" : "Projection",
                ]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(label: any) => `Année ${label}`}
                contentStyle={{
                  fontSize: 12,
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                }}
              />

              {/* Ligne de référence sur la cible du prochain jalon */}
              <ReferenceLine
                y={nextMilestone.target}
                stroke="hsl(var(--warning))"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              >
                <Label
                  value={`${nextMilestone.year} : ${formatAmount(nextMilestone.target)}`}
                  position="insideTopRight"
                  style={{ fontSize: 9, fill: "hsl(var(--warning))" }}
                />
              </ReferenceLine>

              {/* Point patrimoine actuel */}
              <Line
                type="monotone"
                dataKey="projection"
                stroke="hsl(var(--ai-accent))"
                strokeWidth={0}
                dot={{ r: 5, fill: "hsl(var(--ai-accent))", strokeWidth: 0 }}
                connectNulls={false}
                name="projection"
              />

              {/* Points jalons */}
              <Line
                type="monotone"
                dataKey="jalon"
                stroke="hsl(var(--success))"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={{ r: 4, fill: "hsl(var(--success))", strokeWidth: 0 }}
                connectNulls
                name="jalon"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Légende jalons */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {allMilestones.map((m) => (
            <span key={m.year} className="text-[10px] text-muted-foreground">
              <span className="font-semibold text-foreground">{m.year}</span>{" "}
              {formatAmount(m.target)} — {m.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
