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
import { TRIGGER_ICON, isDependencyMet } from "@/lib/finance/trajectory-config"
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

// ─── Statut badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  green:  { emoji: "🟢", label: "ON TRACK",  cls: "bg-[var(--success)]/10 text-[var(--success)]" },
  orange: { emoji: "🟠", label: "VIGILANCE", cls: "bg-[var(--warning)]/10 text-[var(--warning)]" },
  red:    { emoji: "🔴", label: "CRITIQUE",  cls: "bg-[var(--danger)]/10  text-[var(--danger)]"  },
} as const

// ─── Chart data ───────────────────────────────────────────────────────────────

type ChartPoint = {
  year:       number
  projection: number | null
  jalon:      number | null
  jalonLabel: string | null
  action:     string | null
}

function buildChartData(
  netWorth:      number,
  allMilestones: Props["allMilestones"],
): ChartPoint[] {
  const currentYear     = new Date().getFullYear()
  const milestoneByYear = new Map(allMilestones.map((m) => [m.year, m]))
  const points: ChartPoint[] = []

  for (let y = currentYear; y <= 2044; y++) {
    const m = milestoneByYear.get(y)
    points.push({
      year:       y,
      projection: y === currentYear ? netWorth : null,
      jalon:      m ? m.target : null,
      jalonLabel: m ? m.label  : null,
      action:     m ? m.trigger.action : null,
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
  status,
  gap,
  monthsRemaining,
  requiredMonthlySavings,
}: Props) {
  const statusCfg  = STATUS_CONFIG[status]
  const chartData  = buildChartData(netWorth, allMilestones)
  const gapMensuel = requiredMonthlySavings !== null
    ? requiredMonthlySavings - savingsCurrent
    : null

  const triggerIcon   = TRIGGER_ICON[nextMilestone.trigger.type]
  const triggerAction = nextMilestone.trigger.action
  const triggerDep    = nextMilestone.trigger.dependency
  const depMet        = isDependencyMet(nextMilestone, netWorth)

  const kpis = [
    {
      label: "Patrimoine actuel",
      value: formatAmount(netWorth),
      sub:   "EUR constants 2026",
    },
    {
      label:   "Prochain jalon",
      value:   formatAmount(nextMilestone.target),
      sub:     `${nextMilestone.year} — ${nextMilestone.label}`,
      // Déclencheur affiché en dessous
      trigger: `${triggerIcon} ${triggerAction}`,
      triggerOrange: !depMet,
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
      label:  "Gap mensuel",
      value:  gapMensuel === null ? "—" : gapMensuel <= 0 ? "✓ Couvert" : formatAmount(gapMensuel),
      sub:    "requis − actuel",
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
          <span className={cn("rounded px-2 py-0.5 text-xs font-bold tracking-wide", statusCfg.cls)}>
            {statusCfg.emoji} {statusCfg.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* ── Grille KPI 3×2 ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {kpis.map((k) => (
            <div key={k.label}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {k.label}
              </p>
              <p className={cn(
                "text-lg font-bold tabular-nums",
                k.danger ? "text-[var(--danger)]" : "text-foreground",
              )}>
                {k.value}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">{k.sub}</p>

              {/* Déclencheur — affiché uniquement pour "Prochain jalon" */}
              {"trigger" in k && k.trigger && (
                <p className={cn(
                  "mt-0.5 truncate text-[10px] font-medium",
                  k.triggerOrange
                    ? "text-[var(--warning)]"
                    : "text-[var(--ai-accent)]",
                )}>
                  Déclencheur : {k.trigger}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* ── LineChart ───────────────────────────────────────────────── */}
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
                  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M€`
                  : v >= 1_000   ? `${Math.round(v / 1_000)}k€`
                  : `${v}€`
                }
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                width={52}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any, item: any) => {
                  const action = item?.payload?.action as string | null
                  const label  = name === "jalon" ? "Jalon" : "Patrimoine actuel"
                  const lines: string[] = [formatAmount(Number(value))]
                  if (name === "jalon" && action) lines.push(`↳ ${action}`)
                  return [lines.join("\n"), label]
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(label: any) => `Année ${label}`}
                contentStyle={{
                  fontSize: 11,
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  whiteSpace: "pre-line",
                }}
              />

              {/* ReferenceLine sur la cible du prochain jalon */}
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

              {/* Ligne jalons — pointillée si dépendance non atteinte */}
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

        {/* ── Légende jalons enrichie ─────────────────────────────────── */}
        <div className="space-y-1.5">
          {allMilestones.map((m) => {
            const reached   = netWorth >= m.target
            const depOk     = isDependencyMet(m, netWorth)
            const icon      = TRIGGER_ICON[m.trigger.type]

            return (
              <div
                key={m.year}
                className={cn(
                  "flex flex-wrap items-start gap-x-2 gap-y-0.5 text-[10px]",
                  !depOk && "opacity-50",
                )}
              >
                {/* Icône type + année + target */}
                <span className="font-semibold text-foreground whitespace-nowrap">
                  {icon} {m.year}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatAmount(m.target)}
                </span>
                {reached && (
                  <span className="text-[var(--success)]">✓</span>
                )}
                {/* Label + action */}
                <span className="text-muted-foreground">— {m.label}</span>
                <span className={cn(
                  "w-full pl-0 text-[9px]",
                  depOk ? "text-muted-foreground/70" : "text-[var(--warning)]/70",
                )}>
                  ↳ {m.trigger.action}
                  {m.trigger.dependency && (
                    <span className="ml-1 text-muted-foreground/50">
                      · Dépend de : {m.trigger.dependency}
                      {!depOk && " ⚠︎"}
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        {/* Note dépendance non satisfaite */}
        {!depMet && (
          <p className="text-[10px] text-[var(--warning)] border-t border-border/30 pt-2">
            ⚠︎ Ce jalon dépend de : <span className="font-medium">{triggerDep}</span> — non encore atteint.
          </p>
        )}

      </CardContent>
    </Card>
  )
}
