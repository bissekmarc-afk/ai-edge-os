"use client"

import { useEffect, useState } from "react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import type { CashflowMonth } from "@/lib/queries/finance-dashboard"

// Fixed colors — work in both light and dark modes
const COLOR_INCOME   = "#22c55e"  // green-500
const COLOR_EXPENSES = "#f97316"  // orange-500

function formatEurShort(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k€`
  return `${value}€`
}

interface CashflowChartProps {
  data: CashflowMonth[]
}

export function CashflowChart({ data }: CashflowChartProps) {
  // Prevents SSR / hydration mismatch — Recharts uses ResizeObserver
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <Skeleton className="h-60 w-full rounded-xl" />
  }

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          barCategoryGap="30%"
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
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatEurShort}
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            formatter={(value, name) => [
              new Intl.NumberFormat("fr-FR", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              }).format(Number(value ?? 0)),
              name === "income" ? "Revenus" : "Dépenses",
            ]}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            contentStyle={{
              borderRadius: "0.5rem",
              border: "1px solid rgba(0,0,0,0.1)",
              fontSize: 12,
            }}
          />
          <Legend
            formatter={(value) => (value === "income" ? "Revenus" : "Dépenses")}
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <Bar dataKey="income"   name="income"   fill={COLOR_INCOME}   radius={[3, 3, 0, 0]} />
          <Bar dataKey="expenses" name="expenses" fill={COLOR_EXPENSES} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
