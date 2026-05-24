import { NextResponse } from "next/server"

export async function GET() {
  const peek = (v: string | undefined) =>
    v ? `${v.slice(0, 5)}… (${v.length} chars)` : "MISSING"

  return NextResponse.json({
    ok: true,
    env: {
      SUPABASE_URL:       peek(process.env.SUPABASE_URL),
      SUPABASE_ANON_KEY:  peek(process.env.SUPABASE_ANON_KEY),
      NEXT_PUBLIC_SUPABASE_URL:      peek(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: peek(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      NODE_ENV: process.env.NODE_ENV,
    },
  })
}
