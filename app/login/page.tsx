import { Sparkles } from "lucide-react"
import { LoginForm } from "./login-form"

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--main-background)] p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--ai-accent)]">
            <Sparkles className="size-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-foreground">AI Edge OS</h1>
          <p className="text-sm text-muted-foreground">
            Connexion à votre espace personnel
          </p>
        </div>

        <LoginForm errorParam={error} />
      </div>
    </div>
  )
}
