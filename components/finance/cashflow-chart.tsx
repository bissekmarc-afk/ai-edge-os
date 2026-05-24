"use client"

import { useEffect, useState } from "react"
import {
  ComposedChart,
  Bar,
  Line,
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

const COLOR_INCOME  = "#22c55e"   // green-500
const COLOR_OPEX    = "#f97316"   // orange-500
const COLOR_DEBT    = "#a855f7"   // purple-500
const COLOR_NCF     = "#60a5fa"   // blue-400

const LABELS: Record<string, string> = {
  grossIncome: "Revenus",
  opex:        "Dép. opérat.",
  debtService: "Debt Service",
  netCashFlow: "Net Cash Flow",
}

function fmtShort(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M€`
  if (abs >= 1_000)     return `${(v / 1_000).toFixed(1)}k€`
  return `${v}€`
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PLCashflowChartProps {
  data: MonthlySummary[]
}

export function PLCashflowChart({ data }: PLCashflowChartProps) {
  // Prevents SSR / hydration mismatch — Recharts uses ResizeObserver
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <Skeleton className="h-64 w-full rounded-xl" />

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
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
          <Line
            dataKey="netCashFlow"
            name="netCashFlow"
            stroke={COLOR_NCF}
            strokeWidth={2}
            dot={{ r: 3, fill: COLOR_NCF }}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
