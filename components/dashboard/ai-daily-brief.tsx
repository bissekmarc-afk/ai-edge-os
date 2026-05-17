import { Sparkles, TrendingUp, AlertCircle, Lightbulb } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const RECOMMENDATIONS = [
  {
    id: "r1",
    icon: <AlertCircle className="size-3.5 text-[var(--warning)]" />,
    text: "Rapport Q2 dû aujourd'hui — à finaliser avant 17h.",
  },
  {
    id: "r2",
    icon: <TrendingUp className="size-3.5 text-[var(--success)]" />,
    text: "Budget mai en bonne voie : dépenses à 57% du plafond le 17/05.",
  },
  {
    id: "r3",
    icon: <Lightbulb className="size-3.5 text-[var(--ai-accent)]" />,
    text: "Streak lecture : 21 jours. Continue ce soir pour maintenir la dynamique.",
  },
]

export function AIDailyBrief() {
  return (
    <Card className="border-[var(--ai-accent-soft)] bg-[var(--panel-background)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-[var(--ai-accent)]" />
          Brief IA du jour
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tu as{" "}

          <span className="font-medium text-foreground">5 tâches</span> pour
          aujourd&apos;hui dont{" "}
          <span className="font-medium text-[var(--danger)]">2 urgentes</span>.
          Semaine sportive excellente — 2 séances gym + 2 boxe depuis lundi.
          Mémoire : 5 entrées confirmées, 1 inférence en attente.
        </p>
        <ul className="space-y-2">
          {RECOMMENDATIONS.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 shrink-0">{r.icon}</span>
              <span className="text-foreground/80">{r.text}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
