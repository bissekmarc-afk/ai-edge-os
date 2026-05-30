"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ComposedChart,
  Bar,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import type { MonthlySummary } from "@/lib/finance/types"

// ─── Constants ────────────────────────────────────────────────────────────────

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

const COLOR_INCOME    = "#22c55e"               // green-500
const COLOR_OPEX      = "#f97316"               // orange-500
const COLOR_DEBT      = "#a855f7"               // purple-500
const COLOR_CASH_POS  = "#06b6d4"               // cyan-500
// Budget line uses the CSS custom property so it follows the active theme
const COLOR_BUDGET    = "hsl(var(--muted-foreground))"

const LABELS: Record<string, string> = {
  grossIncome:         "Revenus",
  opex:                "Dép. opérat.",
  debtService:         "Debt Service",
  cashPosition:        "Cash Position (cumul)",
  budgetCashPosition:  "Budget (cumul)",
}

function fmtShort(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M€`
  if (abs >= 1_000)     return `${(v / 1_000).toFixed(1)}k€`
  return `${v}€`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PLCashflowChartProps {
  /** Rows for the primary scenario (actual / budget / reforecast). */
  data: MonthlySummary[]
  /**
   * Budget rows used to draw the dashed "Budget (cumul)" reference line.
   * Pass `undefined` when the primary scenario is already `budget_initial`
   * (no point comparing budget against itself).
   */
  budgetData?: MonthlySummary[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PLCashflowChart({ data, budgetData }: PLCashflowChartProps) {
  // Prevents SSR / hydration mismatch — Recharts uses ResizeObserver
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // ── Derived chart data ────────────────────────────────────────────────────
  //
  // cashPosition[m]       = Σ netCashFlow[first data month … m]
  // budgetCashPosition[m] = Σ budgetNetCashFlow[first budget month … m]
  //
  // Budget rows are looked up by month so the two arrays can span different
  // months (e.g. actual = Jan–Dec, budget = May–Dec: Jan–Apr budget contrib = 0).
  const chartData = useMemo(() => {
    const budgetByMonth = new Map(
      (budgetData ?? []).map(r => [r.month, r.netCashFlow]),
    )
    const hasBudget = (budgetData?.length ?? 0) > 0

    let runningActual = 0
    let runningBudget = 0

    return data.map(row => {
      runningActual += row.netCashFlow
      runningBudget += hasBudget ? (budgetByMonth.get(row.month) ?? 0) : 0

      return {
        ...row,
        cashPosition:       runningActual,
        budgetCashPosition: hasBudget ? runningBudget : undefined,
      }
    })
  }, [data, budgetData])

  const showBudgetLine = (budgetData?.length ?? 0) > 0

  if (!mounted) return <Skeleton className="h-64 w-full rounded-xl" />

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="28%"
          barGap={2}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            strokeOpacity={0.08}
            vertical={false}
          />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmtShort}
            tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }}
            axisLine={false}
            tickLine={false}
            width={46}
          />
          <Tooltip
            formatter={(value, name) => [
              EUR.format(Number(value ?? 0)),
              LABELS[String(name)] ?? String(name),
            ]}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            contentStyle={{
              borderRadius: "0.5rem",
              border: "1px solid rgba(0,0,0,0.1)",
              fontSize: 12,
            }}
          />
          <Legend
            formatter={(v: string) => LABELS[v] ?? v}
            iconSize={10}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />

          {/* Zero-reference line */}
          <ReferenceLine
            y={0}
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeDasharray="5 4"
          />

          {/* Monthly bars */}
          <Bar
            dataKey="grossIncome"
            name="grossIncome"
            fill={COLOR_INCOME}
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="opex"
            name="opex"
            fill={COLOR_OPEX}
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="debtService"
            name="debtService"
            fill={COLOR_DEBT}
            radius={[3, 3, 0, 0]}
          />

          {/* Cumulative actual cash position — cyan */}
          <Line
            dataKey="cashPosition"
            name="cashPosition"
            stroke={COLOR_CASH_POS}
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: COLOR_CASH_POS, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: COLOR_CASH_POS }}
            type="monotone"
          />

          {/* Cumulative budget reference line — dashed muted, no dots */}
          {showBudgetLine && (
            <Line
              dataKey="budgetCashPosition"
              name="budgetCashPosition"
              stroke={COLOR_BUDGET}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 3, stroke: COLOR_BUDGET, strokeWidth: 1, fill: "transparent" }}
              type="monotone"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
