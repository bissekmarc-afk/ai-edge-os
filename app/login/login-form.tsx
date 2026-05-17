"use client"

import { useState, useTransition } from "react"
import { Eye, EyeOff, Loader, Sparkles, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { signInWithPassword, signInWithOtp } from "./actions"

type Mode = "password" | "magic"

export function LoginForm({ errorParam }: { errorParam?: string }) {
  const [mode, setMode] = useState<Mode>("password")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(errorParam ?? null)
  const [magicSent, setMagicSent] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.set("email", email)
    fd.set("password", password)
    startTransition(async () => {
      const err = await signInWithPassword(fd)
      if (err) setError(err)
    })
  }

  function handleMagicSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.set("email", email)
    startTransition(async () => {
      const err = await signInWithOtp(fd)
      if (err) setError(err)
      else setMagicSent(true)
    })
  }

  if (magicSent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-[var(--panel-background)] p-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-[var(--ai-accent-soft)]">
          <Mail className="size-5 text-[var(--ai-accent)]" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Vérifiez votre email</p>
          <p className="text-sm text-muted-foreground">
            Un lien de connexion a été envoyé à{" "}
            <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>
        <button
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => {
            setMagicSent(false)
            setError(null)
          }}
        >
          Renvoyer un lien
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-[var(--panel-background)] p-6">
      <div className="mb-5 flex rounded-lg bg-muted p-1">
        {(["password", "magic"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m)
              setError(null)
            }}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === m
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "password" ? "Mot de passe" : "Lien magique"}
          </button>
        ))}
      </div>

      {mode === "password" ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              required
              autoComplete="email"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Mot de passe
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={isPending}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <Loader className="size-4 animate-spin" />
            ) : (
              "Se connecter"
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleMagicSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              required
              autoComplete="email"
              disabled={isPending}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Vous recevrez un lien de connexion par email, sans mot de passe.
          </p>

          {error && (
            <p className="rounded-lg bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <Loader className="size-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="size-4" />
                Envoyer le lien
              </>
            )}
          </Button>
        </form>
      )}
    </div>
  )
}
